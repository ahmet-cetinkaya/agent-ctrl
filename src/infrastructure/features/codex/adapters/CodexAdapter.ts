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

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".codex");

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "agents-md-skills-config-toml",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".codex");
    const skillRoot =
      target.scope === "project" ? resolve(request.projectPath, ".agents", "skills") : resolve(userRoot, "skills");
    // Codex does NOT support project-level config.toml (security risk: agents could modify their own approval policy).
    // MCP servers are only written to global config.
    const globalConfigPath = resolve(userRoot, "config.toml");
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
      const skillsPath = skillRoot;
      const agentsPath =
        target.scope === "project" ? resolve(request.projectPath, ".codex", "agents") : resolve(userRoot, "agents");

      await Promise.all([
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
      if (target.scope === "project") {
        source.warnings.push(
          "Codex does not support project-level MCP configuration (security risk). MCP servers will only be applied at global scope."
        );
      }
      // Always write MCP to global config only — never project-level.
      const mcpResult = await mergeManagedTomlSection(
        globalConfigPath,
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
      message:
        target.scope === "project"
          ? "Applied Codex guidance, skills, and agents. MCP servers require global scope (security constraint)."
          : "Applied Codex guidance, skills, agents, and MCP servers.",
      fileChanges,
      warnings: [
        ...source.warnings,
        ...countUnsupportedArtifacts("Codex", source, target.scope === "project" ? ["commands"] : []),
      ],
    };
  }
}
