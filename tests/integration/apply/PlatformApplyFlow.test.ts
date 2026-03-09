import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("Selected-platform apply integration flow", () => {
  let projectPath: string;
  let claudeHomePath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-flow-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "apply-flow-claude-home-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    await writeApplyFixtures(projectPath);
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("applies only the selected platform", async () => {
    const result = await command.execute({
      projectPath,
      platform: "opencode",
      targetScope: "project",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.platform).toBe("opencode");
    expect(result.data.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const agentsContent = await readFile(result.data.configPath, "utf-8");
    expect(agentsContent).toContain("<!-- agent-ctrl:opencode:start -->");
    expect(agentsContent).not.toContain("<!-- agent-ctrl:codex:start -->");
    expect(agentsContent).not.toContain("<!-- agent-ctrl:windsurf:start -->");

    await expect(access(resolve(projectPath, ".opencode", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "agents", "architect.md"))).resolves.toBeNull();

    const unexpectedPlatformRoots = [
      resolve(projectPath, "GEMINI.md"),
      resolve(projectPath, "QWEN.md"),
      resolve(projectPath, ".qwen"),
      resolve(projectPath, ".gemini"),
      resolve(projectPath, ".kilocode"),
      resolve(projectPath, ".agent"),
      resolve(projectPath, ".cursor"),
      resolve(projectPath, ".windsurf"),
      resolve(projectPath, ".agents"),
      resolve(projectPath, ".claude"),
      resolve(projectPath, ".codex"),
    ];

    for (const path of unexpectedPlatformRoots) {
      const exists = await access(path)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    }
  });
});
