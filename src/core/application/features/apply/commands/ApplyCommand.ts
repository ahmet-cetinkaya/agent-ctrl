import type { Artifact } from "@/core/domain/shared/types/Artifact";
import type { IPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";
import { createMcpConfigLoader } from "@/infrastructure/features/apply";
import type { McpFileResult } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { PathSecurity } from "@/infrastructure/shared/utils/PathSecurity";

export interface ApplyCommandOptions {
  projectPath: string;
  platform: string;
  dryRun?: boolean;
  override?: boolean;
}

export interface ApplyCommandResult {
  rulesApplied: number;
  skillsApplied: number;
  agentsApplied: number;
  mcpServersLoaded: number;
  mcpFilesDiscovered: number;
  mcpFilesFailed: number;
  mcpFilesSkipped: number;
  mcpFileResults: McpFileResult[];
  configPath: string;
  warnings: string[];
}

export class ApplyCommand {
  async execute(options: ApplyCommandOptions): Promise<Result<ApplyCommandResult, Error>> {
    const { projectPath, platform, dryRun, override } = options;

    const adapter = this.createAdapter(platform, projectPath);
    if (!adapter) {
      return err(new UserError(`Platform '${platform}' not supported. Supported platforms: claude`));
    }

    const artifacts = await this.scanArtifacts(projectPath);
    const warnings: string[] = [];

    if (artifacts.length === 0) {
      warnings.push("No artifacts found in project. Configuration file will be created anyway.");
    }

    // Validate project path for security before loading MCP configurations
    const pathSecurity = new PathSecurity(projectPath);
    const pathValidation = pathSecurity.resolveSafe(projectPath);
    if (!pathValidation.safe) {
      return err(new UserError(`Invalid project path: ${pathValidation.error}`));
    }

    const mcpLoader = createMcpConfigLoader();
    const mcpResult = await mcpLoader.load(projectPath);
    if (!mcpResult.success) {
      const errorDetails = mcpResult.error.message;
      const enhancedMessage = `Failed to load MCP configurations from ${projectPath}. Check your MCP JSON files in .agent-ctrl/mcps/ for syntax errors. Details: ${errorDetails}`;
      return err(new SystemError(enhancedMessage));
    }

    const mcpLoad = mcpResult.data;
    const newConfig = await adapter.generateConfig(artifacts);
    newConfig.mcpServers = mcpLoad.servers.map((server) => ({
      name: server.serverId,
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: server.env,
      sourceFile: server.filePath,
    }));

    const existingConfig = await adapter.readExistingConfig();

    const finalConfig = override ? newConfig : adapter.mergeConfigs(existingConfig, newConfig);

    warnings.push(
      ...mcpLoad.report.fileResults
        .flatMap((fileResult) => fileResult.issues)
        .filter((issue) => issue.severity === "warning")
        .map((issue) => issue.message)
    );

    if (dryRun) {
      return ok({
        rulesApplied: newConfig.rules.length,
        skillsApplied: newConfig.skills.length,
        agentsApplied: newConfig.agents.length,
        mcpServersLoaded: mcpLoad.report.totalLoaded,
        mcpFilesDiscovered: mcpLoad.report.totalDiscovered,
        mcpFilesFailed: mcpLoad.report.totalFailed,
        mcpFilesSkipped: mcpLoad.report.totalSkipped,
        mcpFileResults: mcpLoad.report.fileResults,
        configPath: adapter.configPath,
        warnings,
      });
    }

    try {
      await adapter.writeConfig(finalConfig, { cleanExistingArtifacts: Boolean(override) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return err(new SystemError(`Permission denied: cannot write to ${adapter.configPath}`));
      }
      if ((error as NodeJS.ErrnoException).code === "EBUSY") {
        return err(new SystemError(`Configuration file is locked or in use. Close Claude Code and try again.`));
      }
      return err(new SystemError(`Failed to write configuration: ${error}`));
    }

    return ok({
      rulesApplied: newConfig.rules.length,
      skillsApplied: newConfig.skills.length,
      agentsApplied: newConfig.agents.length,
      mcpServersLoaded: mcpLoad.report.totalLoaded,
      mcpFilesDiscovered: mcpLoad.report.totalDiscovered,
      mcpFilesFailed: mcpLoad.report.totalFailed,
      mcpFilesSkipped: mcpLoad.report.totalSkipped,
      mcpFileResults: mcpLoad.report.fileResults,
      configPath: adapter.configPath,
      warnings,
    });
  }

  private createAdapter(platform: string, projectPath: string): IPlatformAdapter | null {
    if (platform === "claude") {
      return new ClaudeAdapter(projectPath);
    }
    return null;
  }

  private async scanArtifacts(projectPath: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    const ruleScanner = new RuleScanner();
    const skillScanner = new SkillScanner();
    const agentScanner = new AgentScanner();

    const rulesResult = await ruleScanner.scan(`${projectPath}/rules`);
    artifacts.push(...rulesResult.artifacts);

    const skillsResult = await skillScanner.scan(`${projectPath}/skills`);
    artifacts.push(...skillsResult.artifacts);

    const agentsResult = await agentScanner.scan(`${projectPath}/agents`);
    artifacts.push(...agentsResult.artifacts);

    return artifacts;
  }
}
