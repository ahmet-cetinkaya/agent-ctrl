import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyProfileCommand } from "@/core/application/features/apply/commands/ApplyProfileCommand";
import { ProfileListCommand } from "@/core/application/features/apply/commands/ProfileListCommand";

describe("Apply Profile Integration", () => {
  let projectPath: string;
  let configRoot: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-profile-integration-"));
    configRoot = join(projectPath, ".agent-ctrl");
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function setupBaseConfig() {
    await mkdir(join(configRoot, "rules"), { recursive: true });
    await mkdir(join(configRoot, "skills", "git-workflow"), { recursive: true });
    await mkdir(join(configRoot, "agents"), { recursive: true });

    await writeFile(join(configRoot, "rules", "coding-style.md"), "# Coding Style\n\nBase style rules.\n", "utf-8");
    await writeFile(join(configRoot, "rules", "security.md"), "# Security\n\nBase security rules.\n", "utf-8");
    await writeFile(
      join(configRoot, "skills", "git-workflow", "SKILL.md"),
      "# Git Workflow\n\nBase git skill.\n",
      "utf-8"
    );
    await writeFile(join(configRoot, "agents", "architect.md"), "# Architect\n\nBase architect agent.\n", "utf-8");
  }

  async function setupProfile(
    profileName: string,
    overrides: {
      rules?: Record<string, string>;
      skills?: Record<string, string>;
      agents?: Record<string, string>;
      mcpServers?: Record<string, string>;
    } = {}
  ) {
    const profilesPath = join(configRoot, "profiles", profileName);
    await mkdir(profilesPath, { recursive: true });

    if (overrides.rules) {
      const rulesPath = join(profilesPath, "rules");
      await mkdir(rulesPath, { recursive: true });
      for (const [filename, content] of Object.entries(overrides.rules)) {
        await writeFile(join(rulesPath, filename), content, "utf-8");
      }
    }

    if (overrides.skills) {
      for (const [skillName, content] of Object.entries(overrides.skills)) {
        const skillPath = join(profilesPath, "skills", skillName);
        await mkdir(skillPath, { recursive: true });
        await writeFile(join(skillPath, "SKILL.md"), content, "utf-8");
      }
    }

    if (overrides.agents) {
      const agentsPath = join(profilesPath, "agents");
      await mkdir(agentsPath, { recursive: true });
      for (const [filename, content] of Object.entries(overrides.agents)) {
        await writeFile(join(agentsPath, filename), content, "utf-8");
      }
    }

    if (overrides.mcpServers) {
      const mcpsPath = join(profilesPath, "mcps");
      await mkdir(mcpsPath, { recursive: true });
      for (const [filename, content] of Object.entries(overrides.mcpServers)) {
        await writeFile(join(mcpsPath, filename), content, "utf-8");
      }
    }
  }

  describe("several profiles in one apply (GH #19)", () => {
    it("keeps the rules of every profile and namespaces equal rule names", async () => {
      const scopedRule = (glob: string, title: string) => `---\npaths:\n  - "${glob}"\n---\n# ${title}\n`;
      await setupProfile("rust", { rules: { "coding-style.md": scopedRule("**/*.rs", "Rust Style") } });
      await setupProfile("typescript", { rules: { "coding-style.md": scopedRule("**/*.ts", "TS Style") } });

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["rust", "typescript"],
        platform: "claude",
        targetScope: "project",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.artifactCounts?.rules).toBe(2);

      const rulesRoot = join(projectPath, ".claude", "rules", "agent-ctrl");
      expect(await readFile(join(rulesRoot, "rust", "coding-style.md"), "utf-8")).toContain("# Rust Style");
      expect(await readFile(join(rulesRoot, "typescript", "coding-style.md"), "utf-8")).toContain("# TS Style");
    });

    it("fails before writing anything when one profile is missing", async () => {
      await setupProfile("rust", { rules: { "coding-style.md": "# Rust\n" } });

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["rust", "missing"],
        platform: "claude",
        targetScope: "project",
      });

      expect(result.success).toBe(false);
      await expect(access(join(projectPath, ".claude"))).rejects.toThrow();
    });
  });

  describe("partial override (T015)", () => {
    it("applies only profile artifacts without base", async () => {
      await setupBaseConfig();
      await setupProfile("partial", {
        rules: { "security.md": "# Security\n\nUpdated security rules.\n" },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["partial"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.rules).toBe(1);
      expect(result.data.artifactCounts?.skills).toBe(0);
      expect(result.data.artifactCounts?.agents).toBe(0);
    });
  });

  describe("additive profile (T016)", () => {
    it("applies only profile agents", async () => {
      await setupBaseConfig();
      await setupProfile("additive", {
        agents: { "reviewer.md": "# Reviewer\n\nProfile reviewer agent.\n" },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["additive"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.agents).toBe(1);
    });
  });

  describe("directory-level skill override (T017)", () => {
    it("replaces base skill with profile version", async () => {
      await setupBaseConfig();
      await setupProfile("skill-override", {
        skills: { "git-workflow": "# Git Workflow\n\nProfile git skill.\n" },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["skill-override"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.skills).toBe(1);
    });
  });

  describe("field-level MCP merge (T018)", () => {
    it("merges MCP server fields from profile", async () => {
      await setupBaseConfig();
      await setupProfile("mcp-merge", {
        mcpServers: {
          "context7.json": JSON.stringify({
            mcpServers: {
              context7: {
                command: "bun",
                args: ["run", "server"],
              },
            },
          }),
        },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["mcp-merge"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.mcpServers).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Claude project-scope MCP servers (GH #31)", () => {
    let homePath: string;

    beforeEach(async () => {
      homePath = await mkdtemp(join(tmpdir(), "apply-profile-claude-home-"));
      process.env.AGENT_CTRL_CLAUDE_HOME = homePath;
    });

    afterEach(async () => {
      delete process.env.AGENT_CTRL_CLAUDE_HOME;
      await rm(homePath, { recursive: true, force: true });
    });

    async function applyToClaudeProject() {
      return new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["secrets"],
        platform: "claude",
        targetScope: "project",
      });
    }

    const apiServerFiles = {
      "server.json": JSON.stringify({
        mcpServers: { api: { command: "npx", args: [], env: { TOKEN: "${TOKEN}" } } },
      }),
      ".env": "TOKEN=resolved-secret\n",
    };

    it("writes <project>/.mcp.json with the placeholder, never the secret, and leaves ~/.claude.json alone", async () => {
      const homeText = JSON.stringify({ ui: { theme: "dark" } });
      await writeFile(join(homePath, ".claude.json"), homeText, "utf-8");
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await applyToClaudeProject();

      expect(result.success).toBe(true);
      if (!result.success) return;
      const projectText = await readFile(join(projectPath, ".mcp.json"), "utf-8");
      expect(JSON.parse(projectText).mcpServers.api.env.TOKEN).toBe("${TOKEN}");
      expect(projectText).not.toContain("resolved-secret");
      expect(await readFile(join(homePath, ".claude.json"), "utf-8")).toBe(homeText);
      expect(result.data.fileChanges).toContain(join(projectPath, ".mcp.json"));
      expect(result.data.fileChanges).not.toContain(join(homePath, ".claude.json"));
    });

    it("merges into an existing .mcp.json and keeps servers agent-ctrl does not own", async () => {
      await writeFile(
        join(projectPath, ".mcp.json"),
        JSON.stringify({ mcpServers: { handmade: { command: "mine" } }, extra: 1 }),
        "utf-8"
      );
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await applyToClaudeProject();

      expect(result.success).toBe(true);
      const document = JSON.parse(await readFile(join(projectPath, ".mcp.json"), "utf-8"));
      expect(document.extra).toBe(1);
      expect(document.mcpServers.handmade.command).toBe("mine");
      expect(document.mcpServers.api.command).toBe("npx");
    });

    it("moves servers an earlier apply stored in ~/.claude.json and says so", async () => {
      await writeFile(
        join(homePath, ".claude.json"),
        JSON.stringify({
          ui: { theme: "dark" },
          projects: {
            [projectPath]: {
              mcpServers: { api: { command: "npx", env: { TOKEN: "resolved-secret" } }, mine: { command: "m" } },
            },
          },
        }),
        "utf-8"
      );
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await applyToClaudeProject();

      expect(result.success).toBe(true);
      if (!result.success) return;
      const homeDocument = JSON.parse(await readFile(join(homePath, ".claude.json"), "utf-8"));
      expect(homeDocument.ui.theme).toBe("dark");
      expect(Object.keys(homeDocument.projects[projectPath].mcpServers)).toEqual(["mine"]);
      expect(result.data.fileChanges).toContain(join(homePath, ".claude.json"));
      expect(
        result.data.warnings.some((warning) => warning.includes("Moved MCP servers") && warning.includes("api"))
      ).toBe(true);
    });

    it("keeps the old local scope when asked: writes ~/.claude.json, leaves .mcp.json and the migration out", async () => {
      await writeFile(
        join(projectPath, ".mcp.json"),
        JSON.stringify({ mcpServers: { handmade: { command: "mine" } } }),
        "utf-8"
      );
      await writeFile(
        join(homePath, ".claude.json"),
        JSON.stringify({
          projects: { [projectPath]: { mcpServers: { api: { command: "old" }, mine: { command: "m" } } } },
        }),
        "utf-8"
      );
      const projectFileBefore = await readFile(join(projectPath, ".mcp.json"), "utf-8");
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["secrets"],
        platform: "claude",
        targetScope: "project",
        claudeMcpScope: "local",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const homeDocument = JSON.parse(await readFile(join(homePath, ".claude.json"), "utf-8"));
      expect(homeDocument.projects[projectPath].mcpServers.api.env.TOKEN).toBe("resolved-secret");
      expect(homeDocument.projects[projectPath].mcpServers.mine.command).toBe("m");
      expect(await readFile(join(projectPath, ".mcp.json"), "utf-8")).toBe(projectFileBefore);
      expect(result.data.fileChanges).toContain(join(homePath, ".claude.json"));
      expect(result.data.fileChanges).not.toContain(join(projectPath, ".mcp.json"));
      expect(result.data.warnings.some((warning) => warning.includes("Moved MCP servers"))).toBe(false);
    });

    it("defaults to the project file when claudeMcpScope is project", async () => {
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["secrets"],
        platform: "claude",
        targetScope: "project",
        claudeMcpScope: "project",
      });

      expect(result.success).toBe(true);
      const projectText = await readFile(join(projectPath, ".mcp.json"), "utf-8");
      expect(JSON.parse(projectText).mcpServers.api.env.TOKEN).toBe("${TOKEN}");
    });

    it("lists variables that are not set in the environment in the summary", async () => {
      delete process.env.AC_UNSET_PROBE;
      await setupProfile("secrets", {
        mcpServers: {
          "server.json": JSON.stringify({
            mcpServers: { api: { command: "npx", args: [], env: { TOKEN: "${AC_UNSET_PROBE}" } } },
          }),
        },
      });

      const result = await applyToClaudeProject();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.warnings.some((warning) => warning.includes("AC_UNSET_PROBE"))).toBe(true);
      const projectText = await readFile(join(projectPath, ".mcp.json"), "utf-8");
      expect(JSON.parse(projectText).mcpServers.api.env.TOKEN).toBe("${AC_UNSET_PROBE}");
    });

    it("does not touch the home file on a dry run", async () => {
      const homeText = JSON.stringify({ projects: { [projectPath]: { mcpServers: { api: { command: "old" } } } } });
      await writeFile(join(homePath, ".claude.json"), homeText, "utf-8");
      await setupProfile("secrets", { mcpServers: apiServerFiles });

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["secrets"],
        platform: "claude",
        targetScope: "project",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(await readFile(join(homePath, ".claude.json"), "utf-8")).toBe(homeText);
      await expect(access(join(projectPath, ".mcp.json"))).rejects.toBeDefined();
    });

    it("reports a missing mcps/.env as a warning", async () => {
      await setupProfile("secrets", {
        mcpServers: {
          "server.json": JSON.stringify({
            mcpServers: { api: { command: "npx", args: [], env: { TOKEN: "${TOKEN}" } } },
          }),
        },
      });

      const result = await applyToClaudeProject();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.warnings.some((warning) => warning.includes("ENV_FILE_MISSING"))).toBe(true);
    });
  });

  describe("list command (T023)", () => {
    it("lists all available profiles", async () => {
      await mkdir(join(configRoot, "profiles", "debug"), { recursive: true });
      await mkdir(join(configRoot, "profiles", "production"), { recursive: true });

      const command = new ProfileListCommand();
      const result = await command.execute(projectPath);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.profiles).toContain("debug");
      expect(result.data.profiles).toContain("production");
      expect(result.data.profiles).toHaveLength(2);
    });
  });

  describe("edge cases (T025)", () => {
    it("handles profile with only some subdirectories", async () => {
      await setupBaseConfig();
      await setupProfile("partial-dirs", {
        rules: { "test.md": "# Test\n" },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["partial-dirs"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.rules).toBeGreaterThanOrEqual(1);
    });

    it("handles empty profile gracefully", async () => {
      await setupBaseConfig();
      await setupProfile("empty");

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileNames: ["empty"],
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.isEmpty).toBe(true);
    });
  });

  describe("model alias routes", () => {
    const SONNET_VAR = "AGENT_CTRL_OPENCODE_MODEL_SONNET";
    let previousRoute: string | undefined;

    beforeEach(() => {
      previousRoute = process.env[SONNET_VAR];
      delete process.env[SONNET_VAR];
    });

    afterEach(() => {
      if (previousRoute === undefined) {
        delete process.env[SONNET_VAR];
      } else {
        process.env[SONNET_VAR] = previousRoute;
      }
    });

    it("maps an aliased profile agent model using routes from .agent-ctrl/.env", async () => {
      await setupBaseConfig();
      await setupProfile("aliased", {
        agents: { "reviewer.md": "---\nname: reviewer\ndescription: Reviews\nmodel: sonnet\n---\nBody\n" },
      });
      await writeFile(join(configRoot, ".env"), `${SONNET_VAR}=provider/x\n`, "utf-8");

      const result = await new ApplyProfileCommand().execute({
        projectPath,
        profileNames: ["aliased"],
        platform: "opencode",
        targetScope: "project",
      });

      expect(result.success).toBe(true);
      const rendered = await readFile(join(projectPath, ".opencode", "agents", "reviewer.md"), "utf-8");
      expect(rendered).toContain("model: provider/x");
    });
  });
});
