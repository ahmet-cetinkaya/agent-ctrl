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
  syncCommandsAsToml,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class GeminiAdapter implements IApplyPlatformAdapter {
  readonly platformName = "gemini" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private static readonly markers = {
    start: "<!-- agent-ctrl:gemini:start -->",
    end: "<!-- agent-ctrl:gemini:end -->",
  };

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".gemini");

    return {
      configPath: scope === "project" ? resolve(projectPath, "GEMINI.md") : resolve(userRoot, "GEMINI.md"),
      scope,
      surface: "gemini-md-commands-skills-settings",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".gemini");
    const userAgentsRoot = request.userConfigRootPath
      ? resolve(request.userConfigRootPath, "..", ".agents")
      : resolve(homedir(), ".agents");
    const scopeRoot = target.scope === "project" ? resolve(request.projectPath, ".gemini") : userRoot;
    const scopeAgentsRoot = target.scope === "project" ? resolve(request.projectPath, ".agents") : userAgentsRoot;
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
      const commandsPath = resolve(scopeRoot, "commands");
      const skillsPath = resolve(scopeRoot, "skills");
      const agentsPath = scopeAgentsRoot;
      const mcpConfigPath = resolve(scopeRoot, ".mcp.json");

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
        rm(mcpConfigPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      GeminiAdapter.markers,
      "No managed Gemini rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    if (source.commands.length > 0) {
      const commandsResult = await syncCommandsAsToml(
        source.commands,
        resolve(scopeRoot, "commands"),
        Boolean(request.dryRun)
      );
      changed = commandsResult.changed || changed;
      fileChanges.push(...commandsResult.paths);
    }

    if (source.skills.length > 0) {
      for (const skillsRoot of [resolve(scopeRoot, "skills"), resolve(scopeAgentsRoot, "skills")]) {
        const skillsResult = await syncSkills(source.skills, skillsRoot, Boolean(request.dryRun));
        changed = skillsResult.changed || changed;
        fileChanges.push(...skillsResult.paths);
      }
    }

    if (source.mcpServers.length > 0) {
      const settingsResult = await mergeJsonObjectFile(
        resolve(scopeRoot, "settings.json"),
        (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
        Boolean(request.dryRun)
      );
      changed = settingsResult.changed || changed;
      fileChanges.push(...settingsResult.paths);
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied Gemini guidance, commands, skills, and MCP servers.",
      fileChanges,
      warnings: [...source.warnings, ...countUnsupportedArtifacts("Gemini", source, ["agents"])],
    };
  }
}
