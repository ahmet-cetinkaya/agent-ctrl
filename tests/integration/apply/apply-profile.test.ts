import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
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

  describe("partial override (T015)", () => {
    it("applies only profile artifacts without base", async () => {
      await setupBaseConfig();
      await setupProfile("partial", {
        rules: { "security.md": "# Security\n\nUpdated security rules.\n" },
      });

      const command = new ApplyProfileCommand();
      const result = await command.execute({
        projectPath,
        profileName: "partial",
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
        profileName: "additive",
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
        profileName: "skill-override",
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
        profileName: "mcp-merge",
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.artifactCounts?.mcpServers).toBeGreaterThanOrEqual(1);
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
        profileName: "partial-dirs",
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
        profileName: "empty",
        platform: "opencode",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.isEmpty).toBe(true);
    });
  });
});
