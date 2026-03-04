import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("ApplyCommand", () => {
  let command: ApplyCommand;
  let testDir: string;
  let claudeConfigPath: string;
  let claudeStatePath: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `apply-command-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(resolve(testDir, "rules"), { recursive: true });
    await mkdir(resolve(testDir, "skills"), { recursive: true });
    await mkdir(resolve(testDir, "agents"), { recursive: true });

    process.env.AGENT_CTRL_CLAUDE_HOME = testDir;
    command = new ApplyCommand();
    claudeConfigPath = resolve(testDir, ".claude", "CLAUDE.md");
    claudeStatePath = resolve(testDir, ".claude", ".agent-ctrl.json");
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(testDir, { recursive: true, force: true });
  });

  describe("execute", () => {
    it("should fail for unsupported platform", async () => {
      const result = await command.execute({
        projectPath: testDir,
        platform: "unsupported-platform",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserError);
        expect(result.error.message).toContain("not supported");
        expect(result.error.message).toContain("claude");
      }
    });

    it("should apply rules successfully to Claude", async () => {
      await writeFile(resolve(testDir, "rules", "my-rule.md"), "# My Rule");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(1);
        expect(result.data.skillsApplied).toBe(0);
        expect(result.data.agentsApplied).toBe(0);
        expect(result.data.configPath).toBe(claudeConfigPath);
      }
    });

    it("should apply multiple artifacts to Claude", async () => {
      await writeFile(resolve(testDir, "rules", "rule1.md"), "# Rule 1");
      await writeFile(resolve(testDir, "rules", "rule2.md"), "# Rule 2");

      const skill1Dir = resolve(testDir, "skills", "skill1");
      const skill2Dir = resolve(testDir, "skills", "skill2");
      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(resolve(skill1Dir, "SKILL.md"), "# Skill 1");
      await writeFile(resolve(skill2Dir, "SKILL.md"), "# Skill 2");

      await writeFile(resolve(testDir, "agents", "agent1.md"), "# Agent 1");
      await writeFile(resolve(testDir, "agents", "agent2.md"), "# Agent 2");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(2);
        expect(result.data.skillsApplied).toBe(2);
        expect(result.data.agentsApplied).toBe(2);
      }
    });

    it("should write CLAUDE.md file successfully", async () => {
      await writeFile(resolve(testDir, "rules", "my-rule.md"), "# My Rule");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
      });

      expect(result.success).toBe(true);

      const configExists = await access(claudeConfigPath).then(
        () => true,
        () => false
      );
      expect(configExists).toBe(true);

      const content = await readFile(claudeConfigPath, "utf-8");
      expect(content).toContain("<!-- agent-ctrl:start -->");
      expect(content).toContain("<!-- agent-ctrl:end -->");
      expect(content).toContain("# My Rule");
      expect(content).not.toContain("<!-- agent-ctrl:config:start -->");
      expect(content).not.toContain("<!-- agent-ctrl:config:end -->");
    });

    it("should merge with existing state config", async () => {
      await mkdir(resolve(testDir, ".claude"), { recursive: true });
      const existingConfig = {
        rules: [{ name: "existing-rule", path: "/old/path" }],
        skills: [],
        agents: [],
      };
      await writeFile(claudeStatePath, JSON.stringify(existingConfig, null, 2), "utf-8");

      await writeFile(resolve(testDir, "rules", "new-rule.md"), "# New Rule");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
      });

      expect(result.success).toBe(true);

      const state = JSON.parse(await readFile(claudeStatePath, "utf-8"));
      expect(state.rules.map((r: { name: string }) => r.name)).toContain("existing-rule");
      expect(state.rules.map((r: { name: string }) => r.name)).toContain("new-rule");
    });

    it("should replace entries with same name when not using force", async () => {
      await mkdir(resolve(testDir, ".claude"), { recursive: true });
      const existingConfig = {
        rules: [{ name: "my-rule", path: "/old/path" }],
        skills: [],
        agents: [],
      };
      await writeFile(claudeStatePath, JSON.stringify(existingConfig, null, 2), "utf-8");

      await writeFile(resolve(testDir, "rules", "my-rule.md"), "# Updated Rule");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
      });

      expect(result.success).toBe(true);

      const state = JSON.parse(await readFile(claudeStatePath, "utf-8"));
      expect(state.rules).toHaveLength(1);
      expect(state.rules[0].path).not.toBe("/old/path");
      expect(state.rules[0].path).toContain("my-rule.md");
    });

    it("should use force option to overwrite existing config", async () => {
      await mkdir(resolve(testDir, ".claude"), { recursive: true });
      const existingConfig = {
        rules: [{ name: "existing-rule", path: "/old/path" }],
        skills: [],
        agents: [],
      };
      await writeFile(claudeStatePath, JSON.stringify(existingConfig, null, 2), "utf-8");

      await writeFile(resolve(testDir, "rules", "new-rule.md"), "# New Rule");

      const result = await command.execute({
        projectPath: testDir,
        platform: "claude",
        force: true,
      });

      expect(result.success).toBe(true);

      const state = JSON.parse(await readFile(claudeStatePath, "utf-8"));
      expect(state.rules).toHaveLength(1);
      expect(state.rules[0].name).toBe("new-rule");
      expect(state.rules.map((r: { name: string }) => r.name)).not.toContain("existing-rule");
    });
  });
});
