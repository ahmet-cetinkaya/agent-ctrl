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
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";
import {
  resolveApplyScope,
  syncAgentsAsSkills,
  syncCommandsAsMarkdownFlattened,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

/**
 * Pi (https://pi.dev, `@earendil-works/pi-coding-agent`) platform adapter.
 *
 * Pi reads project instructions from an `AGENTS.md` file (it also aliases Claude Code's
 * `CLAUDE.md`), discovers native Agent-Skills-spec `SKILL.md` skills under `skills/`, and
 * discovers custom "prompt templates" under `prompts/`. It has no first-class persona/subagent
 * file and no native MCP server configuration surface — both degrade with a warning, mirroring
 * the precedent set by the Cursor and Windsurf adapters.
 */
export class PiAdapter implements IApplyPlatformAdapter {
  readonly platformName = "pi" as const;
  private readonly sourceLoader = new ApplySourceLoader();
  private readonly commandRenderer = CommandRendererFactory.getRenderer("pi");
  private static readonly markers = {
    start: "<!-- agent-ctrl:pi:start -->",
    end: "<!-- agent-ctrl:pi:end -->",
  };

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".pi", "agent");

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      scope,
      surface: "pi-agents-md-prompts-skills",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = request.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".pi", "agent");

    const promptsRoot =
      target.scope === "project" ? resolve(request.projectPath, ".pi", "prompts") : resolve(userRoot, "prompts");
    const skillsRoot =
      target.scope === "project" ? resolve(request.projectPath, ".pi", "skills") : resolve(userRoot, "skills");

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
    const modelWarnings: string[] = [];

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      await Promise.all([
        rm(promptsRoot, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
        rm(skillsRoot, { recursive: true, force: true }).catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }),
      ]);
    }

    // Sync rules to AGENTS.md
    const rulesResult = await upsertManagedRuleDocument(
      target.configPath,
      source.rules,
      PiAdapter.markers,
      "No managed Pi rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    // Sync commands to prompts/ as prompt templates
    if (source.commands.length > 0) {
      const commandsResult = await syncCommandsAsMarkdownFlattened(
        source.commands,
        promptsRoot,
        Boolean(request.dryRun),
        this.commandRenderer,
        "pi"
      );
      changed = commandsResult.changed || changed;
      fileChanges.push(...commandsResult.paths);
      modelWarnings.push(...commandsResult.warnings);
    }

    // Sync skills natively to skills/
    if (source.skills.length > 0) {
      const skillsResult = await syncSkills(
        source.skills,
        skillsRoot,
        Boolean(request.dryRun),
        undefined,
        undefined,
        "pi"
      );
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);
      modelWarnings.push(...skillsResult.warnings);
    }

    // Pi has no persona/subagent concept — write agents as skills with a warning.
    if (source.agents.length > 0) {
      source.warnings.push("Pi does not support custom agents. Agents are being written as skills instead.");
      const agentsResult = await syncAgentsAsSkills(source.agents, skillsRoot, Boolean(request.dryRun), "pi");
      changed = agentsResult.changed || changed;
      fileChanges.push(...agentsResult.paths);
      modelWarnings.push(...agentsResult.warnings);
    }

    // MCP servers are not supported
    if (source.mcpServers.length > 0) {
      source.warnings.push("Pi does not support MCP server configuration. MCP servers will not be applied.");
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied Pi AGENTS.md, prompt templates, and skills.",
      artifactCounts: {
        rules: source.rules.length,
        commands: source.commands.length,
        skills: source.skills.length,
        agents: source.agents.length,
        mcpServers: source.mcpServers.length,
      },
      fileChanges,
      warnings: [...source.warnings, ...modelWarnings],
    };
  }
}
