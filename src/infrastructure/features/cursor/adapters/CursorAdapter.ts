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
  mergeJsonObjectFile,
  renderSettingsMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsMarkdown,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class CursorAdapter implements IApplyPlatformAdapter {
  readonly platformName = "cursor" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".cursor");
    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "rules-skills-commands-agents-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const artifactRoot =
      target.scope === "project" ? resolve(request.projectPath, ".cursor") : resolve(target.configPath, "..");
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
      await Promise.all([
        rm(resolve(artifactRoot, "rules"), { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(resolve(artifactRoot, "skills"), { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(resolve(artifactRoot, "commands"), { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(resolve(artifactRoot, "agents"), { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      { start: "<!-- agent-ctrl:cursor:start -->", end: "<!-- agent-ctrl:cursor:end -->" },
      "No managed Cursor rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    if (source.skills.length > 0) {
      const skillsResult = await syncSkills(source.skills, resolve(artifactRoot, "skills"), Boolean(request.dryRun));
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);
    }

    if (source.commands.length > 0) {
      const commandsResult = await syncCommandsAsMarkdown(
        source.commands,
        resolve(artifactRoot, "commands"),
        Boolean(request.dryRun)
      );
      changed = commandsResult.changed || changed;
      fileChanges.push(...commandsResult.paths);
    }

    if (source.agents.length > 0) {
      const agentsResult = await syncAgentsAsMarkdown(
        source.agents,
        resolve(artifactRoot, "agents"),
        Boolean(request.dryRun),
        true
      );
      changed = agentsResult.changed || changed;
      fileChanges.push(...agentsResult.paths);
    }

    if (source.mcpServers.length > 0) {
      const mcpResult = await mergeJsonObjectFile(
        resolve(artifactRoot, "mcp.json"),
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
      message: "Applied Cursor rules, skills, commands, agents, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
