import { homedir } from "node:os";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { resolveApplyScope } from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

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
    const claudeHome =
      target.scope === "project" ? request.projectPath : process.env.AGENT_CTRL_CLAUDE_HOME || homedir();
    const configPath =
      target.scope === "project"
        ? resolve(request.projectPath, "CLAUDE.md")
        : resolve(claudeHome, ".claude", "CLAUDE.md");
    const adapter = new ClaudeAdapter(request.projectPath, claudeHome, configPath);

    const source = request.mergedSnapshot
      ? {
          rules: request.mergedSnapshot.rules,
          skills: request.mergedSnapshot.skills,
          agents: request.mergedSnapshot.agents,
          commands: request.mergedSnapshot.commands,
          mcpServers: request.mergedSnapshot.mcpServers,
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
        }
      );
      if (!writeResult.success) {
        throw writeResult.error;
      }
    }

    const claudeRoot = resolve(target.configPath, "..");
    const fileChanges: string[] = [];

    if (source.rules.length > 0) {
      fileChanges.push(target.configPath);
    }

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

    if (source.mcpServers.length > 0) {
      fileChanges.push(resolve(claudeRoot, "..", ".claude.json"));
    }

    const warnings = [
      ...source.warnings,
      ...(source.skills.length > 0 && target.scope !== "project"
        ? [
            'Skills were applied to ~/.claude/skills/ but the Claude Desktop App (Chat/Cowork) does not load filesystem skills. They are only available in the Code tab via "/" slash commands. Upload skills through Customize > Skills for Chat/Cowork use, or use a project-local .claude/skills/ directory.',
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
