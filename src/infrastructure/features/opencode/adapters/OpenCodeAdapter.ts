import { homedir } from "node:os";
import { resolve } from "node:path";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  mergeJsonObjectFile,
  renderOpencodeMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsMarkdown,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class OpenCodeAdapter implements IAppyPlatformAdapter {
  readonly platformName = "opencode" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private static readonly markers = {
    start: "<!-- agent-ctrl:opencode:start -->",
    end: "<!-- agent-ctrl:opencode:end -->",
  };

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".config", "opencode");

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "agents-md-commands-skills-agents-mcp",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".config", "opencode");
    const commandRoot =
      target.scope === "project"
        ? resolve(request.projectPath, ".opencode", "commands")
        : resolve(userRoot, "commands");
    const skillRoot =
      target.scope === "project" ? resolve(request.projectPath, ".opencode", "skills") : resolve(userRoot, "skills");
    const agentRoot =
      target.scope === "project" ? resolve(request.projectPath, ".opencode", "agents") : resolve(userRoot, "agents");
    const mcpConfigPath =
      target.scope === "project" ? resolve(request.projectPath, "opencode.json") : resolve(userRoot, "opencode.json");
    const source = await this.sourceLoader.load(request.projectPath);

    let changed = false;
    const fileChanges: string[] = [];
    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      OpenCodeAdapter.markers,
      "No managed OpenCode rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    const commandsResult = await syncCommandsAsMarkdown(source.commands, commandRoot, Boolean(request.dryRun));
    changed = commandsResult.changed || changed;
    fileChanges.push(...commandsResult.paths);

    const skillsResult = await syncSkills(source.skills, skillRoot, Boolean(request.dryRun), "opencode");
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    const agentsResult = await syncAgentsAsMarkdown(source.agents, agentRoot, Boolean(request.dryRun), true);
    changed = agentsResult.changed || changed;
    fileChanges.push(...agentsResult.paths);

    const mcpResult = await mergeJsonObjectFile(
      mcpConfigPath,
      (existing) => renderOpencodeMcpConfig(existing, source.mcpServers),
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
      message: "Applied OpenCode guidance, commands, skills, agents, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
