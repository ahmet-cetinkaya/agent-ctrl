import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("ClaudeApplyAdapter", () => {
  let projectPath: string;
  let claudeHomePath: string;
  let adapter: ClaudeApplyAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "claude-apply-project-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "claude-apply-home-"));
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    await writeApplyFixtures(projectPath);
    adapter = new ClaudeApplyAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("applies full Claude integration from local project artifacts", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(claudeHomePath, ".claude", "CLAUDE.md"));

    const claudeFile = await readFile(resolve(claudeHomePath, ".claude", "CLAUDE.md"), "utf-8");
    expect(claudeFile).toContain("# Coding Style");

    await expect(access(resolve(claudeHomePath, ".claude", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(claudeHomePath, ".claude", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(claudeHomePath, ".claude", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();

    const mcpConfig = JSON.parse(await readFile(resolve(claudeHomePath, ".claude.json"), "utf-8"));
    expect(mcpConfig.mcpServers.context7.command).toBe("npx");
  });

  it("applies Claude integration to project scope when requested", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "project",
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(projectPath, ".claude", "CLAUDE.md"));
    await expect(access(resolve(projectPath, ".claude", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
  });

  it("reports concrete file changes instead of directory placeholders", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      dryRun: true,
    });

    expect(result.fileChanges).toContain(resolve(claudeHomePath, ".claude", "CLAUDE.md"));
    expect(result.fileChanges).toContain(resolve(claudeHomePath, ".claude", "skills", "git-workflow", "SKILL.md"));
    expect(result.fileChanges).toContain(resolve(claudeHomePath, ".claude", "agents", "architect.md"));
    expect(result.fileChanges).toContain(resolve(claudeHomePath, ".claude", "commands", "dev", "fix-lint.md"));
    expect(result.fileChanges).not.toContain(resolve(claudeHomePath, ".claude", "skills"));
    expect(result.fileChanges).not.toContain(resolve(claudeHomePath, ".claude", "commands"));
  });
});
