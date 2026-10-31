import { dirname, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { mergeManagedTextSection, type ManagedTextSectionMarkers } from "./ManagedTextSection";
import type { ApplyMcpServer } from "./ApplySourceLoader";
import type { McpUnresolvedFields } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { CommandRendererFactory } from "./CommandRendererFactory";
import type { ICommandRenderer, ParsedMarkdownPrompt } from "./ICommandRenderer";
import { AgentRendererFactory } from "./AgentRendererFactory";
import type { IAgentRenderer } from "./IAgentRenderer";
import { McpConfigRendererFactory } from "./McpConfigRendererFactory";
import { applyModelFrontmatter } from "./FrontmatterModelTransformer";

export interface FileSyncResult {
  changed: boolean;
  paths: string[];
  warnings: string[];
}

export interface PlatformTarget {
  configPath: string;
  scope: ApplyPlatformScope;
  surface: string;
}

export function resolveApplyScope(
  preferredScope: ApplyPlatformScope | undefined,
  defaultScope: ApplyPlatformScope,
  supportsUserScope: boolean
): ApplyPlatformScope {
  const requested =
    preferredScope ??
    (((process.env.AGENT_CTRL_APPLY_SCOPE ?? "").toLowerCase() as ApplyPlatformScope | "") || undefined) ??
    defaultScope;

  if (requested === "user" && !supportsUserScope) {
    throw new Error("This platform does not expose a documented file-backed user configuration surface.");
  }

  return requested === "user" ? "user" : "project";
}

export function toStatus(changed: boolean): ApplyPlatformStatus {
  return changed ? "success" : "unchanged";
}

export async function upsertManagedRuleDocument(
  filePath: string,
  rules: Rule[],
  markers: ManagedTextSectionMarkers,
  emptyMessage: string,
  dryRun: boolean
): Promise<FileSyncResult> {
  const sections = await Promise.all(
    rules.map(async (rule) => {
      const content = (await readFile(rule.path, "utf-8")).trim();
      return [`## ${humanizeSegment(rule.id)}`, "", content].join("\n");
    })
  );
  const body = sections.length > 0 ? sections.join("\n\n") : emptyMessage;
  const existing = await readTextFileOrNull(filePath);
  const merged = mergeManagedTextSection(existing, body, markers);

  if (!dryRun && merged.status === "success") {
    await writeTextFile(filePath, merged.content);
  }

  return {
    changed: merged.status === "success",
    paths: merged.status === "success" ? [filePath] : [],
    warnings: [],
  };
}

export async function syncRulesAsFiles(
  rules: Rule[],
  targetRoot: string,
  renderer: (rule: Rule, source: string) => { relativePath: string; content: string },
  dryRun: boolean
): Promise<FileSyncResult> {
  const rendered = await Promise.all(
    rules.map(async (rule) => {
      const source = await readFile(rule.path, "utf-8");
      return renderer(rule, source);
    })
  );
  return syncRenderedFiles(targetRoot, rendered, dryRun);
}

export async function syncCommandsAsMarkdown(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer,
  flattenSeparator?: string,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("opencode");
  const warnings: string[] = [];
  const rendered = await Promise.all(
    commands.map(async (command) => {
      let source = await readFile(command.path, "utf-8");
      if (platform) {
        const transformed = applyModelFrontmatter(source, platform, "command");
        source = transformed.content;
        warnings.push(...transformed.warnings);
      }
      const relativePath = flattenSeparator
        ? `${command.id.replaceAll("/", flattenSeparator)}${commandRenderer.fileExtension}`
        : `${command.id}${commandRenderer.fileExtension}`;

      return {
        relativePath,
        content: commandRenderer.renderCommand(source, command.id),
      };
    })
  );
  const result = await syncRenderedFiles(targetRoot, rendered, dryRun);
  return { ...result, warnings };
}

export async function syncCommandsAsMarkdownFlattened(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("opencode");
  const warnings: string[] = [];
  const rendered = await Promise.all(
    commands.map(async (command) => {
      let source = await readFile(command.path, "utf-8");
      if (platform) {
        const transformed = applyModelFrontmatter(source, platform, "command");
        source = transformed.content;
        warnings.push(...transformed.warnings);
      }
      const relativePath = `${command.id.split("/").pop()}${commandRenderer.fileExtension}`;

      return {
        relativePath,
        content: commandRenderer.renderCommand(source, command.id),
      };
    })
  );

  // Flattening keeps only the last path segment, so distinct namespaced commands can
  // collide on the same output filename. Detect and warn instead of letting the last
  // writer silently win.
  const names = new Map<string, string[]>();
  for (const command of commands) {
    const leaf = command.id.split("/").pop() as string;
    names.set(leaf, [...(names.get(leaf) ?? []), command.id]);
  }
  for (const [leaf, ids] of names) {
    if (ids.length > 1) {
      warnings.push(
        `commands: ${ids.length} commands flatten to the same file name '${leaf}${commandRenderer.fileExtension}' (${ids.join(", ")}) — only the last one wins. Rename them or keep unique leaf names.`
      );
    }
  }

  const result = await syncRenderedFiles(targetRoot, rendered, dryRun);
  return { ...result, warnings };
}

export async function syncSkillsAsCommands(
  skills: Skill[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("opencode");
  const warnings: string[] = [];
  const rendered = await Promise.all(
    skills.map(async (skill) => {
      const skillMdPath = resolve(skill.path, "SKILL.md");
      let skillFile = await readFile(skillMdPath, "utf-8");
      if (platform) {
        const transformed = applyModelFrontmatter(skillFile, platform, "skill");
        skillFile = transformed.content;
        warnings.push(...transformed.warnings);
      }
      const relativePath = `${skill.id.split("/").pop()}${commandRenderer.fileExtension}`;

      return {
        relativePath,
        content: commandRenderer.renderCommand(skillFile, skill.id),
      };
    })
  );
  const result = await syncRenderedFiles(targetRoot, rendered, dryRun);
  return { ...result, warnings };
}

export async function syncCommandsAsToml(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("gemini");
  const rendered = await Promise.all(
    commands.map(async (command) => {
      const source = await readFile(command.path, "utf-8");
      return {
        relativePath: `${command.id}${commandRenderer.fileExtension}`,
        content: commandRenderer.renderCommand(source, command.id),
      };
    })
  );
  return syncRenderedFiles(targetRoot, rendered, dryRun);
}

export async function syncCommandsAsSkills(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const command of commands) {
    let source = await readFile(command.path, "utf-8");
    if (platform) {
      const transformed = applyModelFrontmatter(source, platform, "skill");
      source = transformed.content;
      warnings.push(...transformed.warnings);
    }
    const skillName = command.id.replaceAll("/", "-");
    const parsed = parseMarkdownPrompt(source, command.id);

    const skillMd = [
      "---",
      `name: ${skillName}`,
      `description: ${toSafeYamlScalar(parsed.description)}`,
      "---",
      "",
      source.trim(),
    ].join("\n");

    const skillDir = resolve(targetRoot, skillName);
    const targetPath = resolve(skillDir, "SKILL.md");
    const existing = await readTextFileOrNull(targetPath);

    if (normalizeText(existing ?? "") === normalizeText(skillMd)) {
      continue;
    }

    changed = true;
    paths.push(targetPath);
    if (!dryRun) {
      await writeTextFile(targetPath, skillMd);
    }
  }

  return { changed, paths, warnings };
}

export async function syncCommandsAsWorkflows(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("workflow");
  const warnings: string[] = [];
  const rendered = await Promise.all(
    commands.map(async (command) => {
      let source = await readFile(command.path, "utf-8");
      if (platform) {
        const transformed = applyModelFrontmatter(source, platform, "command");
        source = transformed.content;
        warnings.push(...transformed.warnings);
      }
      return {
        relativePath: `${command.id}${commandRenderer.fileExtension}`,
        content: commandRenderer.renderCommand(source, command.id),
      };
    })
  );
  const result = await syncRenderedFiles(targetRoot, rendered, dryRun);
  return { ...result, warnings };
}

export async function syncSkills(
  skills: Skill[],
  targetRoot: string,
  dryRun: boolean,
  compatibility?: string,
  renderer?: ICommandRenderer,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];
  const warnings: string[] = [];
  for (const skill of skills) {
    const transformedFiles = await buildSkillFiles(skill, compatibility, renderer, platform);
    const result = await syncRenderedFiles(resolve(targetRoot, skill.id), transformedFiles.files, dryRun, true);
    changed = result.changed || changed;
    paths.push(...result.paths);
    warnings.push(...transformedFiles.warnings);
  }
  return { changed, paths, warnings };
}

