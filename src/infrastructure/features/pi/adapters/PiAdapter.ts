import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFile, rm } from "node:fs/promises";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  ApplyPlatformScope,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { AgentRendererFactory } from "@/infrastructure/features/apply/adapters/AgentRendererFactory";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";
import {
  mergeJsonObjectFile,
  renderPiMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncAgentsAsSkills,
  syncCommandsAsMarkdownFlattened,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

/** Shape of the relevant slice of Pi's `settings.json` `packages` declarations. */
interface PiSettingsPackages {
  packages?: Array<{ source?: unknown }>;
}

/**
 * Pi (https://pi.dev, `@earendil-works/pi-coding-agent`) platform adapter.
 *
 * Pi reads project instructions from an `AGENTS.md` file (it also aliases Claude Code's
 * `CLAUDE.md`), discovers native Agent-Skills-spec `SKILL.md` skills under `skills/`, and
 * discovers custom "prompt templates" under `prompts/`. It has no first-class persona/subagent
 * file, so agents always degrade to skills with a warning (mirroring the precedent set by the
 * Cursor and Windsurf adapters).
 *
 * Pi has no native MCP configuration surface either, but the most widely adopted community
 * extension (`pi-mcp-adapter`, ~1M npm downloads/month as of 2026-09-23) reads project- and
 * user-scope `.mcp.json` files. Same story for agents/personas and the `pi-subagents` extension
 * (~455K npm downloads/month), which reads `.pi/agents/*.md`. If either extension is detected as
 * installed (declared in Pi's own `settings.json` `packages` list — see `isPackageInstalled()`),
 * the corresponding artifact is written to its native location; otherwise it falls back to the
 * existing degraded behavior (agents → skills, MCP → dropped) with a warning naming the extension.
 */
export class PiAdapter implements IApplyPlatformAdapter {
  readonly platformName = "pi" as const;
  private static readonly MCP_ADAPTER_PACKAGE = "pi-mcp-adapter";
  private static readonly SUBAGENTS_PACKAGE = "pi-subagents";
  private readonly sourceLoader = new ApplySourceLoader();
  private readonly commandRenderer = CommandRendererFactory.getRenderer("pi");
  private readonly agentRenderer = AgentRendererFactory.getRenderer("pi");
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
    const agentsRoot =
      target.scope === "project" ? resolve(request.projectPath, ".pi", "agents") : resolve(userRoot, "agents");

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
        rm(agentsRoot, { recursive: true, force: true }).catch((error) => {
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

    // Agents: apply natively to .pi/agents/ via the `pi-subagents` community extension if
    // it is installed, otherwise Pi has no persona/subagent concept — degrade to skills
    // with an actionable warning.
    let agentsAppliedViaPlugin = false;
    if (source.agents.length > 0) {
      const subagentsInstalled = await this.isPackageInstalled(
        PiAdapter.SUBAGENTS_PACKAGE,
        request.projectPath,
        userRoot,
        target.scope
      );

      if (subagentsInstalled) {
        const agentsResult = await syncAgentsAsMarkdown(
          source.agents,
          agentsRoot,
          Boolean(request.dryRun),
          true,
          this.agentRenderer,
          "pi"
        );
        changed = agentsResult.changed || changed;
        fileChanges.push(...agentsResult.paths);
        modelWarnings.push(...agentsResult.warnings);
        agentsAppliedViaPlugin = true;
      } else {
        source.warnings.push(
          "Pi has no native agent/persona format. Agents are being written as skills instead. " +
            "For native .pi/agents/ support, install the community 'pi-subagents' extension: pi install npm:pi-subagents"
        );
        const agentsResult = await syncAgentsAsSkills(source.agents, skillsRoot, Boolean(request.dryRun), "pi");
        changed = agentsResult.changed || changed;
        fileChanges.push(...agentsResult.paths);
        modelWarnings.push(...agentsResult.warnings);
      }
    }

    // MCP servers: apply via the `pi-mcp-adapter` community extension if it is installed,
    // otherwise Pi has no native MCP surface — drop with an actionable warning.
    let mcpAppliedViaPlugin = false;
    if (source.mcpServers.length > 0) {
      const pluginInstalled = await this.isPackageInstalled(
        PiAdapter.MCP_ADAPTER_PACKAGE,
        request.projectPath,
        userRoot,
        target.scope
      );

      if (pluginInstalled) {
        const mcpConfigPath =
          target.scope === "project" ? resolve(request.projectPath, ".mcp.json") : resolve(userRoot, "mcp.json");
        const mcpResult = await mergeJsonObjectFile(
          mcpConfigPath,
          (existing) => renderPiMcpConfig(existing, source.mcpServers),
          Boolean(request.dryRun)
        );
        changed = mcpResult.changed || changed;
        fileChanges.push(...mcpResult.paths);
        mcpAppliedViaPlugin = true;
      } else {
        source.warnings.push(
          "Pi has no native MCP configuration surface. MCP servers were not applied. " +
            "For MCP support, install the community 'pi-mcp-adapter' extension: pi install npm:pi-mcp-adapter"
        );
      }
    }

    const appliedViaExtension: string[] = [];
    if (agentsAppliedViaPlugin) {
      appliedViaExtension.push("agents via pi-subagents");
    }
    if (mcpAppliedViaPlugin) {
      appliedViaExtension.push("MCP servers via pi-mcp-adapter");
    }
    const message =
      appliedViaExtension.length > 0
        ? `Applied Pi AGENTS.md, prompt templates, and skills; also applied ${appliedViaExtension.join(" and ")}.`
        : "Applied Pi AGENTS.md, prompt templates, and skills.";

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message,
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

  /**
   * Detects whether a given npm package is declared as an installed Pi package.
   *
   * Pi records installed packages in a `packages: [{ source: "npm:<name>[@version]" }]`
   * array inside `settings.json` — personally-installed packages live in the user-scope
   * file (`~/.pi/agent/settings.json` by default) and apply to every project, while
   * project-installed packages live in `.pi/settings.json` and apply only to that project
   * (once "project trust" is granted — a runtime state this static check cannot observe,
   * so a declared-but-untrusted package is treated as installed; this is a best-effort
   * detection, not a guarantee).
   */
  private async isPackageInstalled(
    packageName: string,
    projectPath: string,
    userRoot: string,
    targetScope: ApplyPlatformScope
  ): Promise<boolean> {
    const candidatePaths =
      targetScope === "project"
        ? [resolve(projectPath, ".pi", "settings.json"), resolve(userRoot, "settings.json")]
        : [resolve(userRoot, "settings.json")];

    for (const settingsPath of candidatePaths) {
      if (await this.settingsDeclaresPackage(settingsPath, packageName)) {
        return true;
      }
    }
    return false;
  }

  private async settingsDeclaresPackage(settingsPath: string, packageName: string): Promise<boolean> {
    try {
      const raw = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(raw) as PiSettingsPackages;
      if (!Array.isArray(parsed.packages)) {
        return false;
      }
      return parsed.packages.some((pkg) => {
        const source = pkg?.source;
        return (
          typeof source === "string" && (source === `npm:${packageName}` || source.startsWith(`npm:${packageName}@`))
        );
      });
    } catch {
      // Missing file, malformed JSON, or a permission error — treat as "not installed"
      // rather than failing the whole apply run.
      return false;
    }
  }
}
