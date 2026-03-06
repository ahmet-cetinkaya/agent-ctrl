import { ok, err } from "@/core/domain/shared/value-objects/Result";
import type {
  IMcpConfigLoader,
  McpFileResult,
  McpIssue,
  McpLoadedServer,
  McpLoadResult,
} from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { McpPathResolver } from "@/infrastructure/features/mcp/loaders/McpPathResolver";
import { McpFileDiscovery } from "@/infrastructure/features/mcp/loaders/McpFileDiscovery";
import { McpFileReader } from "@/infrastructure/features/mcp/loaders/McpFileReader";
import { McpEnvFileLoader } from "@/infrastructure/features/mcp/loaders/McpEnvFileLoader";
import { McpServerEnvComposer } from "@/infrastructure/features/mcp/loaders/McpServerEnvComposer";
import { McpServersParser } from "@/infrastructure/features/mcp/parsers/McpServersParser";
import { McpServerEntryValidator } from "@/infrastructure/features/mcp/validators/McpServerEntryValidator";
import { McpInterpolationScanner } from "@/infrastructure/features/mcp/interpolation/McpInterpolationScanner";
import { McpPlaceholderValidation } from "@/infrastructure/features/mcp/validators/McpPlaceholderValidation";
import { McpPlaceholderResolver } from "@/infrastructure/features/mcp/interpolation/McpPlaceholderResolver";
import { McpServerConflictValidator } from "@/infrastructure/features/mcp/validators/McpServerConflictValidator";
import { McpLoadReportBuilder } from "@/infrastructure/features/mcp/reporting/McpLoadReportBuilder";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

interface AggregatedCandidate {
  serverId: string;
  filePath: string;
  command: string;
  args: string[];
  cwd?: string;
  resolvedEnv: Record<string, string>;
  issues: McpIssue[];
}

export class McpServerAggregator implements IMcpConfigLoader {
  private readonly pathResolver = new McpPathResolver();
  private readonly discovery = new McpFileDiscovery();
  private readonly reader = new McpFileReader();
  private readonly envLoader = new McpEnvFileLoader();
  private readonly envComposer = new McpServerEnvComposer();
  private readonly parser = new McpServersParser();
  private readonly entryValidator = new McpServerEntryValidator();
  private readonly interpolationScanner = new McpInterpolationScanner();
  private readonly placeholderValidation = new McpPlaceholderValidation();
  private readonly placeholderResolver = new McpPlaceholderResolver();
  private readonly conflictValidator = new McpServerConflictValidator();
  private readonly reportBuilder = new McpLoadReportBuilder();
  private readonly formatter = new McpErrorFormatter();

