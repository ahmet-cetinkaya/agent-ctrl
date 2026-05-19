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
  syncCommandsAsSkills,
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
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "GEMINI.md"),
      scope,
      surface: scope === "project" ? "rules-skills-mcp" : "gemini-md-skills-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".gemini");
    const projectRoot = request.projectPath;
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

    let changed = false;
    const fileChanges: string[] = [];

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      if (target.scope === "project") {
        const projectScopeSkillsPath = resolve(projectRoot, ".agent", "skills");

        await Promise.all([
          rm(projectScopeSkillsPath, { recursive: true, force: true }).catch((error) => {
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
      const rulesResult = await upsertManagedRuleDocument(
        target.configPath,
        source.rules,
        { start: "<!-- agent-ctrl:antigravity:start -->", end: "<!-- agent-ctrl:antigravity:end -->" },
        "No managed Antigravity rules were found.",
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);

      if (source.commands.length > 0) {
        const commandsResult = await syncCommandsAsSkills(
          source.commands,
          resolve(projectRoot, ".agent", "skills"),
          Boolean(request.dryRun)
        );
        changed = commandsResult.changed || changed;
        fileChanges.push(...commandsResult.paths);
      }

      if (source.skills.length > 0) {
        const skillsResult = await syncSkills(
          source.skills,
          resolve(projectRoot, ".agent", "skills"),
          Boolean(request.dryRun)
        );
        changed = skillsResult.changed || changed;
        fileChanges.push(...skillsResult.paths);
      }

      if (source.mcpServers.length > 0) {
        const mcpResult = await mergeJsonObjectFile(
          resolve(projectRoot, ".agent", "mcp_config.json"),
          (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
          Boolean(request.dryRun)
        );
        changed = mcpResult.changed || changed;
        fileChanges.push(...mcpResult.paths);
      }
    } else {
      if (source.rules.length > 0) {
        const rulesResult = await upsertManagedRuleDocument(
          target.configPath,
          source.rules,
          AntigravityAdapter.markers,
          "No managed Antigravity global rules were found.",
          Boolean(request.dryRun)
        );
        changed = rulesResult.changed || changed;
        fileChanges.push(...rulesResult.paths);
      }

      if (source.skills.length > 0) {
        const skillsResult = await syncSkills(
          source.skills,
          resolve(userRoot, "antigravity", "skills"),
          Boolean(request.dryRun)
        );
        changed = skillsResult.changed || changed;
        fileChanges.push(...skillsResult.paths);
      }

      if (source.mcpServers.length > 0) {
        const mcpResult = await mergeJsonObjectFile(
          resolve(userRoot, "antigravity", "mcp_config.json"),
          (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
          Boolean(request.dryRun)
        );
        changed = mcpResult.changed || changed;
        fileChanges.push(...mcpResult.paths);
      }
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message:
        target.scope === "project"
          ? "Applied Antigravity workspace rules, skills, and MCP servers."
          : "Applied Antigravity global guidance, skills, and MCP servers.",
      fileChanges,
      warnings: [...source.warnings, ...countUnsupportedArtifacts("Antigravity", source, ["agents"])],
    };
  }
}
