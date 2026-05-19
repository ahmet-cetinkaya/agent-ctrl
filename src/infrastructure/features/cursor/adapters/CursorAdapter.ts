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

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      const rulesPath =
        target.scope === "project" ? resolve(request.projectPath, ".cursor", "rules") : resolve(userRoot, "rules");

      await rm(rulesPath, { recursive: true, force: true }).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      });
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

    // Cursor does not natively support skills, commands, agents, or MCP file configuration.
    const unsupported = ["skills", "commands", "agents", "mcpServers"] as const;
    for (const type of unsupported) {
      if (source[type].length > 0) {
        const label = type === "mcpServers" ? "MCP servers" : type;
        source.warnings.push(`Cursor does not support ${label}. ${label} will not be applied.`);
      }
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
