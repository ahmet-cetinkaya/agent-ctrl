import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { homedir } from "node:os";
import { dirname, resolve, relative, extname, isAbsolute } from "node:path";
import { parse as parseYaml } from "yaml";
import { readFile, writeFile, access, mkdir, cp, readdir, rm } from "node:fs/promises";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import type {
  IPlatformAdapter,
  PlatformConfig,
  WriteConfigOptions,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { Artifact } from "@/core/domain/shared/types/Artifact";
import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { applyModelFrontmatter } from "@/infrastructure/features/apply/adapters/FrontmatterModelTransformer";
import { McpPlaceholderResolver } from "@/infrastructure/features/mcp/interpolation/McpPlaceholderResolver";
import { OpenCodeCommandRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeCommandRenderer";
import { writePrivateTextFile } from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

type LoadedRule = { name: string; path: string; content: string };

/**
 * A rule whose frontmatter declares `paths` is scoped to matching files. Claude Code honors that
 * only for files under `.claude/rules/`; inside CLAUDE.md the frontmatter is plain text.
 * Malformed frontmatter counts as unscoped, which keeps the rule in CLAUDE.md as before.
 */
function isPathScopedRule(content: string): boolean {
  const frontmatter = FRONTMATTER_PATTERN.exec(content)?.[1];
  if (frontmatter === undefined) return false;
  try {
    const data: unknown = parseYaml(frontmatter);
    return typeof data === "object" && data !== null && "paths" in data;
  } catch {
    return false;
  }
}

export class ClaudeAdapter implements IPlatformAdapter {
  readonly platformName = "claude";
  readonly configPath: string;
  readonly claudeMcpConfigPath: string;
  private readonly projectPath: string;
  /** Set when MCP servers belong to one project's local scope inside the home `.claude.json`. */
  private readonly localScopeProjectPath?: string;
  private readonly claudeRoot: string;
  private readonly placeholderResolver = new McpPlaceholderResolver();
  private readonly modelWarnings: string[] = [];

  private static readonly MANAGED_START_MARKER = "<!-- agent-ctrl:start -->";
  private static readonly MANAGED_END_MARKER = "<!-- agent-ctrl:end -->";
  /** agent-ctrl owns this folder under `.claude/rules/` and replaces it on every write. */
  private static readonly MANAGED_RULES_DIR = "agent-ctrl";
  constructor(
    projectPath: string,
    claudeHomeOverride?: string,
    configPathOverride?: string,
    localScopeProjectPath?: string
  ) {
    const claudeHome = claudeHomeOverride ?? process.env.AGENT_CTRL_CLAUDE_HOME ?? homedir();
    this.projectPath = projectPath;
    this.localScopeProjectPath = localScopeProjectPath;
    this.claudeRoot = resolve(claudeHome, ".claude");
    this.configPath = configPathOverride ?? resolve(this.claudeRoot, "CLAUDE.md");
    // MCP local-scoped servers are stored in ~/.claude.json (home directory)
    // For a project, Claude Code reads them only from there, never from <project>/.claude.json.
    const mcpHome = localScopeProjectPath ? (process.env.AGENT_CTRL_CLAUDE_HOME ?? homedir()) : claudeHome;
    this.claudeMcpConfigPath = resolve(mcpHome, ".claude.json");
  }

  /** Warnings collected while resolving `model`/`models` frontmatter during sync. */
  get collectedWarnings(): string[] {
    return this.modelWarnings;
  }

  async collectModelWarnings(config: PlatformConfig, commands?: readonly CommandArtifact[]): Promise<void> {
    await Promise.all(
      config.skills.map(async (skill) => {
        const source = await readFile(resolve(skill.path, "SKILL.md"), "utf-8");
        this.modelWarnings.push(...applyModelFrontmatter(source, "claude", "skill").warnings);
      })
    );
    await Promise.all(
      config.agents.map(async (agent) => {
        const source = await readFile(agent.path, "utf-8");
        this.modelWarnings.push(...applyModelFrontmatter(source, "claude", "agent").warnings);
      })
    );

    const commandSources = await this.resolveCommandSources(commands);
    await Promise.all(
      commandSources.map(async ({ sourcePath }) => {
        const source = await readFile(sourcePath, "utf-8");
        this.modelWarnings.push(...applyModelFrontmatter(source, "claude", "command").warnings);
      })
    );
  }

  async generateConfig(artifacts: Artifact[]): Promise<Result<PlatformConfig, SystemError>> {
    // Use mutable arrays during construction, then cast to readonly
    const rules: { name: string; path: string }[] = [];
    const skills: { name: string; path: string }[] = [];
    const agents: { name: string; path: string }[] = [];
    const mcpServers: {
      name: string;
      transport: "stdio" | "http";
      command?: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      url?: string;
      sourceFile: string;
    }[] = [];

    for (const artifact of artifacts) {
      switch (artifact.type) {
        case ArtifactType.RULE:
          rules.push({
            name: (artifact as Rule).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.SKILL:
          skills.push({
            name: (artifact as Skill).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.AGENT:
          agents.push({
            name: (artifact as Agent).id,
            path: artifact.path,
          });
          break;
      }
    }

    const config: PlatformConfig = {
      rules,
      skills,
      agents,
      mcpServers,
    };

    return ok(config);
  }

  async readExistingConfig(): Promise<Result<PlatformConfig | null, SystemError>> {
    return ok(null);
  }

  async writeConfig(config: PlatformConfig, options?: WriteConfigOptions): Promise<Result<void, SystemError>> {
    try {
      try {
        await access(this.claudeRoot);
      } catch {
        await mkdir(this.claudeRoot, { recursive: true });
      }

      // Parsed before the first write so an unreadable ~/.claude.json aborts the apply with nothing changed.
      const mcpDocumentContent = await this.buildClaudeMcpDocumentContent(config, options?.cleanExistingArtifacts);

      if (options?.cleanExistingArtifacts) {
        await this.cleanManagedArtifacts();
      }

      if (config.rules.length > 0) {
        await this.writeRules(config);
      }

      await this.syncSkills(config);
      await this.syncAgents(config);
      await this.syncCommands(options?.commands);
      await this.writeClaudeMcpDocument(mcpDocumentContent);

      return ok(undefined);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = "Failed to write Claude configuration";

      if (nodeErr.code === "EACCES") {
        message += ": Permission denied. Check file/directory permissions.";
      } else if (nodeErr.code === "ENOSPC") {
        message += ": No space left on device.";
      } else if (nodeErr.code === "EROFS") {
        message += ": Filesystem is read-only.";
      } else if (error instanceof Error) {
        message += `: ${error.message}`;
      } else {
        message += `: ${String(error)}`;
      }

      return err(new SystemError(message, ERROR_IDS.FILE_WRITE_FAILED));
    }
  }

  mergeConfigs(existing: PlatformConfig | null, newConfig: PlatformConfig): PlatformConfig {
    if (!existing) {
      return newConfig;
    }

    const mergeByName = <T extends { name: string }>(existing: readonly T[], incoming: readonly T[]): T[] => {
      const map = new Map<string, T>();
      existing.forEach((item) => map.set(item.name, item));
      incoming.forEach((item) => map.set(item.name, item));
      return Array.from(map.values());
    };

    return {
      rules: mergeByName(existing.rules, newConfig.rules),
      skills: mergeByName(existing.skills, newConfig.skills),
      agents: mergeByName(existing.agents, newConfig.agents),
      mcpServers: mergeByName(existing.mcpServers ?? [], newConfig.mcpServers ?? []),
    };
  }

  private renderClaudeMemoryFile(
    config: PlatformConfig,
    mergedRules: Array<{ name: string; path: string; content: string }>
  ): string {
    const lines: string[] = [];

    lines.push(ClaudeAdapter.MANAGED_START_MARKER);
    for (const [index, rule] of mergedRules.entries()) {
      lines.push(rule.content.trimEnd());
      if (index < mergedRules.length - 1) {
        lines.push("");
      }
    }
    if (mergedRules.length === 0) {
      lines.push("- No rules found.");
    }
    lines.push(ClaudeAdapter.MANAGED_END_MARKER);
    lines.push("");

    return lines.join("\n");
  }

  private upsertManagedSection(
    existingContent: string,
    config: PlatformConfig,
    mergedRules: Array<{ name: string; path: string; content: string }>
  ): string {
    const managed = this.renderClaudeMemoryFile(config, mergedRules).trimEnd();
    const hasManagedSection =
      existingContent.includes(ClaudeAdapter.MANAGED_START_MARKER) &&
      existingContent.includes(ClaudeAdapter.MANAGED_END_MARKER);

    if (hasManagedSection) {
      const replacedManaged = existingContent
        .replace(
          new RegExp(
            `${this.escapeForRegex(ClaudeAdapter.MANAGED_START_MARKER)}[\\s\\S]*?${this.escapeForRegex(
              ClaudeAdapter.MANAGED_END_MARKER
            )}`,
            "m"
          ),
          managed
        )
        .replace(/\s*$/, "\n");
      return replacedManaged.replace(/^# CLAUDE\.md\n\n?/, "");
    }

    const base = existingContent.replace(/^# CLAUDE\.md\n\n?/, "").trimEnd();
    if (base.length === 0) {
      return [managed, ""].join("\n");
    }

    return [base, "", managed, ""].join("\n");
  }

  private async syncSkills(config: PlatformConfig): Promise<void> {
    if (config.skills.length === 0) return;

    const skillsRoot = resolve(this.claudeRoot, "skills");
    await mkdir(skillsRoot, { recursive: true });

    // Iterate over readonly array - spread to make it mutable for iteration
    const skills = [...config.skills];
    for (const skill of skills) {
      const targetPath = resolve(skillsRoot, skill.name);
      await cp(skill.path, targetPath, { recursive: true, force: true }).catch(async () => {
        // Ensure destination path exists for filesystems that need an explicit mkdir.
        await mkdir(targetPath, { recursive: true });
        await cp(skill.path, targetPath, { recursive: true, force: true });
      });

      const skillMarkdownPath = resolve(skill.path, "SKILL.md");
      const skillMarkdown = await readFile(skillMarkdownPath, "utf-8");
      const transformedSkill = applyModelFrontmatter(skillMarkdown, "claude", "skill");
      this.modelWarnings.push(...transformedSkill.warnings);
      await writeFile(resolve(targetPath, "SKILL.md"), transformedSkill.content, "utf-8");
    }
  }

  private async syncAgents(config: PlatformConfig): Promise<void> {
    if (config.agents.length === 0) return;

    const agentsRoot = resolve(this.claudeRoot, "agents");
    await mkdir(agentsRoot, { recursive: true });

    // Iterate over readonly array - spread to make it mutable for iteration
    const agents = [...config.agents];
    for (const agent of agents) {
      const source = await readFile(agent.path, "utf-8");
      const targetPath = resolve(agentsRoot, `${agent.name}.md`);
      const normalizedName = this.normalizeAgentName(agent.name);

      const transformedAgent = applyModelFrontmatter(source, "claude", "agent");
      this.modelWarnings.push(...transformedAgent.warnings);
      const agentSource = transformedAgent.content;

      const content = agentSource.trimStart().startsWith("---")
        ? agentSource
        : [
            "---",
            `name: ${normalizedName}`,
            `description: Imported by agent-ctrl from ${agent.path}`,
            "---",
            "",
            agentSource,
          ].join("\n");

      await writeFile(targetPath, content, "utf-8");
    }
  }

  private async syncCommands(commands?: readonly CommandArtifact[]): Promise<void> {
    const commandSources = await this.resolveCommandSources(commands);
    if (commandSources.length === 0) {
      return;
    }

    const targetRoot = resolve(this.claudeRoot, "commands");
    await mkdir(targetRoot, { recursive: true });

    const renderer = new OpenCodeCommandRenderer();

    for (const { sourcePath, relativePath } of commandSources) {
      const dest = resolve(targetRoot, relativePath);
      await mkdir(dirname(dest), { recursive: true });

      // Read the source file, render it with the command renderer, then write
      const source = await readFile(sourcePath, "utf-8");
      // Convert file path to command id: remove .md extension and use forward slashes
      const id = relativePath.replace(extname(relativePath), "").replace(/\\/g, "/");
      const transformed = applyModelFrontmatter(source, "claude", "command");
      this.modelWarnings.push(...transformed.warnings);
      const rendered = renderer.renderCommand(transformed.content, id);
      await writeFile(dest, `${rendered}\n`, "utf-8");
    }
  }

  /**
   * Commands to write: the merged snapshot (project plus profile commands) when the caller has one,
   * otherwise the markdown files under the project's `.agent-ctrl/commands`.
   */
  private async resolveCommandSources(
    commands?: readonly CommandArtifact[]
  ): Promise<Array<{ sourcePath: string; relativePath: string }>> {
    if (commands) {
      return commands.map((command) => ({ sourcePath: command.path, relativePath: `${command.id}.md` }));
    }

    const commandsRoot = resolve(this.projectPath, ".agent-ctrl", "commands");
    const commandsExist = await access(commandsRoot)
      .then(() => true)
      .catch(() => false);
    if (!commandsExist) {
      return [];
    }

    const markdownFiles = await this.collectMarkdownFiles(commandsRoot);
    return markdownFiles.map((filePath) => ({ sourcePath: filePath, relativePath: relative(commandsRoot, filePath) }));
  }

  private async cleanManagedArtifacts(): Promise<void> {
    await Promise.all([
      rm(resolve(this.claudeRoot, "skills"), { recursive: true, force: true }).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }),
      rm(resolve(this.claudeRoot, "agents"), { recursive: true, force: true }).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }),
      rm(resolve(this.claudeRoot, "commands"), { recursive: true, force: true }).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }),
      rm(this.managedRulesRoot, { recursive: true, force: true }),
    ]);
  }

  private async buildClaudeMcpDocumentContent(
    config: PlatformConfig,
    cleanExistingMcp?: boolean
  ): Promise<string | undefined> {
    const mcpServers = config.mcpServers ?? [];
    if (mcpServers.length === 0 && !cleanExistingMcp) return undefined;

    // Build incoming MCP servers for both transport types
    const incomingMcpServers = Object.fromEntries(
      mcpServers.map((server) => {
        if (server.transport === "http") {
          return [
            server.name,
            {
              type: "http",
              url: server.url,
            },
          ];
        }
        return [
          server.name,
          {
            command: server.command,
            args: server.args,
            ...(server.cwd ? { cwd: server.cwd } : {}),
            ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
          },
        ];
      })
    );

    const document = await this.readClaudeMcpDocument();
    const scopeEntry = this.localScopeProjectPath
      ? this.asObject(this.asObject(document.projects)[this.localScopeProjectPath])
      : document;
    const existingMcpServers = cleanExistingMcp ? {} : this.asObject(scopeEntry.mcpServers);
    const updatedScopeEntry = { ...scopeEntry, mcpServers: { ...existingMcpServers, ...incomingMcpServers } };

    const mergedDocument = this.localScopeProjectPath
      ? {
          ...document,
          projects: { ...this.asObject(document.projects), [this.localScopeProjectPath]: updatedScopeEntry },
        }
      : updatedScopeEntry;

    return `${JSON.stringify(mergedDocument, null, 2)}\n`;
  }

  private async writeClaudeMcpDocument(content: string | undefined): Promise<void> {
    if (content === undefined) return;
    await writePrivateTextFile(this.claudeMcpConfigPath, content);
  }

  /** A missing file starts empty; an unreadable one throws so the user's live config is never overwritten. */
  private async readClaudeMcpDocument(): Promise<Record<string, unknown>> {
    const content = await readFile(this.claudeMcpConfigPath, "utf-8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (content === undefined) return {};
    const parsed = this.parseClaudeMcpDocument(content);
    if (!this.isObject(parsed)) throw new Error(`${this.claudeMcpConfigPath} does not contain a JSON object`);
    return parsed;
  }

  private parseClaudeMcpDocument(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`${this.claudeMcpConfigPath} is not valid JSON (${(error as Error).message})`);
    }
  }

  private asObject(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async collectMarkdownFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await this.collectMarkdownFiles(fullPath)));
        continue;
      }

      if (entry.isFile() && [".md", ".markdown"].includes(extname(entry.name).toLowerCase())) {
        out.push(fullPath);
      }
    }

    return out;
  }

  private normalizeAgentName(name: string): string {
    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized.length > 0 ? normalized : "agent";
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Loads environment variables from .env file for interpolation.
   * Checks both project-level and user-level config directories.
   */
  private async loadEnvVariables(): Promise<Record<string, string>> {
    // Try project-level .env first, then user-level
    const projectEnvPath = resolve(this.projectPath, ".agent-ctrl", ".env");
    const userEnvPath = resolve(homedir(), ".agent-ctrl", ".env");

    const envPath = await access(projectEnvPath)
      .then(() => projectEnvPath)
      .catch(() => userEnvPath);

    try {
      const content = await readFile(envPath, "utf-8");
      const variables: Record<string, string> = {};

      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
          continue;
        }

        const sepIndex = line.indexOf("=");
        if (sepIndex <= 0) {
          continue;
        }

        const key = line.slice(0, sepIndex).trim();
        const rawValue = line.slice(sepIndex + 1).trim();

        if (!key) {
          continue;
        }

        // Unquote values if quoted
        let value = rawValue;
        if (
          (rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'") && rawValue.length >= 2)
        ) {
          value = rawValue.slice(1, -1);
        }

        variables[key] = value;
      }

      return variables;
    } catch {
      // No .env file found, return empty variables
      return {};
    }
  }

  /** Paths of the rule files written under `.claude/rules/` for the path-scoped rules in `config`. */
  async scopedRuleFilePaths(config: PlatformConfig): Promise<string[]> {
    const rules = await this.loadRuleContents(config);
    return rules.filter((rule) => isPathScopedRule(rule.content)).map((rule) => this.managedRuleFilePath(rule.name));
  }

  private get managedRulesRoot(): string {
    return resolve(this.claudeRoot, "rules", ClaudeAdapter.MANAGED_RULES_DIR);
  }

  private managedRuleFilePath(ruleName: string): string {
    const target = resolve(this.managedRulesRoot, `${ruleName}.md`);
    const fromRoot = relative(this.managedRulesRoot, target);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      throw new Error(`Rule name '${ruleName}' resolves outside ${this.managedRulesRoot}`);
    }
    return target;
  }

  private async writeRules(config: PlatformConfig): Promise<void> {
    const rules = await this.loadRuleContents(config);
    const scopedRules = rules.filter((rule) => isPathScopedRule(rule.content));
    const unscopedRules = rules.filter((rule) => !isPathScopedRule(rule.content));

    await this.writeScopedRules(scopedRules);

    const existingContent = await readFile(this.configPath, "utf-8").catch(() => "");
    const hasManagedSection = existingContent.includes(ClaudeAdapter.MANAGED_START_MARKER);
    if (unscopedRules.length > 0 || hasManagedSection) {
      await writeFile(this.configPath, this.upsertManagedSection(existingContent, config, unscopedRules), "utf-8");
    }
  }

  private async writeScopedRules(rules: LoadedRule[]): Promise<void> {
    const targets = rules.map((rule) => ({ path: this.managedRuleFilePath(rule.name), content: rule.content }));
    await rm(this.managedRulesRoot, { recursive: true, force: true });
    for (const target of targets) {
      await mkdir(dirname(target.path), { recursive: true });
      await writeFile(target.path, target.content, "utf-8");
    }
  }

  private async loadRuleContents(config: PlatformConfig): Promise<LoadedRule[]> {
    // Load env variables for interpolation
    const envVariables = await this.loadEnvVariables();

    return Promise.all(
      config.rules.map(async (rule) => {
        let content = await readFile(rule.path, "utf-8").catch(
          (error) => `Rule content unavailable (${String(error)})`
        );

        // Apply ${VAR} placeholder resolution from .env
        if (Object.keys(envVariables).length > 0) {
          content = this.placeholderResolver.resolve(content, envVariables) as string;
        }

        return {
          name: rule.name,
          path: rule.path,
          content,
        };
      })
    );
  }
}