  /**
   * Loads and aggregates MCP server configurations through a multi-phase pipeline:
   *
   * PHASE 1 - Discovery: Locate MCP JSON files in <config-root>/mcps/
   * PHASE 2 - Env Loading: Load MCPs/.env if present
   * PHASE 3 - File Processing (per file):
   *   3a. Read and parse JSON
   *   3b. Extract mcpServers entries
   *   3c. Validate each entry (command, args, env, cwd)
   *   3d. Scan for ${VAR} placeholders
   *   3e. Validate placeholder resolution
   *   3f. Resolve placeholders and compose env
   * PHASE 4 - Conflict Detection: Find duplicate serverId across files
   * PHASE 5 - Finalization: Build load report with per-file status
   *
   * ERROR HANDLING STRATEGY:
   * - Individual file/entry failures are isolated (valid entries still load)
   * - Catastrophic failures (e.g., filesystem errors) return err()
   * - All validation issues are collected and reported
   *
   * @param projectPath - Project root directory
   * @returns ok(servers + report) or err(catastrophic error)
   */
  async load(projectPath: string) {
    try {
      const startedAt = new Date();
      const paths = this.pathResolver.resolve(projectPath);
      const files = await this.discovery.discover(paths.mcpDir);
      const envResult = await this.envLoader.load(paths.envPath);

      const fileResults = new Map<string, McpFileResult>();
      const candidates: AggregatedCandidate[] = [];
      const loadedServers: McpLoadedServer[] = [];

      for (const filePath of files) {
        const fileResult = this.reportBuilder.createFileResult(filePath);
        fileResults.set(filePath, fileResult);

        let document: unknown;
        try {
          document = await this.reader.readJson(filePath);
        } catch (error) {
          this.addIssue(
            fileResult,
            this.formatter.createIssue({
              severity: "error",
              code: "MCP_JSON_READ_FAILED",
              message: `Failed to read/parse JSON: ${String(error)}`,
              filePath,
            })
          );
          fileResult.failedServerCount += 1;
          continue;
        }

        const parsed = this.parser.parse(filePath, document);
        for (const issue of parsed.issues) {
          this.addIssue(fileResult, issue);
        }

        if (parsed.issues.some((issue) => issue.severity === "error") && parsed.servers.length === 0) {
          fileResult.failedServerCount += 1;
          continue;
        }

        for (const server of parsed.servers) {
          const validation = this.entryValidator.validate(server.serverId, server.filePath, server.config);
          const candidateIssues: McpIssue[] = [...validation.issues];

          const refs = this.interpolationScanner.scan(server.config);
          candidateIssues.push(
            ...this.placeholderValidation.validate(
              refs,
              envResult.variables,
              server.filePath,
              server.serverId,
              envResult.exists && !envResult.malformed
            )
          );

          if (!envResult.exists && refs.length === 0) {
            candidateIssues.push(
              this.formatter.createIssue({
                severity: "warning",
                code: "ENV_FILE_MISSING_OPTIONAL",
                message: "mcps/.env not found; proceeding because no placeholder resolution was required",
                filePath: server.filePath,
                serverId: server.serverId,
              })
            );
          }

          if (envResult.malformed && refs.length > 0) {
            candidateIssues.push(
              this.formatter.createIssue({
                severity: "error",
                code: "ENV_FILE_MALFORMED",
                message: "mcps/.env contains malformed entries and cannot safely resolve placeholders",
                filePath: server.filePath,
                serverId: server.serverId,
              })
            );
          }

          if (envResult.malformedLines.length > 0 && refs.length === 0) {
            candidateIssues.push(
              this.formatter.createIssue({
                severity: "warning",
                code: "ENV_FILE_PARTIAL_PARSE",
                message: "mcps/.env has malformed lines; unresolved entries were ignored",
                filePath: server.filePath,
                serverId: server.serverId,
              })
            );
          }

          const validated = validation.validated;
          if (!validated) {
            for (const issue of candidateIssues) {
              this.addIssue(fileResult, issue);
            }
            fileResult.failedServerCount += 1;
            continue;
          }

          const resolvedRaw = this.placeholderResolver.resolve(validated.rawConfig, envResult.variables) as Record<
            string,
            unknown
          >;
          const serverEnvRaw = this.extractEnvObject(resolvedRaw.env);
          const resolvedEnv = this.envComposer.compose(envResult.variables, serverEnvRaw);

          candidates.push({
            serverId: validated.serverId,
            filePath: validated.filePath,
            command: validated.command,
            args: validated.args,
            cwd: typeof resolvedRaw.cwd === "string" ? resolvedRaw.cwd : validated.cwd,
            resolvedEnv,
            issues: candidateIssues,
          });
        }
      }

      const conflictMap = this.conflictValidator.findConflicts(
        candidates.map((candidate) => ({
          serverId: candidate.serverId,
          filePath: candidate.filePath,
        }))
      );

      for (const candidate of candidates) {
        const conflictKey = this.conflictValidator.makeKey(candidate.filePath, candidate.serverId);
        const conflictIssues = conflictMap.get(conflictKey) ?? [];
        if (conflictIssues.length > 0) {
          candidate.issues.push(...conflictIssues);
        }

        const fileResult = fileResults.get(candidate.filePath);
        if (!fileResult) {
          continue;
        }

        for (const issue of candidate.issues) {
          this.addIssue(fileResult, issue);
        }

        if (candidate.issues.some((issue) => issue.severity === "error")) {
          fileResult.failedServerCount += 1;
          continue;
        }

        fileResult.loadedServerCount += 1;
        loadedServers.push({
          serverId: candidate.serverId,
          filePath: candidate.filePath,
          command: candidate.command,
          args: candidate.args,
          cwd: candidate.cwd,
          env: candidate.resolvedEnv,
        });
      }

      const finalizedFileResults = Array.from(fileResults.values()).map((entry) =>
        this.reportBuilder.finalizeFileResult(entry)
      );
      const report = this.reportBuilder.buildReport(startedAt, new Date(), files.length, finalizedFileResults);

      const result: McpLoadResult = {
        servers: loadedServers,
        report,
      };

      return ok(result);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      // Only catch expected I/O errors, re-throw programming errors
      if (nodeErr.code === 'ENOENT' || nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
        return err(new Error(`Failed to aggregate MCP servers: ${nodeErr.message}`));
      }
      // Re-throw unexpected errors (programming errors like TypeError, ReferenceError)
      throw error;
    }
  }

  private extractEnvObject(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    const out: Record<string, string> = {};
    for (const [key, envValue] of Object.entries(value)) {
      if (typeof envValue === "string") {
        out[key] = envValue;
      }
    }

    return out;
  }

  private addIssue(fileResult: McpFileResult, issue: McpIssue): void {
    if (
      fileResult.issues.some(
        (existing) =>
          existing.code === issue.code &&
          existing.message === issue.message &&
          existing.serverId === issue.serverId &&
          existing.filePath === issue.filePath
      )
    ) {
      return;
    }

    this.reportBuilder.addIssue(fileResult, issue);
  }
}