export async function syncAgentsAsCodexToml(
  agents: Agent[],
  targetRoot: string,
  dryRun: boolean,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const agent of agents) {
    const source = await readFile(agent.path, "utf-8");
    const parsed = parseMarkdownPrompt(source, agent.id);
    const agentName = agent.id.replaceAll("/", "-");

    let modelLine: string | null = null;
    if (platform) {
      const transformed = applyModelFrontmatter(source, platform, "agent");
      warnings.push(...transformed.warnings);
      modelLine = getFrontmatterScalar(transformed.content, "model");
    }

    const tomlContent = buildCodexAgentToml(agentName, parsed, modelLine);
    const targetPath = resolve(targetRoot, `${agentName}.toml`);
    const existing = await readTextFileOrNull(targetPath);

    if (normalizeText(existing ?? "") === normalizeText(tomlContent)) {
      continue;
    }

    changed = true;
    paths.push(targetPath);
    if (!dryRun) {
      await writeTextFile(targetPath, tomlContent);
    }
  }

  return { changed, paths, warnings };
}

export async function syncAgentsAsSkills(
  agents: Agent[],
  targetRoot: string,
  dryRun: boolean,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const agent of agents) {
    let source = await readFile(agent.path, "utf-8");
    if (platform) {
      const transformed = applyModelFrontmatter(source, platform, "skill");
      source = transformed.content;
      warnings.push(...transformed.warnings);
    }
    const skillName = agent.id.replaceAll("/", "-");
    const skillMd = [
      "---",
      `name: ${skillName}`,
      `description: ${toSafeYamlScalar(`Custom agent: ${agent.id}`)}`,
      "---",
      "",
      source.trim(),
    ].join("\n");

    const skillDir = resolve(targetRoot, skillName);
    const targetPath = resolve(skillDir, "SKILL.md");
    const existing = await readTextFileOrNull(targetPath);

    if (normalizeText(existing ?? "") === normalizeText(skillMd)) {
      continue;
    }

    changed = true;
    paths.push(targetPath);
    if (!dryRun) {
      await writeTextFile(targetPath, skillMd);
    }
  }

  return { changed, paths, warnings };
}

