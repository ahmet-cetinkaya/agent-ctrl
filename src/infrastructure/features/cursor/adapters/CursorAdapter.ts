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
import type { Rule } from "@/core/domain/shared/entities/Rule";
import {
  resolveApplyScope,
  syncCommandsAsSkills,
  syncAgentsAsSkills,
  syncRulesAsFiles,
  syncSkills,
  toStatus,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

/** Renders a rule as a Cursor .mdc file with YAML frontmatter for conditional activation. */
function renderCursorMdc(rule: Rule, content: string): { relativePath: string; content: string } {
  const frontmatter = ["---", "alwaysApply: true", "---", ""].join("\n");

  return {
    relativePath: `${rule.id}.mdc`,
    content: `${frontmatter}${content}`,
  };
}

export class CursorAdapter implements IApplyPlatformAdapter {
  readonly platformName = "cursor" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".cursor");
    return {
      configPath: scope === "project" ? resolve(projectPath, ".cursor", "rules") : resolve(userRoot, "rules"),
      scope,
      surface: "cursor-rules-mdc",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".cursor");
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

    // Cursor does not natively support skills, commands, agents, or MCP file configuration.
    // Commands and agents are written as skills with a warning explaining the behavior change.
    const artifactRoot = target.scope === "project" ? resolve(request.projectPath, ".cursor") : resolve(userRoot);
    const skillsRoot = resolve(artifactRoot, "skills");

    if (source.commands.length > 0) {
      source.warnings.push("Cursor does not support custom commands. Commands are being written as skills instead.");
      const commandsResult = await syncCommandsAsSkills(source.commands, skillsRoot, Boolean(request.dryRun));
      changed = commandsResult.changed || changed;
      fileChanges.push(...commandsResult.paths);
    }

    if (source.agents.length > 0) {
      source.warnings.push("Cursor does not support custom agents. Agents are being written as skills instead.");
      const agentsResult = await syncAgentsAsSkills(source.agents, skillsRoot, Boolean(request.dryRun));
      changed = agentsResult.changed || changed;
      fileChanges.push(...agentsResult.paths);
    }

    if (source.skills.length > 0) {
      const skillsResult = await syncSkills(source.skills, skillsRoot, Boolean(request.dryRun));
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);
    }

    // MCP servers are not supported
    if (source.mcpServers.length > 0) {
      source.warnings.push("Cursor does not support MCP server configuration. MCP servers will not be applied.");
    }

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      const rulesPath =
        target.scope === "project" ? resolve(request.projectPath, ".cursor", "rules") : resolve(userRoot, "rules");
      const skillsPath = skillsRoot;

      await Promise.all([
        rm(rulesPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(skillsPath, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    // Cursor uses .cursor/rules/*.mdc with YAML frontmatter for conditional activation.
    if (source.rules.length > 0) {
      const rulesRoot =
        target.scope === "project" ? resolve(request.projectPath, ".cursor", "rules") : resolve(userRoot, "rules");

      if (target.scope === "user") {
        source.warnings.push(
          "Cursor global rules should be configured via the Cursor Settings UI. Writing to ~/.cursor/rules/ as a fallback."
        );
      }

      const rulesResult = await syncRulesAsFiles(
        source.rules,
        rulesRoot,
        (rule, content) => renderCursorMdc(rule, content),
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied Cursor rules via .cursor/rules/*.mdc.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
