import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PiAdapter } from "@/infrastructure/features/pi/adapters/PiAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("PiAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: PiAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pi-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "pi-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new PiAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes project-scope rules to AGENTS.md and syncs commands/skills/agents", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    expect(result.surface).toBe("pi-agents-md-prompts-skills");

    // Rules are upserted into a managed AGENTS.md section
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();

    // Commands are written as prompt templates under .pi/prompts/
    const promptPath = resolve(projectPath, ".pi", "prompts", "fix-lint.md");
    await expect(access(promptPath)).resolves.toBeNull();
    expect(await readFile(promptPath, "utf-8")).toContain("description:");

    // Skills are written natively under .pi/skills/
    await expect(access(resolve(projectPath, ".pi", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();

    // Agents are degraded to skills with a warning (no persona concept in Pi) — verify
    // the actual degraded skill file was written, not just that the warning was pushed
    // (the warning is emitted unconditionally before the sync call, so on its own it
    // does not prove the file landed correctly).
    const architectSkillPath = resolve(projectPath, ".pi", "skills", "architect", "SKILL.md");
    await expect(access(architectSkillPath)).resolves.toBeNull();
    expect(await readFile(architectSkillPath, "utf-8")).toContain("name: architect");
    expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(true);

    // MCP servers are not supported
    expect(result.warnings!.some((w) => w.includes("MCP servers will not be applied"))).toBe(true);
  });

  it("writes user-scope rules under the configured user root", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    await expect(access(resolve(userRootPath, "AGENTS.md"))).resolves.toBeNull();
  });

  it("cleans existing managed prompts/skills when override is enabled", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const tempPromptPath = resolve(projectPath, ".pi", "prompts", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".pi", "prompts"), { recursive: true });
    await writeFile(tempPromptPath, "---\ndescription: temp\n---\n\nTemp");

    await expect(access(tempPromptPath)).resolves.toBeNull();

    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    const promptExists = await access(tempPromptPath)
      .then(() => true)
      .catch(() => false);
    expect(promptExists).toBe(false);
  });
});
