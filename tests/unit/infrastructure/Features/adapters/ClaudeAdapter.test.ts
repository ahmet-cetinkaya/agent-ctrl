import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, access, stat } from "node:fs/promises";
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
    it("writes path-scoped rules to .claude/rules and keeps unscoped rules in CLAUDE.md (GH #18)", async () => {
      const rulesDir = resolve(projectPath, "rules");
      await mkdir(resolve(rulesDir, "rust"), { recursive: true });
      const scopedPath = resolve(rulesDir, "rust", "testing.md");
      const unscopedPath = resolve(rulesDir, "safety.md");
      await writeFile(scopedPath, '---\npaths:\n  - "**/*.rs"\n---\n# Rust Testing\n', "utf-8");
      await writeFile(unscopedPath, "# Safety\n", "utf-8");

      const result = await adapter.writeConfig({
        rules: [
          { name: "rust/testing", path: scopedPath },
          { name: "safety", path: unscopedPath },
        ],
        skills: [],
        agents: [],
        mcpServers: [],
      });
      expect(result.success).toBe(true);

      const claudeRoot = resolve(homePath, ".claude");
      const claudeFile = await readFile(resolve(claudeRoot, "CLAUDE.md"), "utf-8");
      expect(claudeFile).toContain("# Safety");
      expect(claudeFile).not.toContain("paths:");
      expect(claudeFile).not.toContain("# Rust Testing");

      const ruleFile = await readFile(resolve(claudeRoot, "rules", "agent-ctrl", "rust", "testing.md"), "utf-8");
      expect(ruleFile).toContain('paths:\n  - "**/*.rs"');
      expect(ruleFile).toContain("# Rust Testing");
    });

    it("replaces previously managed rule files on the next write (GH #18)", async () => {
      const staleTarget = resolve(homePath, ".claude", "rules", "agent-ctrl", "old.md");
      const userRule = resolve(homePath, ".claude", "rules", "mine.md");
      await mkdir(resolve(staleTarget, ".."), { recursive: true });
      await writeFile(staleTarget, "stale", "utf-8");
      await writeFile(userRule, "user owned", "utf-8");
      const scopedPath = resolve(projectPath, "go.md");
      await writeFile(scopedPath, '---\npaths:\n  - "**/*.go"\n---\n# Go\n', "utf-8");

      await adapter.writeConfig({ rules: [{ name: "go", path: scopedPath }], skills: [], agents: [], mcpServers: [] });

      await expect(access(staleTarget)).rejects.toThrow();
      expect(await readFile(userRule, "utf-8")).toBe("user owned");
      expect(await readFile(resolve(homePath, ".claude", "rules", "agent-ctrl", "go.md"), "utf-8")).toContain("# Go");
    });

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

      const mcpDoc = JSON.parse(await readFile(resolve(homePath, ".claude.json"), "utf-8"));
      expect(mcpDoc.mcpServers.Bright.command).toBe("npx");
      expect(mcpDoc.mcpServers.Bright.env.TOKEN).toBe("1");

      await expect(access(resolve(homePath, ".claude", "skills", "skill-a", "SKILL.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "agents", "Agent A.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "commands", "dev", "run.md"))).resolves.toBeNull();
      await expect(access(resolve(homePath, ".claude", "commands", "dev", "ignore.txt"))).rejects.toBeDefined();
    });

    it("writes commands passed in the options, such as profile commands outside the project", async () => {
      const profileCommandsPath = await mkdtemp(join(tmpdir(), "claude-profile-commands-"));
      try {
        const profileCommandPath = resolve(profileCommandsPath, "rust-test.md");
        await writeFile(profileCommandPath, "# Rust Test\n", "utf-8");

        const writeResult = await adapter.writeConfig(
          { rules: [], skills: [], agents: [], mcpServers: [] },
          { commands: [{ id: "rust-test", filename: "rust-test.md", path: profileCommandPath }] }
        );

        expect(writeResult.success).toBe(true);
        const written = await readFile(resolve(homePath, ".claude", "commands", "rust-test.md"), "utf-8");
        expect(written).toContain("# Rust Test");
      } finally {
        await rm(profileCommandsPath, { recursive: true, force: true });
      }
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
      // Note: cleanExistingArtifacts only cleans MCP servers, not managed artifacts (skills/agents/commands)
      // This is by design - the option only affects MCP server configuration
    });

    it("preserves existing mcp servers while merging new ones", async () => {
      await mkdir(resolve(homePath, ".claude"), { recursive: true });
      await writeFile(
        resolve(homePath, ".claude.json"),
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

      const doc = JSON.parse(await readFile(resolve(homePath, ".claude.json"), "utf-8"));
      expect(doc.ui.theme).toBe("dark");
      expect(doc.mcpServers.Existing.command).toBe("old");
      expect(doc.mcpServers.New.command).toBe("npx");
    });

    describe("local-scope MCP servers for a project", () => {
      const secretServer = {
        name: "secret",
        transport: "stdio" as const,
        command: "npx",
        args: ["x"],
        env: { TOKEN: "resolved-secret" },
        sourceFile: "mcp.json",
      };
      const emptyConfig = { rules: [], skills: [], agents: [], mcpServers: [secretServer] };

      function createProjectScopedAdapter(): ClaudeAdapter {
        return new ClaudeAdapter(projectPath, projectPath, resolve(projectPath, "CLAUDE.md"), projectPath);
      }

      async function readHomeDocument(): Promise<Record<string, any>> {
        return JSON.parse(await readFile(resolve(homePath, ".claude.json"), "utf-8"));
      }

      it("writes servers under projects[<path>] in the home .claude.json and nothing into the project", async () => {
        await writeFile(resolve(homePath, ".claude.json"), JSON.stringify({ ui: { theme: "dark" } }), "utf-8");

        const writeResult = await createProjectScopedAdapter().writeConfig(emptyConfig);

        expect(writeResult.success).toBe(true);
        const doc = await readHomeDocument();
        expect(doc.ui.theme).toBe("dark");
        expect(doc.mcpServers).toBeUndefined();
        expect(doc.projects[projectPath].mcpServers.secret.env.TOKEN).toBe("resolved-secret");
        await expect(access(resolve(projectPath, ".claude.json"))).rejects.toBeDefined();
      });

      it("keeps other projects and other keys of the project entry", async () => {
        await writeFile(
          resolve(homePath, ".claude.json"),
          JSON.stringify({
            projects: {
              "/other": { mcpServers: { keep: { command: "k" } } },
              [projectPath]: { allowedTools: ["a"], mcpServers: { existing: { command: "old" } } },
            },
          }),
          "utf-8"
        );

        await createProjectScopedAdapter().writeConfig(emptyConfig);

        const doc = await readHomeDocument();
        expect(doc.projects["/other"].mcpServers.keep.command).toBe("k");
        expect(doc.projects[projectPath].allowedTools).toEqual(["a"]);
        expect(doc.projects[projectPath].mcpServers.existing.command).toBe("old");
        expect(doc.projects[projectPath].mcpServers.secret.command).toBe("npx");
      });

      it("replaces only the project servers when overriding", async () => {
        await writeFile(
          resolve(homePath, ".claude.json"),
          JSON.stringify({
            mcpServers: { userLevel: { command: "u" } },
            projects: { [projectPath]: { mcpServers: { existing: { command: "old" } } } },
          }),
          "utf-8"
        );

        await createProjectScopedAdapter().writeConfig(emptyConfig, { cleanExistingArtifacts: true });

        const doc = await readHomeDocument();
        expect(doc.mcpServers.userLevel.command).toBe("u");
        expect(Object.keys(doc.projects[projectPath].mcpServers)).toEqual(["secret"]);
      });

      it("creates a new home .claude.json readable by the owner only", async () => {
        await createProjectScopedAdapter().writeConfig(emptyConfig);

        expect((await stat(resolve(homePath, ".claude.json"))).mode & 0o777).toBe(0o600);
      });

      it("refuses to overwrite a home .claude.json it cannot parse", async () => {
        await writeFile(resolve(homePath, ".claude.json"), "{ not json", "utf-8");

        const writeResult = await createProjectScopedAdapter().writeConfig(emptyConfig);

        expect(writeResult.success).toBe(false);
        expect(await readFile(resolve(homePath, ".claude.json"), "utf-8")).toBe("{ not json");
      });
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
