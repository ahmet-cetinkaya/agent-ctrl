import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";

describe("ClaudeApplyAdapter", () => {
  let projectPath: string;
  let userConfigRootPath: string;
  let claudeHomePath: string;
  let adapter: ClaudeApplyAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "claude-apply-project-"));
    userConfigRootPath = await mkdtemp(join(tmpdir(), "claude-apply-config-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "claude-apply-home-"));
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    adapter = new ClaudeApplyAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(userConfigRootPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("copies markdown commands from user config root into Claude commands", async () => {
    const sourcePath = resolve(userConfigRootPath, "commands", "dev", "run.md");
    const ignoredPath = resolve(userConfigRootPath, "commands", "dev", "ignore.txt");
    await mkdir(resolve(userConfigRootPath, "commands", "dev"), { recursive: true });
    await writeFile(sourcePath, "# Run\n", "utf-8");
    await writeFile(ignoredPath, "ignore\n", "utf-8");

    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath,
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(claudeHomePath, ".claude", "commands"));
    await expect(access(resolve(claudeHomePath, ".claude", "commands", "dev", "run.md"))).resolves.toBeNull();
    await expect(access(resolve(claudeHomePath, ".claude", "commands", "dev", "ignore.txt"))).rejects.toBeDefined();
  });

  it("returns unchanged when Claude commands are already synced", async () => {
    const sourcePath = resolve(userConfigRootPath, "commands", "review.md");
    const destPath = resolve(claudeHomePath, ".claude", "commands", "review.md");
    await mkdir(resolve(userConfigRootPath, "commands"), { recursive: true });
    await mkdir(resolve(claudeHomePath, ".claude", "commands"), { recursive: true });
    await writeFile(sourcePath, "# Review\n", "utf-8");
    await writeFile(destPath, "# Review\n", "utf-8");

    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath,
    });

    expect(result.status).toBe("unchanged");
  });

  it("copies markdown commands from project config root for project scope", async () => {
    const sourcePath = resolve(projectPath, ".agent-ctrl", "commands", "team", "ship.md");
    await mkdir(resolve(projectPath, ".agent-ctrl", "commands", "team"), { recursive: true });
    await writeFile(sourcePath, "# Ship\n", "utf-8");

    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "project",
      userConfigRootPath,
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(projectPath, ".claude", "commands"));
    expect(await readFile(resolve(projectPath, ".claude", "commands", "team", "ship.md"), "utf-8")).toBe("# Ship\n");
  });

  it("returns unchanged when no managed command source exists", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath,
    });

    expect(result.status).toBe("unchanged");
    expect(result.message).toContain("No managed Claude commands found");
  });
});
