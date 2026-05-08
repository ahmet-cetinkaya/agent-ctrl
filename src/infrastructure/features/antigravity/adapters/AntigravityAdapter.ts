import { homedir } from "node:os";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  countUnsupportedArtifacts,
  mergeJsonObjectFile,
  renderSettingsMcpConfig,
  resolveApplyScope,
  syncCommandsAsWorkflows,
  syncRulesAsFiles,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class AntigravityAdapter implements IApplyPlatformAdapter {
  readonly platformName = "antigravity" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private static readonly markers = {
    start: "<!-- agent-ctrl:antigravity:start -->",
    end: "<!-- agent-ctrl:antigravity:end -->",
  };

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".gemini");

    return {
      configPath: scope === "project" ? resolve(projectPath, ".agent", "rules") : resolve(userRoot, "GEMINI.md"),
      scope,
      surface: scope === "project" ? "rules-workflows-skills-mcp" : "gemini-md-skills-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".gemini");
    const projectRoot = request.projectPath;
    const source = await this.sourceLoader.load(request.projectPath);

    let changed = false;
    const fileChanges: string[] = [];

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      if (target.scope === "project") {
        const projectScopeSkillsPath = resolve(projectRoot, ".agent", "skills");
        const projectScopeRulesPath = resolve(projectRoot, ".agent", "rules");
        const projectScopeWorkflowsPath = resolve(projectRoot, ".agent", "workflows");

        await Promise.all([
          rm(projectScopeSkillsPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
          rm(projectScopeRulesPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
          rm(projectScopeWorkflowsPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
        ]);
      } else {
        const userScopeSkillsPath = resolve(userRoot, "antigravity", "skills");

        await Promise.all([
          rm(userScopeSkillsPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
        ]);
      }
    }

    if (target.scope === "project") {
      const rulesResult = await syncRulesAsFiles(
        source.rules,
        target.configPath,
        (rule, content) => ({ relativePath: `${rule.id}.md`, content: content.trimEnd() }),
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);

      const workflowsResult = await syncCommandsAsWorkflows(
        source.commands,
        resolve(request.projectPath, ".agent", "workflows"),
        Boolean(request.dryRun)
      );
      changed = workflowsResult.changed || changed;
      fileChanges.push(...workflowsResult.paths);

      const skillsResult = await syncSkills(
        source.skills,
        resolve(request.projectPath, ".agent", "skills"),
        Boolean(request.dryRun)
      );
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);

      const mcpResult = await mergeJsonObjectFile(
        resolve(request.projectPath, ".agent", "mcp_config.json"),
        (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
        Boolean(request.dryRun)
      );
      changed = mcpResult.changed || changed;
      fileChanges.push(...mcpResult.paths);
    } else {
      const rulesResult = await upsertManagedRuleDocument(
        target.configPath,
        source.rules,
        AntigravityAdapter.markers,
        "No managed Antigravity global rules were found.",
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);

      const skillsResult = await syncSkills(
        source.skills,
        resolve(userRoot, "antigravity", "skills"),
        Boolean(request.dryRun)
      );
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);

      const mcpResult = await mergeJsonObjectFile(
        resolve(userRoot, "antigravity", "mcp_config.json"),
        (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
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
      message:
        target.scope === "project"
          ? "Applied Antigravity workspace rules, workflows, skills, and MCP servers."
          : "Applied Antigravity global guidance, skills, and MCP servers.",
      fileChanges,
      warnings: [...source.warnings, ...countUnsupportedArtifacts("Antigravity", source, ["agents"])],
    };
  }
}