export async function syncAgentsAsMarkdown(
  agents: Agent[],
  targetRoot: string,
  dryRun: boolean,
  withFrontmatter: boolean,
  agentRenderer?: IAgentRenderer,
  platform?: SupportedApplyPlatform
): Promise<FileSyncResult> {
  const renderer = agentRenderer ?? AgentRendererFactory.getRenderer("forgecode");
  const warnings: string[] = [];
  const rendered = await Promise.all(
    agents.map(async (agent) => {
      let source = await readFile(agent.path, "utf-8");
      if (platform) {
        const transformed = applyModelFrontmatter(source, platform, "agent");
        source = transformed.content;
        warnings.push(...transformed.warnings);
      }
      return {
        relativePath: `${agent.id}${renderer.fileExtension}`,
        content: withFrontmatter ? renderer.renderAgent(source, agent.id) : source.trimEnd(),
      };
    })
  );
  const result = await syncRenderedFiles(targetRoot, rendered, dryRun);
  return { ...result, warnings };
}

export async function mergeJsonObjectFile(
  filePath: string,
  update: (current: Record<string, unknown>) => Record<string, unknown>,
  dryRun: boolean
): Promise<FileSyncResult> {
  const existing = await readTextFileOrNull(filePath);
  const document = existing ? parseJsonWithComments(existing) : {};
  const next = update(document);
  const nextContent = `${JSON.stringify(next, null, 2)}\n`;
  const changed = normalizeText(existing ?? "") !== normalizeText(nextContent);

  if (changed && !dryRun) {
    await writePrivateTextFile(filePath, nextContent);
  }

  return {
    changed,
    paths: changed ? [filePath] : [],
    warnings: [],
  };
}

export async function mergeManagedTomlSection(
  filePath: string,
  body: string,
  markers: ManagedTextSectionMarkers,
  dryRun: boolean
): Promise<FileSyncResult> {
  const existing = await readTextFileOrNull(filePath);
  const merged = mergeManagedTextSection(existing, body, markers);

  if (merged.status === "success" && !dryRun) {
    await writePrivateTextFile(filePath, merged.content);
  }

  return {
    changed: merged.status === "success",
    paths: merged.status === "success" ? [filePath] : [],
    warnings: [],
  };
}

const PLACEHOLDER_PATTERN = /\$\{([^}]+)\}/g;
const SINGLE_PLACEHOLDER_PATTERN = new RegExp(PLACEHOLDER_PATTERN.source);

