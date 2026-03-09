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
  renderSettingsMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsWorkflows,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class WindsurfAdapter implements IAppyPlatformAdapter {
  readonly platformName = "windsurf" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private static readonly markers = {
    start: "<!-- agent-ctrl:windsurf:start -->",
    end: "<!-- agent-ctrl:windsurf:end -->",
  };

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".codeium", "windsurf");
    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "global_rules.md"),
      scope,
      surface: scope === "project" ? "agents-md-workflows-skills-mcp" : "global-rules-workflows-skills-mcp",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".codeium", "windsurf");
    const workflowsRoot =
      target.scope === "project"
        ? resolve(request.projectPath, ".windsurf", "workflows")
        : resolve(userRoot, "workflows");
    const skillsRoot =
      target.scope === "project" ? resolve(request.projectPath, ".windsurf", "skills") : resolve(userRoot, "skills");
    const mcpPath =
      target.scope === "project"
        ? resolve(request.projectPath, ".windsurf", "mcp_config.json")
        : resolve(userRoot, "mcp_config.json");
    const source = await this.sourceLoader.load(request.projectPath);
    let changed = false;
    const fileChanges: string[] = [];

    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      WindsurfAdapter.markers,
      "No managed Windsurf rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    const workflowsResult = await syncCommandsAsWorkflows(source.commands, workflowsRoot, Boolean(request.dryRun));
    changed = workflowsResult.changed || changed;
    fileChanges.push(...workflowsResult.paths);

    const skillsResult = await syncSkills(source.skills, skillsRoot, Boolean(request.dryRun));
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    const agentsRoot =
      target.scope === "project" ? resolve(request.projectPath, ".windsurf", "agents") : resolve(userRoot, "agents");
    const agentsResult = await syncAgentsAsMarkdown(source.agents, agentsRoot, Boolean(request.dryRun), true);
    changed = agentsResult.changed || changed;
    fileChanges.push(...agentsResult.paths);

    const mcpResult = await mergeJsonObjectFile(
      mcpPath,
      (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
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
      message:
        target.scope === "project"
          ? "Applied Windsurf guidance, workflows, skills, and MCP servers."
          : "Applied Windsurf global rules, workflows, skills, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
