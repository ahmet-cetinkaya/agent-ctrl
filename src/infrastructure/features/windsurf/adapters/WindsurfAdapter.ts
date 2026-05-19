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
  syncCommandsAsWorkflows,
  syncRulesAsFiles,
  toStatus,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

/** Renders a rule as a Windsurf rules file with YAML frontmatter for conditional activation. */
function renderWindsurfRule(rule: Rule, content: string): { relativePath: string; content: string } {
  const frontmatter = ["---", "alwaysApply: true", "---", ""].join("\n");

  return {
    relativePath: `${rule.id}.md`,
    content: `${frontmatter}${content}`,
  };
}

export class WindsurfAdapter implements IApplyPlatformAdapter {
  readonly platformName = "windsurf" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".codeium", "windsurf");
    return {
      configPath: scope === "project" ? resolve(projectPath, ".windsurf", "rules") : resolve(userRoot, "rules"),
      scope,
      surface: scope === "project" ? "windsurf-rules-workflows" : "windsurf-global-rules",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".codeium", "windsurf");
    const workflowsRoot =
      target.scope === "project"
        ? resolve(request.projectPath, ".windsurf", "workflows")
        : resolve(userRoot, "workflows");
    const rulesRoot = target.configPath;
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
        rm(rulesRoot, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(workflowsRoot, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    // Windsurf uses .windsurf/rules/ with YAML frontmatter for conditional activation.
    if (source.rules.length > 0) {
      if (target.scope === "user") {
        source.warnings.push(
          "Windsurf global rules should be configured via the Cascade Customizations UI. Writing to ~/.codeium/windsurf/rules/ as a fallback."
        );
      }

      const rulesResult = await syncRulesAsFiles(
        source.rules,
        rulesRoot,
        (rule, content) => renderWindsurfRule(rule, content),
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);
    }

    // Windsurf supports workflows via .windsurf/workflows/.
    if (source.commands.length > 0) {
      const workflowsResult = await syncCommandsAsWorkflows(source.commands, workflowsRoot, Boolean(request.dryRun));
      changed = workflowsResult.changed || changed;
      fileChanges.push(...workflowsResult.paths);
    }

    // Windsurf does not natively support skills, agents, or MCP file configuration.
    const unsupported = ["skills", "agents", "mcpServers"] as const;
    for (const type of unsupported) {
      if (source[type].length > 0) {
        const label = type === "mcpServers" ? "MCP servers" : type;
        source.warnings.push(`Windsurf does not support ${label}. ${label} will not be applied.`);
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
          ? "Applied Windsurf rules and workflows."
          : "Applied Windsurf global rules (via Cascade Customizations UI fallback).",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