type McpReferenceField = keyof McpUnresolvedFields;

/** How a platform reads an environment variable from its own MCP config file at run time. */
export interface McpEnvReferenceSupport {
  /** The platform's syntax for one variable, for example `{env:NAME}`. */
  readonly toReference: (variableName: string) => string;
  /** The fields where the platform documents the substitution. */
  readonly fields: readonly McpReferenceField[];
}

const ALL_MCP_REFERENCE_FIELDS: readonly McpReferenceField[] = ["command", "args", "env", "url"];

/** For platforms that document no run-time substitution in their project MCP file. */
export const NO_MCP_ENV_REFERENCES: McpEnvReferenceSupport = { toReference: (name) => name, fields: [] };

/** OpenCode, and its fork Kilo: `{env:VAR}` in any config string; an unset variable becomes empty. */
export const OPENCODE_ENV_REFERENCES: McpEnvReferenceSupport = {
  toReference: (name) => `{env:${name}}`,
  fields: ALL_MCP_REFERENCE_FIELDS,
};

/** Gemini CLI and its fork Qwen Code document `${VAR}` for MCP server `env` values only. */
export const GEMINI_ENV_REFERENCES: McpEnvReferenceSupport = { toReference: (name) => `\${${name}}`, fields: ["env"] };

/** The pi-mcp-adapter extension documents `${VAR}` in `env` and `url`. */
export const PI_MCP_ADAPTER_ENV_REFERENCES: McpEnvReferenceSupport = {
  toReference: (name) => `\${${name}}`,
  fields: ["env", "url"],
};

export interface ScopedMcpServers {
  servers: ApplyMcpServer[];
  /** Servers left out of the project file; an entry an earlier apply wrote for them must go too. */
  withheldNames: string[];
  warnings: string[];
}

/**
 * Prepares the servers for the config file of the given scope. A project file is meant to be
 * committed, so there each `${VAR}` becomes the platform's run-time reference, and a server with a
 * placeholder in a field the platform cannot resolve is left out: its resolved value is a secret.
 */
export function prepareMcpServersForScope(
  scope: ApplyPlatformScope,
  servers: ApplyMcpServer[],
  support: McpEnvReferenceSupport,
  platformLabel: string
): ScopedMcpServers {
  if (scope !== "project") return { servers, withheldNames: [], warnings: [] };

  const written: ApplyMcpServer[] = [];
  const withheldNames: string[] = [];
  for (const server of servers) {
    const referenced = withEnvReferences(server, support);
    if (referenced) written.push(referenced);
    else withheldNames.push(server.name);
  }
  return {
    servers: written,
    withheldNames,
    warnings: describeProjectMcpServers(written, withheldNames, platformLabel),
  };
}

/** OpenCode and Kilo keep MCP servers under `mcp`; the other JSON platforms under `mcpServers`. */
const MCP_SERVER_MAP_KEYS = ["mcp", "mcpServers"] as const;

/** Removes the named servers, so a resolved secret an earlier apply wrote does not stay in the file. */
export function withoutMcpServers(document: Record<string, unknown>, serverNames: string[]): Record<string, unknown> {
  if (serverNames.length === 0) return document;

  const next = { ...document };
  for (const key of MCP_SERVER_MAP_KEYS) {
    const serverMap = next[key];
    if (typeof serverMap !== "object" || serverMap === null || Array.isArray(serverMap)) continue;
    next[key] = Object.fromEntries(Object.entries(serverMap).filter(([name]) => !serverNames.includes(name)));
  }
  return next;
}

function describeProjectMcpServers(
  written: ApplyMcpServer[],
  withheldNames: string[],
  platformLabel: string
): string[] {
  const warnings: string[] = [];
  const variableNames = collectMcpPlaceholderNames(written);
  if (variableNames.length > 0) {
    warnings.push(
      `${platformLabel} reads these MCP values from the environment at run time; export them before starting ${platformLabel}: ${variableNames.join(", ")}`
    );
  }
  if (withheldNames.length > 0) {
    warnings.push(
      `Skipped MCP servers in the project ${platformLabel} config: ${withheldNames.join(", ")}. ` +
        `${platformLabel} cannot read their \${VAR} values from the environment there, and the resolved values are secrets that must not be committed. Apply them with --user instead.`
    );
  }
  return warnings;
}

