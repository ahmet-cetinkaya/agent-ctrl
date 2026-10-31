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
import type { IAgentRenderer } from "@/infrastructure/features/apply/adapters/IAgentRenderer";
import type { ICommandRenderer } from "@/infrastructure/features/apply/adapters/ICommandRenderer";
import {
  mergeJsonObjectFile,
  NO_MCP_ENV_REFERENCES,
  PI_MCP_ADAPTER_ENV_REFERENCES,
  prepareMcpServersForScope,
  withoutMcpServers,
  renderPiMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncAgentsAsSkills,
  syncCommandsAsMarkdown,
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
 *
 * The Pi-family forks (senpi, `@code-yeongyu/senpi`; OmO Native, `omo-ai`) keep this engine's
 * directory layout but brand it: config lives under `~/.senpi/agent` / `~/.omo/agent` (env
 * `SENPI_CODING_AGENT_DIR` / `OMO_CODING_AGENT_DIR`, legacy `PI_CODING_AGENT_DIR` still honored),
 * project-scope directories use `.senpi/` / `.omo/` instead of `.pi/`, and MCP is BUILT INTO the
 * engine (builtin `mcp` extension reading `<agentDir>/mcp.json` user-scope and
 * `.<configDir>/mcp.json` project-scope, same `{ mcpServers: ... }` shape), so no package
 * detection gates MCP there. Instantiate via `PiAdapter.forSenpi()` / `PiAdapter.forOmoNative()`.
 */
export interface PiBrandProfile {
  /** agent-ctrl platform id (`platformName` on the adapter). */
  readonly platform: "pi" | "senpi" | "omonative";
  /** Human-facing product name used in user-visible messages. */
  readonly displayName: string;
  /** Home config directory name: `.pi`, `.senpi`, or `.omo`. */
  readonly configDirName: string;
  /** Env vars carrying an explicit agent dir override, most specific first. */
  readonly agentDirEnvNames: readonly string[];
  /** CLI command name for install hints (e.g. `pi install npm:pi-subagents`). */
  readonly installCommand: string;
  /** True when the engine ships the builtin MCP extension (no package detection needed). */
  readonly builtinMcp: boolean;
}

const PI_BRAND_PROFILE: PiBrandProfile = {
  platform: "pi",
  displayName: "Pi",
  configDirName: ".pi",
  agentDirEnvNames: ["PI_CODING_AGENT_DIR"],
  installCommand: "pi",
  builtinMcp: false,
};

const SENPI_BRAND_PROFILE: PiBrandProfile = {
  platform: "senpi",
  displayName: "Senpi",
  configDirName: ".senpi",
  // Senpi keeps pi's env var readable as a legacy prefix (LEGACY_ENV_PREFIXES = ["SENPI", "PI"]).
  agentDirEnvNames: ["SENPI_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"],
  installCommand: "senpi",
  builtinMcp: true,
};

const OMO_NATIVE_BRAND_PROFILE: PiBrandProfile = {
  platform: "omonative",
  displayName: "OmO Native",
  configDirName: ".omo",
  // omo-ai resolves OMO_ → SENPI_ → PI_ (see its lib/agent-dir.js AGENT_DIR_ENV_NAMES).
  agentDirEnvNames: ["OMO_CODING_AGENT_DIR", "SENPI_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"],
  installCommand: "omo",
  builtinMcp: true,
};

export class PiAdapter implements IApplyPlatformAdapter {
  private static readonly MCP_ADAPTER_PACKAGE = "pi-mcp-adapter";
  private static readonly SUBAGENTS_PACKAGE = "pi-subagents";
  private readonly sourceLoader = new ApplySourceLoader();
  private readonly brand: PiBrandProfile;
  readonly platformName: "pi" | "senpi" | "omonative";
  private readonly commandRenderer: ICommandRenderer;
  private readonly agentRenderer: IAgentRenderer;
  private readonly markers: { start: string; end: string };

  constructor(brand: PiBrandProfile = PI_BRAND_PROFILE) {
    this.brand = brand;
    this.platformName = brand.platform;
    // Renderers are format-level (prompt templates / pi-subagents frontmatter), shared by
    // every Pi-family fork.
    this.commandRenderer = CommandRendererFactory.getRenderer("pi");
    this.agentRenderer = AgentRendererFactory.getRenderer("pi");
    this.markers = {
      start: `<!-- agent-ctrl:${brand.platform}:start -->`,
      end: `<!-- agent-ctrl:${brand.platform}:end -->`,
    };
  }

  /** Adapter for senpi (`@code-yeongyu/senpi`), the branded engine fork with builtin MCP. */
  static forSenpi(): PiAdapter {
    return new PiAdapter(SENPI_BRAND_PROFILE);
  }

  /** Adapter for OmO Native (`omo-ai`), the omo-branded senpi distribution with builtin MCP. */
  static forOmoNative(): PiAdapter {
    return new PiAdapter(OMO_NATIVE_BRAND_PROFILE);
  }

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = this.resolveUserRoot(request);

    return {
      configPath: scope === "project" ? resolve(projectPath, "AGENTS.md") : resolve(userRoot, "AGENTS.md"),
      // Settings/<platform>/ files go to the config dir (~/.pi, ~/.senpi, ~/.omo), not the
      // agent subdir where the other artifacts live: forks treat the config dir root as
      // the settings surface (e.g. ~/.senpi/settings.json, ~/.omo/omo.jsonc).
      settingsDirectory: resolve(userRoot, ".."),
      scope,
      surface: `${this.platformName}-agents-md-prompts-skills`,
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const userRoot = this.resolveUserRoot(request);

    const promptsRoot =
      target.scope === "project"
        ? resolve(request.projectPath, this.brand.configDirName, "prompts")
        : resolve(userRoot, "prompts");
    const skillsRoot =
      target.scope === "project"
        ? resolve(request.projectPath, this.brand.configDirName, "skills")
        : resolve(userRoot, "skills");
    const agentsRoot =
      target.scope === "project"
        ? resolve(request.projectPath, this.brand.configDirName, "agents")
        : resolve(userRoot, "agents");

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

    // Clean existing managed artifacts if override is enabled (never during dry-run:
    // rm() is a destructive, un-dry-runnable action, so a --dry-run --override preview
    // must not delete anything).
    if (request.override && !request.dryRun) {
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
      this.markers,
      `No managed ${this.brand.displayName} rules were found.`,
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    // Sync commands to prompts/ as prompt templates. Pi has no folder-based namespace
    // concept (a command's slash-name is always just its filename — see
    // PiCommandRenderer's doc comment), so a namespaced source id like "ac/plan" is
    // encoded into the filename with a "-" separator ("ac-plan.md") rather than fully
    // flattened to "plan.md": this keeps the namespace visible and avoids distinct
    // namespaced commands silently colliding on the same output file.
    if (source.commands.length > 0) {
      const commandsResult = await syncCommandsAsMarkdown(
        source.commands,
        promptsRoot,
        Boolean(request.dryRun),
        this.commandRenderer,
        "-",
        this.platformName
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
        this.platformName
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
          `${this.brand.displayName} has no native agent/persona format. Agents are being written as skills instead. ` +
            `For native ${this.brand.configDirName}/agents/ support, install the community 'pi-subagents' extension: ${this.brand.installCommand} install npm:pi-subagents`
        );
        const agentsResult = await syncAgentsAsSkills(
          source.agents,
          skillsRoot,
          Boolean(request.dryRun),
          this.platformName
        );
        changed = agentsResult.changed || changed;
        fileChanges.push(...agentsResult.paths);
        modelWarnings.push(...agentsResult.warnings);
      }
    }

    // MCP servers. The senpi/OmO forks ship MCP built into the engine (builtin `mcp`
    // extension reading `<agentDir>/mcp.json` user-scope and `.<configDir>/mcp.json`
    // project-scope), so MCP always applies there. Upstream Pi has no native MCP
    // surface: it applies via the `pi-mcp-adapter` community extension when detected,
    // otherwise MCP is dropped with an actionable warning.
    let mcpAppliedViaPlugin = false;
    let mcpAppliedNatively = false;
    if (source.mcpServers.length > 0) {
      const pluginInstalled = this.brand.builtinMcp
        ? true
        : await this.isPackageInstalled(PiAdapter.MCP_ADAPTER_PACKAGE, request.projectPath, userRoot, target.scope);

      if (pluginInstalled) {
        // User scope always lands in <agentDir>/mcp.json. Project scope differs: the
        // forks' builtin MCP reads .<configDir>/mcp.json, while pi-mcp-adapter reads
        // Claude-style .mcp.json directly in the project root.
        const mcpConfigPath =
          target.scope === "user"
            ? resolve(userRoot, "mcp.json")
            : this.brand.builtinMcp
              ? resolve(request.projectPath, this.brand.configDirName, "mcp.json")
              : resolve(request.projectPath, ".mcp.json");
        // The forks' builtin MCP documents no run-time substitution, unlike pi-mcp-adapter.
        const mcp = prepareMcpServersForScope(
          target.scope,
          source.mcpServers,
          this.brand.builtinMcp ? NO_MCP_ENV_REFERENCES : PI_MCP_ADAPTER_ENV_REFERENCES,
          this.platformName
        );
        source.warnings.push(...mcp.warnings);
        const mcpResult = await mergeJsonObjectFile(
          mcpConfigPath,
          (existing) => renderPiMcpConfig(withoutMcpServers(existing, mcp.withheldNames), mcp.servers),
          Boolean(request.dryRun)
        );
        changed = mcpResult.changed || changed;
        fileChanges.push(...mcpResult.paths);
        if (this.brand.builtinMcp) {
          mcpAppliedNatively = true;
        } else {
          mcpAppliedViaPlugin = true;
        }
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
    if (mcpAppliedNatively) {
      appliedViaExtension.push("MCP servers via builtin MCP config");
    }
    const message =
      appliedViaExtension.length > 0
        ? `Applied ${this.brand.displayName} AGENTS.md, prompt templates, and skills; also applied ${appliedViaExtension.join(" and ")}.`
        : `Applied ${this.brand.displayName} AGENTS.md, prompt templates, and skills.`;

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
        // Report only servers actually applied — when pi-mcp-adapter is absent (upstream
        // Pi) the servers are dropped with a warning, and counting them here would make
        // the CLI summary claim they were synced.
        mcpServers: mcpAppliedViaPlugin || mcpAppliedNatively ? source.mcpServers.length : 0,
      },
      fileChanges,
      warnings: [...source.warnings, ...modelWarnings],
    };
  }

  /**
   * Resolves this brand's user-scope configuration root: an explicit request override
   * wins, then the brand's documented `*_CODING_AGENT_DIR` env vars (most specific
   * prefix first), then the default `~/<configDir>/agent` (see https://pi.dev —
   * configuration docs — for upstream Pi; senpi/omo resolve identically under their
   * own config dir names).
   */
  private resolveUserRoot(request?: ApplyIntegrationRequest): string {
    if (request?.userConfigRootPath) {
      return resolve(request.userConfigRootPath);
    }
    for (const envName of this.brand.agentDirEnvNames) {
      const envDir = process.env[envName];
      if (envDir && envDir.trim().length > 0) {
        return resolve(envDir);
      }
    }
    return resolve(homedir(), this.brand.configDirName, "agent");
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
        ? [resolve(projectPath, this.brand.configDirName, "settings.json"), resolve(userRoot, "settings.json")]
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
