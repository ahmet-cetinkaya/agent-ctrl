import { homedir } from "node:os";
import { dirname, resolve, relative, extname } from "node:path";
import { readFile, writeFile, access, mkdir, cp, readdir, rm } from "node:fs/promises";
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

export class ClaudeAdapter implements IPlatformAdapter {
  readonly platformName = "claude";
  readonly configPath: string;
  private readonly statePath: string;
  private readonly projectPath: string;
  private readonly claudeRoot: string;

  private static readonly MANAGED_START_MARKER = "<!-- agent-ctrl:start -->";
  private static readonly MANAGED_END_MARKER = "<!-- agent-ctrl:end -->";

  constructor(projectPath: string) {
    const claudeHome = process.env.AGENT_CTRL_CLAUDE_HOME || homedir();
    this.projectPath = projectPath;
    this.claudeRoot = resolve(claudeHome, ".claude");
    this.configPath = resolve(this.claudeRoot, "CLAUDE.md");
    this.statePath = resolve(this.claudeRoot, ".agent-ctrl.json");
  }

  async generateConfig(artifacts: Artifact[]): Promise<PlatformConfig> {
    const config: PlatformConfig = {
      rules: [],
      skills: [],
      agents: [],
    };

    for (const artifact of artifacts) {
      switch (artifact.type) {
        case ArtifactType.RULE:
          config.rules.push({
            name: (artifact as Rule).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.SKILL:
          config.skills.push({
            name: (artifact as Skill).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.AGENT:
          config.agents.push({
            name: (artifact as Agent).id,
            path: artifact.path,
          });
          break;
      }
    }

    return config;
  }

  async readExistingConfig(): Promise<PlatformConfig | null> {
    try {
      const state = await readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(state);
      return {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      };
    } catch {
      return null;
    }
  }

  async writeConfig(config: PlatformConfig, options?: WriteConfigOptions): Promise<void> {
    try {
      await access(this.claudeRoot);
    } catch {
      await mkdir(this.claudeRoot, { recursive: true });
    }

    if (options?.cleanExistingArtifacts) {
      await this.cleanManagedArtifacts();
    }

    const existingContent = await readFile(this.configPath, "utf-8").catch(() => "");
    const mergedContent = this.upsertManagedSection(existingContent, config, await this.loadRuleContents(config));
    await writeFile(this.configPath, mergedContent, "utf-8");
    await writeFile(this.statePath, JSON.stringify(config, null, 2), "utf-8");

    await this.syncSkills(config);
    await this.syncAgents(config);
    await this.syncCommands();
  }

  mergeConfigs(existing: PlatformConfig | null, newConfig: PlatformConfig): PlatformConfig {
    if (!existing) {
      return newConfig;
    }

    const mergeByName = <T extends { name: string }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map<string, T>();
      existing.forEach((item) => map.set(item.name, item));
      incoming.forEach((item) => map.set(item.name, item));
      return Array.from(map.values());
    };

    return {
      rules: mergeByName(existing.rules, newConfig.rules),
      skills: mergeByName(existing.skills, newConfig.skills),
      agents: mergeByName(existing.agents, newConfig.agents),
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
    const skillsRoot = resolve(this.claudeRoot, "skills");
    await mkdir(skillsRoot, { recursive: true });

    for (const skill of config.skills) {
      const targetPath = resolve(skillsRoot, skill.name);
      await cp(skill.path, targetPath, { recursive: true, force: true }).catch(async () => {
        // Ensure destination path exists for filesystems that need an explicit mkdir.
        await mkdir(targetPath, { recursive: true });
        await cp(skill.path, targetPath, { recursive: true, force: true });
      });
    }
  }

  private async syncAgents(config: PlatformConfig): Promise<void> {
    const agentsRoot = resolve(this.claudeRoot, "agents");
    await mkdir(agentsRoot, { recursive: true });

    for (const agent of config.agents) {
      const source = await readFile(agent.path, "utf-8");
      const targetPath = resolve(agentsRoot, `${agent.name}.md`);
      const normalizedName = this.normalizeAgentName(agent.name);

      const content = source.trimStart().startsWith("---")
        ? source
        : [
            "---",
            `name: ${normalizedName}`,
            `description: Imported by agent-ctrl from ${agent.path}`,
            "---",
            "",
            source,
          ].join("\n");

      await writeFile(targetPath, content, "utf-8");
    }
  }

  private async syncCommands(): Promise<void> {
    const projectCommandsRoot = resolve(this.projectPath, "commands");
    const commandsExist = await access(projectCommandsRoot)
      .then(() => true)
      .catch(() => false);
    if (!commandsExist) {
      return;
    }

    const targetRoot = resolve(this.claudeRoot, "commands");
    await mkdir(targetRoot, { recursive: true });
    const markdownFiles = await this.collectMarkdownFiles(projectCommandsRoot);

    for (const filePath of markdownFiles) {
      const rel = relative(projectCommandsRoot, filePath);
      const dest = resolve(targetRoot, rel);
      await mkdir(dirname(dest), { recursive: true });
      await cp(filePath, dest, { force: true });
    }
  }

  private async cleanManagedArtifacts(): Promise<void> {
    await Promise.all([
      rm(resolve(this.claudeRoot, "skills"), { recursive: true, force: true }),
      rm(resolve(this.claudeRoot, "agents"), { recursive: true, force: true }),
      rm(resolve(this.claudeRoot, "commands"), { recursive: true, force: true }),
    ]);
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

  private async loadRuleContents(
    config: PlatformConfig
  ): Promise<Array<{ name: string; path: string; content: string }>> {
    return Promise.all(
      config.rules.map(async (rule) => {
        const content = await readFile(rule.path, "utf-8").catch(
          (error) => `Rule content unavailable (${String(error)})`
        );
        return {
          name: rule.name,
          path: rule.path,
          content,
        };
      })
    );
  }
}
