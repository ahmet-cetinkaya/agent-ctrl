import { homedir } from "node:os";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  ClaudeMcpScope,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ClaudeAdapter, toClaudeMcpEntry } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  CLAUDE_ENV_REFERENCES,
  collectMcpPlaceholderNames,
  hasMcpChanges,
  mergeJsonObjectFile,
  prepareMcpServersForScope,
  resolveApplyScope,
  withoutMcpServers,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

const CLAUDE_PROJECT_MCP_FILE = ".mcp.json";
const DEFAULT_CLAUDE_MCP_SCOPE: ClaudeMcpScope = "project";

export class ClaudeApplyAdapter implements IApplyPlatformAdapter {
  readonly platformName = "claude" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const claudeHome =
      scope === "project" ? projectPath : resolve(process.env.AGENT_CTRL_CLAUDE_HOME || homedir(), ".claude");

    return {
      configPath: scope === "project" ? resolve(projectPath, "CLAUDE.md") : resolve(claudeHome, "CLAUDE.md"),
      scope,
      surface: "memory-skills-agents-commands-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const claudeMcpScope = request.claudeMcpScope ?? DEFAULT_CLAUDE_MCP_SCOPE;
    const claudeHome =
      target.scope === "project" ? request.projectPath : process.env.AGENT_CTRL_CLAUDE_HOME || homedir();
    const configPath =
      target.scope === "project"
        ? resolve(request.projectPath, "CLAUDE.md")
        : resolve(claudeHome, ".claude", "CLAUDE.md");
    const adapter = new ClaudeAdapter(
      request.projectPath,
      claudeHome,
      configPath,
      target.scope === "project" ? request.projectPath : undefined,
      claudeMcpScope
    );

    const source = request.mergedSnapshot
      ? {
          rules: request.mergedSnapshot.rules,
          skills: request.mergedSnapshot.skills,
          agents: request.mergedSnapshot.agents,
          commands: request.mergedSnapshot.commands,
          mcpServers: request.mergedSnapshot.mcpServers,
          referenceOnlyMcpServers: request.mergedSnapshot.referenceOnlyMcpServers,
          warnings: request.mergedSnapshot.warnings,
        }
      : await this.sourceLoader.load(request.projectPath);

    const desiredConfig = await adapter.generateConfig([...source.rules, ...source.skills, ...source.agents]);
    if (!desiredConfig.success) {
      throw desiredConfig.error;
    }

    if (!request.dryRun) {
      const writeResult = await adapter.writeConfig(
        {
          ...desiredConfig.data,
          mcpServers: source.mcpServers,
        },
        {
          cleanExistingArtifacts: request.override,
          commands: source.commands,
        }
      );
      if (!writeResult.success) {
        throw writeResult.error;
      }
    } else {
      await adapter.collectModelWarnings(desiredConfig.data, source.commands);
    }

    const modelWarnings = [...new Set(adapter.collectedWarnings)];
    const writesProjectMcpFile = target.scope === "project" && claudeMcpScope === "project";
    const projectMcp = writesProjectMcpFile ? await this.applyProjectMcp(adapter, request, source) : undefined;

    const claudeRoot = resolve(target.configPath, "..");
    const fileChanges: string[] = [];

    const scopedRulePaths = await adapter.scopedRuleFilePaths(desiredConfig.data);
    if (source.rules.length > scopedRulePaths.length) {
      fileChanges.push(target.configPath);
    }
    fileChanges.push(...scopedRulePaths);

    const skillPaths = (
      await Promise.all(
        source.skills.map(async (skill) => {
          const files = await collectFiles(skill.path);
          return files.map((filePath) => resolve(claudeRoot, "skills", skill.id, relative(skill.path, filePath)));
        })
      )
    ).flat();
    const agentPaths = source.agents.map((agent) => resolve(claudeRoot, "agents", `${agent.id}.md`));
    const commandPaths = source.commands.map((command) => resolve(claudeRoot, "commands", `${command.id}.md`));

    fileChanges.push(...skillPaths, ...agentPaths, ...commandPaths);

    if (projectMcp) {
      fileChanges.push(...projectMcp.fileChanges);
    } else if (source.mcpServers.length > 0) {
      fileChanges.push(adapter.claudeMcpConfigPath);
    }

    const warnings = [
      ...source.warnings,
      ...modelWarnings,
      ...(projectMcp?.warnings ?? []),
      ...(request.claudeMcpScope && target.scope === "user"
        ? [`--claude-mcp-scope applies to a project-scope apply only; it is ignored at user scope.`]
        : []),
      ...(source.skills.length > 0 && target.scope !== "project"
        ? [
            "Skills were applied to ~/.claude/skills/. Claude Desktop's filesystem-skill support is known to be unstable: skills may not appear in Customize > Skills, may silently fail to invoke via \"/name\" in the Code tab even when listed in autocomplete, or may not load at all in some versions. They are never available in Chat/Cowork tabs. If a skill doesn't seem to fire, try removing `disable-model-invocation: true` from its SKILL.md frontmatter, or upload it through Customize > Skills for Chat/Cowork use.",
          ]
        : []),
    ];

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: "success",
      message: "Applied Claude configuration, skills, agents, commands, and MCP servers.",
      fileChanges,
      warnings,
    };
  }

  /**
   * Writes the servers to `<project>/.mcp.json`, which Claude Code reads for the project and a team
   * can commit. `${VAR}` stays a placeholder there, so no secret is written. Servers an earlier apply
   * stored in the home `.claude.json` local scope are removed from it, so they do not load twice.
   */
  private async applyProjectMcp(
    adapter: ClaudeAdapter,
    request: ApplyIntegrationRequest,
    source: { mcpServers: ApplyMcpServer[]; referenceOnlyMcpServers?: ApplyMcpServer[] }
  ): Promise<ProjectMcpResult> {
    const dryRun = Boolean(request.dryRun);
    const prepared = prepareMcpServersForScope(
      "project",
      source.mcpServers,
      CLAUDE_ENV_REFERENCES,
      "Claude Code",
      source.referenceOnlyMcpServers
    );
    const fileChanges: string[] = [];
    const warnings = [...prepared.warnings, ...describeUnsetVariables(prepared.servers)];

    if (hasMcpChanges(source.mcpServers, prepared)) {
      const projectFile = resolve(request.projectPath, CLAUDE_PROJECT_MCP_FILE);
      const result = await mergeJsonObjectFile(
        projectFile,
        (existing) => mergeClaudeProjectServers(withoutMcpServers(existing, prepared.withheldNames), prepared.servers),
        dryRun
      );
      fileChanges.push(...result.paths);
    }

    const writtenNames = [...source.mcpServers, ...(source.referenceOnlyMcpServers ?? [])].map(({ name }) => name);
    const migrated = await this.migrateLocalScopeServers(adapter, writtenNames, dryRun);
    if (migrated.names.length > 0) {
      fileChanges.push(adapter.claudeMcpConfigPath);
      warnings.push(
        `Moved MCP servers from ~/.claude.json (local scope of this project) to ${CLAUDE_PROJECT_MCP_FILE}: ${migrated.names.join(", ")}. An earlier apply stored them there.`
      );
    }
    warnings.push(...migrated.warnings);

    return { fileChanges, warnings };
  }

  /** A broken or unwritable home file must not block the project apply, so it becomes a warning. */
  private async migrateLocalScopeServers(
    adapter: ClaudeAdapter,
    serverNames: string[],
    dryRun: boolean
  ): Promise<{ names: string[]; warnings: string[] }> {
    try {
      return { names: await adapter.removeLocalScopeMcpServers(serverNames, dryRun), warnings: [] };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        names: [],
        warnings: [
          `Left ~/.claude.json untouched; old local-scope MCP servers may still load besides ${CLAUDE_PROJECT_MCP_FILE}: ${reason}`,
        ],
      };
    }
  }
}

function mergeClaudeProjectServers(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const current = typeof existing.mcpServers === "object" && existing.mcpServers !== null ? existing.mcpServers : {};
  const incoming = Object.fromEntries(servers.map((server) => [server.name, toClaudeMcpEntry(server)]));
  return { ...existing, mcpServers: { ...current, ...incoming } };
}

/** The variables the written servers read at run time that this shell does not define. */
function describeUnsetVariables(servers: ApplyMcpServer[]): string[] {
  const unset = collectMcpPlaceholderNames(servers).filter((name) => !process.env[name]);
  return unset.length > 0
    ? [`Not set in the current environment; Claude Code expands them when it starts: ${unset.join(", ")}`]
    : [];
}

interface ProjectMcpResult {
  fileChanges: string[];
  warnings: string[];
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(filePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(filePath);
    }
  }

  return files;
}
