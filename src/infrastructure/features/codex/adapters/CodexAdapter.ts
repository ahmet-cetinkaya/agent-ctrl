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
  countUnsupportedArtifacts,
  mergeManagedTomlSection,
  renderCodexMcpServers,
  resolveApplyScope,
  syncCommandsAsMarkdown,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class CodexAdapter implements IAppyPlatformAdapter {
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
      surface: "agents-md-prompts-skills-config-toml",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".codex");
    const skillRoot =
      target.scope === "project" ? resolve(request.projectPath, ".agents", "skills") : resolve(userRoot, "skills");
    const promptRoot = resolve(userRoot, "prompts");
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
      const promptsResult = await syncCommandsAsMarkdown(source.commands, promptRoot, Boolean(request.dryRun));
      changed = promptsResult.changed || changed;
      fileChanges.push(...promptsResult.paths);
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
      message: "Applied Codex guidance, prompts, skills, and MCP servers.",
      fileChanges,
      warnings: [
        ...source.warnings,
        ...countUnsupportedArtifacts("Codex", source, target.scope === "project" ? ["commands", "agents"] : ["agents"]),
      ],
    };
  }
}
