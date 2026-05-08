import { homedir } from "node:os";
import { resolve } from "node:path";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";
import { AgentRendererFactory } from "@/infrastructure/features/apply/adapters/AgentRendererFactory";
import {
  mergeJsonObjectFile,
  renderForgeCodeMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsMarkdownFlattened,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";
import { rm } from "node:fs/promises";

export class ForgeCodeAdapter implements IApplyPlatformAdapter {
  readonly platformName = "forgecode" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private readonly commandRenderer = CommandRendererFactory.getRenderer("forgecode");
  private readonly agentRenderer = AgentRendererFactory.getRenderer("forgecode");
  private static readonly markers = {
    start: "<!-- agent-ctrl:forgecode:start -->",
    end: "<!-- agent-ctrl:forgecode:end -->",
  };

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".forge");

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "agents-md-commands-skills-agents-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".forge");

    const commandRoot =
      target.scope === "project" ? resolve(request.projectPath, ".forge", "commands") : resolve(userRoot, "commands");
    const skillRoot =
      target.scope === "project" ? resolve(request.projectPath, ".forge", "skills") : resolve(userRoot, "skills");
    const agentRoot =
      target.scope === "project" ? resolve(request.projectPath, ".forge", "agents") : resolve(userRoot, "agents");
    const mcpConfigPath =
      target.scope === "project" ? resolve(request.projectPath, ".mcp.json") : resolve(userRoot, ".mcp.json");

    const source = await this.sourceLoader.load(request.projectPath);

    let changed = false;
    const fileChanges: string[] = [];

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      const commandsPath = commandRoot;
      const skillsPath = skillRoot;
      const agentsPath = agentRoot;

      await Promise.all([
        rm(commandsPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(skillsPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(agentsPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    // Sync rules to AGENTS.md
    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      ForgeCodeAdapter.markers,
      "No managed ForgeCode rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    // Sync commands to .forge/commands/
    const commandsResult = await syncCommandsAsMarkdownFlattened(
      source.commands,
      commandRoot,
      Boolean(request.dryRun),
      this.commandRenderer
    );
    changed = commandsResult.changed || changed;
    fileChanges.push(...commandsResult.paths);

    // Sync skills to .forge/skills/
    const skillsResult = await syncSkills(source.skills, skillRoot, Boolean(request.dryRun), "forgecode");
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    // Sync agents to .forge/agents/
    const agentsResult = await syncAgentsAsMarkdown(
      source.agents,
      agentRoot,
      Boolean(request.dryRun),
      true,
      this.agentRenderer
    );
    changed = agentsResult.changed || changed;
    fileChanges.push(...agentsResult.paths);

    // Sync MCP servers to .mcp.json
    const mcpResult = await mergeJsonObjectFile(
      mcpConfigPath,
      (existing) => renderForgeCodeMcpConfig(existing, source.mcpServers),
      Boolean(request.dryRun)
    );
    changed = mcpResult.changed || changed;
    fileChanges.push(...mcpResult.paths);

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied ForgeCode AGENTS.md, commands, skills, agents, and MCP servers.",
      artifactCounts: {
        rules: source.rules.length,
        commands: source.commands.length,
        skills: source.skills.length,
        agents: source.agents.length,
        mcpServers: source.mcpServers.length,
      },
      fileChanges,
      warnings: source.warnings,
    };
  }
}
