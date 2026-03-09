import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";
import { createRule } from "@/core/domain/shared/entities/Rule";
import { createSkill } from "@/core/domain/shared/entities/Skill";
import { createAgent } from "@/core/domain/shared/entities/Agent";
import type { PlatformConfig } from "@/core/domain/shared/interfaces/IPlatformAdapter";

describe("ClaudeAdapter", () => {
  let projectPath: string;
  let homePath: string;
  let adapter: ClaudeAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "claude-project-"));
    homePath = await mkdtemp(join(tmpdir(), "claude-home-"));
    process.env.AGENT_CTRL_CLAUDE_HOME = homePath;
    adapter = new ClaudeAdapter(projectPath);
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(homePath, { recursive: true, force: true });
  });

  describe("generateConfig", () => {
    it("generates empty config for empty artifacts", async () => {
      const result = await adapter.generateConfig([]);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.rules).toEqual([]);
      expect(result.data.skills).toEqual([]);
      expect(result.data.agents).toEqual([]);
      expect(result.data.mcpServers).toEqual([]);
    });

    it("maps rule/skill/agent artifacts", async () => {
      const rule = createRule("my-rule", "my-rule.md", "/path/to/my-rule.md");
      const skill = createSkill("my-skill", "my-skill", "/path/to/my-skill");
      const agent = createAgent("my-agent", "my-agent.md", "/path/to/my-agent.md");

      const result = await adapter.generateConfig([rule, skill, agent]);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.rules[0]).toEqual({ name: "my-rule", path: "/path/to/my-rule.md" });
      expect(result.data.skills[0]).toEqual({ name: "my-skill", path: "/path/to/my-skill" });
      expect(result.data.agents[0]).toEqual({ name: "my-agent", path: "/path/to/my-agent.md" });
    });
  });

  describe("readExistingConfig", () => {
    it("returns null because Claude apply does not use an internal state file", async () => {
      const result = await adapter.readExistingConfig();
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBeNull();
    });
  });

  describe("mergeConfigs", () => {
    it("returns new config when no existing config is present", () => {
      const newConfig: PlatformConfig = {
        rules: [{ name: "rule1", path: "/path1" }],
        skills: [],
        agents: [],
        mcpServers: [],
      };

      const merged = adapter.mergeConfigs(null, newConfig);
      expect(merged.rules).toHaveLength(1);
      expect(merged.rules[0].name).toBe("rule1");
    });

    it("replaces duplicate keys when merging", () => {
      const existing: PlatformConfig = {
        rules: [{ name: "same", path: "/old" }],
        skills: [{ name: "same", path: "/old-skill" }],
        agents: [{ name: "same", path: "/old-agent" }],
        mcpServers: [
          { name: "same", transport: "stdio" as const, command: "old", args: [], env: {}, sourceFile: "old" },
        ],
      };
      const incoming: PlatformConfig = {
        rules: [{ name: "same", path: "/new" }],
        skills: [{ name: "same", path: "/new-skill" }],
        agents: [{ name: "same", path: "/new-agent" }],
        mcpServers: [
          { name: "same", transport: "stdio" as const, command: "new", args: [], env: {}, sourceFile: "new" },
        ],
      };

      const merged = adapter.mergeConfigs(existing, incoming);
      expect(merged.rules[0].path).toBe("/new");
      expect(merged.skills[0].path).toBe("/new-skill");
      expect(merged.agents[0].path).toBe("/new-agent");
      expect(merged.mcpServers?.[0].command).toBe("new");
    });
  });

  describe("writeConfig", () => {
    it("writes managed CLAUDE.md, mcp settings, skills, agents, and markdown commands", async () => {
      const rulePath = resolve(projectPath, "rules", "rule-a.md");
      const skillPath = resolve(projectPath, "skills", "skill-a");
      const agentPath = resolve(projectPath, "agents", "agent-a.md");
      const commandMarkdownPath = resolve(projectPath, ".agent-ctrl", "commands", "dev", "run.md");
      const commandTextPath = resolve(projectPath, ".agent-ctrl", "commands", "dev", "ignore.txt");

      await mkdir(resolve(projectPath, "rules"), { recursive: true });
      await mkdir(skillPath, { recursive: true });
      await mkdir(resolve(projectPath, "agents"), { recursive: true });
      await mkdir(resolve(projectPath, ".agent-ctrl", "commands", "dev"), { recursive: true });

      await writeFile(rulePath, "# Rule A\n", "utf-8");
      await writeFile(resolve(skillPath, "SKILL.md"), "# Skill A\n", "utf-8");
      await writeFile(agentPath, "Agent body\n", "utf-8");
      await writeFile(commandMarkdownPath, "# Command Run\n", "utf-8");
      await writeFile(commandTextPath, "ignore me\n", "utf-8");

      const config: PlatformConfig = {
        rules: [{ name: "rule-a", path: rulePath }],
        skills: [{ name: "skill-a", path: skillPath }],
        agents: [{ name: "Agent A", path: agentPath }],
        mcpServers: [
          {
            name: "Bright",
            transport: "stdio" as const,
            command: "npx",
            args: ["x"],
            env: { TOKEN: "1" },
            sourceFile: "mcp.json",
          },
        ],
      };

      const writeResult = await adapter.writeConfig(config);
      expect(writeResult.success).toBe(true);

      const claudeFile = await readFile(resolve(homePath, ".claude", "CLAUDE.md"), "utf-8");
      expect(claudeFile).toContain("<!-- agent-ctrl:start -->");
      expect(claudeFile).toContain("<!-- agent-ctrl:end -->");
      expect(claudeFile).toContain("# Rule A");

      const mcpDoc = JSON.parse(await readFile(resolve(homePath, ".claude", "settings.json"), "utf-8"));
      expect(mcpDoc.mcpServers.Bright.command).toBe("npx");
      expect(mcpDoc.mcpServers.Bright.env.TOKEN).toBe("1");

      await expect(access(resolve(homePath, ".claude", "skills", "skill-a", "SKILL.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "agents", "Agent A.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "commands", "dev", "run.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "commands", "dev", "ignore.txt"))).rejects.toBeDefined();
    });

    it("replaces only managed section and preserves user content", async () => {
      const claudePath = resolve(homePath, ".claude", "CLAUDE.md");
      const rulePath = resolve(projectPath, "rules", "rule-b.md");

      await mkdir(resolve(homePath, ".claude"), { recursive: true });
      await mkdir(resolve(projectPath, "rules"), { recursive: true });
      await writeFile(rulePath, "# Rule B\n", "utf-8");
      await writeFile(
        claudePath,
        "User Intro\n\n<!-- agent-ctrl:start -->\nOld\n<!-- agent-ctrl:end -->\n\nUser Footer\n",
        "utf-8"
      );

      const writeResult = await adapter.writeConfig({
        rules: [{ name: "rule-b", path: rulePath }],
        skills: [],
        agents: [],
        mcpServers: [],
      });
      expect(writeResult.success).toBe(true);

      const content = await readFile(claudePath, "utf-8");
      expect(content).toContain("User Intro");
      expect(content).toContain("User Footer");
      expect(content).toContain("# Rule B");
      expect(content).not.toContain("\nOld\n");
    });

    it("cleans managed artifacts when override option is enabled", async () => {
      await mkdir(resolve(homePath, ".claude", "skills", "old"), { recursive: true });
      await mkdir(resolve(homePath, ".claude", "agents"), { recursive: true });
      await mkdir(resolve(homePath, ".claude", "commands"), { recursive: true });
      await writeFile(resolve(homePath, ".claude", "skills", "old", "SKILL.md"), "old", "utf-8");
      await writeFile(resolve(homePath, ".claude", "agents", "old.md"), "old", "utf-8");
      await writeFile(resolve(homePath, ".claude", "commands", "old.md"), "old", "utf-8");

      const cleanResult = await adapter.writeConfig(
        {
          rules: [],
          skills: [],
          agents: [],
          mcpServers: [],
        },
        { cleanExistingArtifacts: true }
      );
      expect(cleanResult.success).toBe(true);

      await expect(access(resolve(homePath, ".claude", "skills", "old"))).rejects.toBeDefined();
      await expect(access(resolve(homePath, ".claude", "agents", "old.md"))).rejects.toBeDefined();
      await expect(access(resolve(homePath, ".claude", "commands", "old.md"))).rejects.toBeDefined();
    });

    it("preserves existing mcp servers while merging new ones", async () => {
      await mkdir(resolve(homePath, ".claude"), { recursive: true });
      await writeFile(
        resolve(homePath, ".claude", "settings.json"),
        JSON.stringify({
          ui: { theme: "dark" },
          mcpServers: {
            Existing: { command: "old", args: [] },
          },
        }),
        "utf-8"
      );

      const writeResult = await adapter.writeConfig({
        rules: [],
        skills: [],
        agents: [],
        mcpServers: [
          { name: "New", transport: "stdio" as const, command: "npx", args: ["x"], env: {}, sourceFile: "mcp.json" },
        ],
      });
      expect(writeResult.success).toBe(true);

      const doc = JSON.parse(await readFile(resolve(homePath, ".claude", "settings.json"), "utf-8"));
      expect(doc.ui.theme).toBe("dark");
      expect(doc.mcpServers.Existing.command).toBe("old");
      expect(doc.mcpServers.New.command).toBe("npx");
    });

    it("keeps frontmatter agents unchanged and normalizes missing content fallback for rules", async () => {
      const agentPath = resolve(projectPath, "agents", "ready.md");
      await mkdir(resolve(projectPath, "agents"), { recursive: true });
      await writeFile(agentPath, "---\nname: ready\n---\nagent body\n", "utf-8");

      const writeResult = await adapter.writeConfig({
        rules: [{ name: "missing-rule", path: "/missing/rule.md" }],
        skills: [],
        agents: [{ name: "ready", path: agentPath }],
        mcpServers: [],
      });
      expect(writeResult.success).toBe(true);

      const claudeFile = await readFile(resolve(homePath, ".claude", "CLAUDE.md"), "utf-8");
      expect(claudeFile).toContain("Rule content unavailable");

      const agentContent = await readFile(resolve(homePath, ".claude", "agents", "ready.md"), "utf-8");
      expect(agentContent.startsWith("---")).toBe(true);
      expect(agentContent).not.toContain("Imported by agent-ctrl");
    });
  });
});