/** Undefined when a placeholder sits in a field the platform cannot resolve at run time. */
function withEnvReferences(server: ApplyMcpServer, support: McpEnvReferenceSupport): ApplyMcpServer | undefined {
  const unresolved = server.unresolved;
  if (!unresolved) return server;

  const fieldsWithPlaceholders = (Object.keys(unresolved) as McpReferenceField[]).filter((field) =>
    hasPlaceholder(unresolved[field])
  );
  if (fieldsWithPlaceholders.length === 0) return server;
  if (fieldsWithPlaceholders.some((field) => !support.fields.includes(field))) return undefined;

  const toReferences = (value: string): string =>
    value.replace(PLACEHOLDER_PATTERN, (_match, name: string) => support.toReference(name));
  return {
    ...server,
    command: unresolved.command !== undefined ? toReferences(unresolved.command) : server.command,
    args: unresolved.args?.map(toReferences) ?? server.args,
    env: unresolved.env
      ? Object.fromEntries(Object.entries(unresolved.env).map(([key, value]) => [key, toReferences(value)]))
      : server.env,
    url: unresolved.url !== undefined ? toReferences(unresolved.url) : server.url,
  };
}

function hasPlaceholder(value: McpUnresolvedFields[McpReferenceField]): boolean {
  return toFieldStrings(value).some((text) => SINGLE_PLACEHOLDER_PATTERN.test(text));
}

function toFieldStrings(value: McpUnresolvedFields[McpReferenceField]): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  return Object.values(value ?? {});
}

/** Names of the `${VAR}` placeholders the servers use, sorted and without duplicates. */
function collectMcpPlaceholderNames(servers: ApplyMcpServer[]): string[] {
  const names = new Set<string>();
  for (const { unresolved } of servers) {
    const values = Object.values(unresolved ?? {}).flatMap(toFieldStrings);
    for (const value of values) {
      for (const match of value.matchAll(PLACEHOLDER_PATTERN)) names.add(match[1]);
    }
  }
  return [...names].sort();
}

export function renderOpencodeMcpConfig(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const renderer = McpConfigRendererFactory.getRenderer("opencode");
  return renderer.renderConfig(existing, servers);
}

export function renderForgeCodeMcpConfig(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const renderer = McpConfigRendererFactory.getRenderer("forgecode");
  return renderer.renderConfig(existing, servers);
}

export function renderPiMcpConfig(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const renderer = McpConfigRendererFactory.getRenderer("pi");
  return renderer.renderConfig(existing, servers);
}

export function renderSettingsMcpConfig(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const renderer = McpConfigRendererFactory.getRenderer("settings");
  return renderer.renderConfig(existing, servers);
}

export function renderCodexMcpServers(servers: ApplyMcpServer[]): string {
  const renderer = McpConfigRendererFactory.getRenderer("codex");
  if (!renderer.renderToString) {
    throw new Error("Codex MCP config renderer does not support renderToString()");
  }
  return renderer.renderToString(servers);
}

export function countUnsupportedArtifacts(
  platform: string,
  snapshot: { commands?: unknown[]; skills?: unknown[]; agents?: unknown[]; mcpServers?: unknown[] },
  unsupported: Array<keyof typeof snapshot>
): string[] {
  const labels: Record<string, string> = {
    commands: "commands",
    skills: "skills",
    agents: "agents",
    mcpServers: "MCP servers",
  };

  return unsupported
    .map((key) => {
      const value = snapshot[key];
      const count = Array.isArray(value) ? value.length : 0;
      return count > 0 ? `${platform} does not have a documented apply target for ${labels[key]}.` : null;
    })
    .filter((value): value is string => value !== null);
}

async function buildSkillFiles(
  skill: Skill,
  compatibility?: string,
  renderer?: ICommandRenderer,
  platform?: SupportedApplyPlatform
): Promise<{ files: Array<{ relativePath: string; content: string }>; warnings: string[] }> {
  const files = await collectFiles(skill.path);
  const out: Array<{ relativePath: string; content: string }> = [];
  const warnings: string[] = [];

  for (const filePath of files) {
    const rel = relative(skill.path, filePath);
    let source = await readFile(filePath, "utf-8");
    if (platform && rel === "SKILL.md") {
      const transformed = applyModelFrontmatter(source, platform, "skill");
      source = transformed.content;
      warnings.push(...transformed.warnings);
    }
    out.push({
      relativePath: rel,
      content: rel === "SKILL.md" ? renderSkillMarkdown(source, skill.id, compatibility, renderer) : source,
    });
  }

  return { files: out, warnings };
}

