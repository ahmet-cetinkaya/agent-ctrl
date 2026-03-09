import { homedir } from "node:os";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { resolveApplyScope } from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class ClaudeApplyAdapter implements IAppyPlatformAdapter {
  readonly platformName = "claude" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const claudeRoot =
      scope === "project"
        ? resolve(projectPath, ".claude")
        : resolve(process.env.AGENT_CTRL_CLAUDE_HOME || homedir(), ".claude");

    return {
      configPath: resolve(claudeRoot, "CLAUDE.md"),
      scope,
      surface: "memory-skills-agents-commands-mcp",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const adapter = new ClaudeAdapter(
      request.projectPath,
      target.scope === "project" ? request.projectPath : process.env.AGENT_CTRL_CLAUDE_HOME || homedir()
    );
    const source = await this.sourceLoader.load(request.projectPath);
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
          cleanExistingArtifacts: Boolean(request.override),
        }
      );
      if (!writeResult.success) {
        throw writeResult.error;
      }
    }

    const claudeRoot = resolve(target.configPath, "..");
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

    const fileChanges = [
      target.configPath,
      ...skillPaths,
      ...agentPaths,
      ...commandPaths,
      resolve(claudeRoot, "..", ".claude.json"),
    ];

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: "success",
      message: "Applied Claude configuration, skills, agents, commands, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
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
