import { homedir } from "node:os";
import { resolve } from "node:path";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  countUnsupportedArtifacts,
  mergeManagedTomlSection,
  renderCodexMcpServers,
  resolveApplyScope,
  syncAgentsAsCodexToml,
  syncCommandsAsSkills,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class CodexAdapter implements IApplyPlatformAdapter {
  readonly platformName = "codex" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private static readonly ruleMarkers = {
    start: "<!-- agent-ctrl:codex:start -->",
    end: "<!-- agent-ctrl:codex:end -->",
  };
  private static readonly mcpMarkers = {
    start: "# agent-ctrl:codex-mcp:start",
    end: "# agent-ctrl:codex-mcp:end",
  };

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".codex");

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "agents-md-skills-config-toml",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".codex");
    const skillRoot =
      target.scope === "project" ? resolve(request.projectPath, ".agents", "skills") : resolve(userRoot, "skills");
    const configPath =
      target.scope === "project"
        ? resolve(request.projectPath, ".codex", "config.toml")
        : resolve(userRoot, "config.toml");
    const source = await this.sourceLoader.load(request.projectPath);

    let changed = false;
    const fileChanges: string[] = [];
    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      CodexAdapter.ruleMarkers,
      "No managed Codex rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    const skillsResult = await syncSkills(source.skills, skillRoot, Boolean(request.dryRun));
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    if (target.scope === "user") {
      const commandsAsSkillsResult = await syncCommandsAsSkills(source.commands, skillRoot, Boolean(request.dryRun));
      changed = commandsAsSkillsResult.changed || changed;
      fileChanges.push(...commandsAsSkillsResult.paths);
    }

    if (source.agents.length > 0) {
      const agentsDir =
        target.scope === "project" ? resolve(request.projectPath, ".codex", "agents") : resolve(userRoot, "agents");
      const agentsResult = await syncAgentsAsCodexToml(source.agents, agentsDir, Boolean(request.dryRun));
      changed = agentsResult.changed || changed;
      fileChanges.push(...agentsResult.paths);
    }

    if (source.mcpServers.length > 0) {
      const mcpResult = await mergeManagedTomlSection(
        configPath,
        renderCodexMcpServers(source.mcpServers),
        CodexAdapter.mcpMarkers,
        Boolean(request.dryRun)
      );
      changed = mcpResult.changed || changed;
      fileChanges.push(...mcpResult.paths);
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied Codex guidance, skills, agents, and MCP servers.",
      fileChanges,
      warnings: [
        ...source.warnings,
        ...countUnsupportedArtifacts("Codex", source, target.scope === "project" ? ["commands"] : []),
      ],
    };
  }
}