async function syncRenderedFiles(
  targetRoot: string,
  files: Array<{ relativePath: string; content: string }>,
  dryRun: boolean,
  relativeToRoot = false
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];

  for (const file of files) {
    const targetPath = relativeToRoot ? resolve(targetRoot, file.relativePath) : resolve(targetRoot, file.relativePath);
    const existing = await readTextFileOrNull(targetPath);
    if (normalizeText(existing ?? "") === normalizeText(file.content)) {
      continue;
    }

    changed = true;
    paths.push(targetPath);
    if (!dryRun) {
      await writeTextFile(targetPath, `${file.content.trimEnd()}\n`);
    }
  }

  return { changed, paths, warnings: [] };
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(filePath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(filePath);
    }
  }

  return files;
}

async function readTextFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

const PRIVATE_FILE_MODE = 0o600;

/**
 * Writes a private temp file next to the target and renames it over, so a crash or a concurrent
 * writer never sees a truncated file, and an existing file's mode is tightened too: MCP configs
 * hold resolved secrets.
 */
export async function writePrivateTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  // Rename over the symlink target, not the link, so a dotfile-managed config stays a link.
  const targetPath = await realpath(filePath).catch(() => filePath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf-8", mode: PRIVATE_FILE_MODE });
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function renderSkillMarkdown(
  source: string,
  skillName: string,
  compatibility?: string,
  renderer?: ICommandRenderer
): string {
  if (source.trimStart().startsWith("---")) {
    return source.trimEnd();
  }

  void renderer; // Reserved for future platform-specific skill rendering
  const parsed = parseMarkdownPrompt(source, skillName);
  const lines = ["---", `name: ${skillName}`, `description: ${toSafeYamlScalar(parsed.description)}`];
  if (compatibility) {
    lines.push(`compatibility: ${compatibility}`);
  }
  lines.push("---", "", source.trim());
  return lines.join("\n");
}

function buildCodexAgentToml(name: string, parsed: ParsedMarkdownPrompt, modelLine?: string | null): string {
  const lines = [`name = "${escapeTomlString(name)}"`, `description = "${escapeTomlString(parsed.description)}"`];
  if (modelLine) {
    lines.push(`model = "${escapeTomlString(modelLine)}"`);
  }
  lines.push(`developer_instructions = """`, parsed.body || parsed.title, `"""`, "");
  return lines.join("\n");
}

function getFrontmatterScalar(source: string, key: string): string | null {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const value = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return value?.[1].trim() ?? null;
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Renders a value as a safe single-line YAML scalar for hand-built frontmatter blocks.
 *
 * A plain (unquoted) YAML scalar cannot contain a colon followed by whitespace, a space
 * followed by `#`, a leading indicator character, or an embedded newline — each is ambiguous
 * with mapping/comment/flow syntax. Some parsers (e.g. plain js-yaml) tolerate this in practice,
 * but stricter ones reject it outright (seen in the wild as "Nested mappings are not allowed in
 * compact mappings" for an unquoted `description: Custom agent: <name>` value). Quoting is only
 * applied when actually needed, so already-safe values keep their existing unquoted rendering.
 */
function toSafeYamlScalar(value: string): string {
  const needsQuoting =
    value === "" ||
    /^\s|\s$/.test(value) ||
    /: |:$/.test(value) ||
    / #/.test(value) ||
    /\n/.test(value) ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(value);

  if (!needsQuoting) {
    return value;
  }

  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function parseMarkdownPrompt(source: string, id: string): ParsedMarkdownPrompt {
  const trimmed = source.trim();
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0] ?? "";
  const title = firstLine.startsWith("# ") ? firstLine.replace(/^#\s+/, "").trim() : humanizeSegment(id);
  const body = firstLine.startsWith("# ") ? lines.slice(1).join("\n").trim() || trimmed : trimmed;
  const description =
    title
      .replace(/\b(command|workflow|agent|skill)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || humanizeSegment(id);

  return {
    title,
    description,
    body,
  };
}

function humanizeSegment(value: string): string {
  return value
    .split("/")
    .map((segment) =>
      segment
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    )
    .join(" / ");
}

function parseJsonWithComments(content: string): Record<string, unknown> {
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, "");
  const parsed = JSON.parse(withoutLineComments) as unknown;
  if (!isObject(parsed)) {
    throw new Error("Configuration file must contain a top-level JSON object.");
  }
  return parsed;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
