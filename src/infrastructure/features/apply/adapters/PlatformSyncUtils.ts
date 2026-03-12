import { dirname, relative, resolve } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { mergeManagedTextSection, type ManagedTextSectionMarkers } from "./ManagedTextSection";
import type { ApplyMcpServer } from "./ApplySourceLoader";
import { CommandRendererFactory } from "./CommandRendererFactory";
import type { ICommandRenderer, ParsedMarkdownPrompt } from "./ICommandRenderer";
import { McpConfigRendererFactory } from "./McpConfigRendererFactory";

export interface FileSyncResult {
  changed: boolean;
  paths: string[];
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
  flattenSeparator?: string
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("opencode");
  const rendered = await Promise.all(
    commands.map(async (command) => {
      const source = await readFile(command.path, "utf-8");
      const relativePath = flattenSeparator
        ? `${command.id.replaceAll("/", flattenSeparator)}${commandRenderer.fileExtension}`
        : `${command.id}${commandRenderer.fileExtension}`;

      return {
        relativePath,
        content: commandRenderer.renderCommand(source, command.id),
      };
    })
  );
  return syncRenderedFiles(targetRoot, rendered, dryRun);
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

export async function syncCommandsAsWorkflows(
  commands: CommandArtifact[],
  targetRoot: string,
  dryRun: boolean,
  renderer?: ICommandRenderer
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("workflow");
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

export async function syncSkills(
  skills: Skill[],
  targetRoot: string,
  dryRun: boolean,
  compatibility?: string,
  renderer?: ICommandRenderer
): Promise<FileSyncResult> {
  let changed = false;
  const paths: string[] = [];
  for (const skill of skills) {
    const transformedFiles = await buildSkillFiles(skill, compatibility, renderer);
    const result = await syncRenderedFiles(resolve(targetRoot, skill.id), transformedFiles, dryRun, true);
    changed = result.changed || changed;
    paths.push(...result.paths);
  }
  return { changed, paths };
}

export async function syncAgentsAsMarkdown(
  agents: Agent[],
  targetRoot: string,
  dryRun: boolean,
  withFrontmatter: boolean,
  renderer?: ICommandRenderer
): Promise<FileSyncResult> {
  const commandRenderer = renderer ?? CommandRendererFactory.getRenderer("opencode");
  const rendered = await Promise.all(
    agents.map(async (agent) => {
      const source = await readFile(agent.path, "utf-8");
      return {
        relativePath: `${agent.id}${commandRenderer.fileExtension}`,
        content: withFrontmatter ? commandRenderer.renderCommand(source, agent.id) : source.trimEnd(),
      };
    })
  );
  return syncRenderedFiles(targetRoot, rendered, dryRun);
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
    await writeTextFile(filePath, nextContent);
  }

  return {
    changed,
    paths: changed ? [filePath] : [],
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
    await writeTextFile(filePath, merged.content);
  }

  return {
    changed: merged.status === "success",
    paths: merged.status === "success" ? [filePath] : [],
  };
}

export function renderOpencodeMcpConfig(
  existing: Record<string, unknown>,
  servers: ApplyMcpServer[]
): Record<string, unknown> {
  const renderer = McpConfigRendererFactory.getRenderer("opencode");
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
  renderer?: ICommandRenderer
): Promise<Array<{ relativePath: string; content: string }>> {
  const files = await collectFiles(skill.path);
  const out: Array<{ relativePath: string; content: string }> = [];

  for (const filePath of files) {
    const rel = relative(skill.path, filePath);
    const source = await readFile(filePath, "utf-8");
    out.push({
      relativePath: rel,
      content: rel === "SKILL.md" ? renderSkillMarkdown(source, skill.id, compatibility, renderer) : source,
    });
  }

  return out;
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

  return { changed, paths };
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
  const lines = ["---", `name: ${skillName}`, `description: ${parsed.description}`];
  if (compatibility) {
    lines.push(`compatibility: ${compatibility}`);
  }
  lines.push("---", "", source.trim());
  return lines.join("\n");
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
