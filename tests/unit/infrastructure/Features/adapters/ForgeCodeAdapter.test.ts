import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ForgeCodeAdapter } from "@/infrastructure/features/forgecode/adapters/ForgeCodeAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("ForgeCodeAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: ForgeCodeAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "forgecode-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "forgecode-user-root-"));
    await writeApplyFixtures(projectPath);
    adapter = new ForgeCodeAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("syncs ForgeCode native files", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:forgecode:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".forge", "commands", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".forge", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".forge", "agents", "architect.md"))).resolves.toBeNull();
  });

  it("preserves unchanged state on rerun", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("writes user scope artifacts directly into ForgeCode config root", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.status).toBe("success");
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));

    await expect(access(resolve(userRootPath, "commands", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, ".mcp.json"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, ".forge"))).rejects.toBeDefined();
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    // Create a temp command that should be cleaned
    const tempCommandPath = resolve(userRootPath, "commands", "_temp_mock.md");
    await writeFile(tempCommandPath, "# Temp Mock Command\n");

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(userRootPath, "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(userRootPath, "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned
    const tempAgentPath = resolve(userRootPath, "agents", "_temp_mock.md");
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempCommandPath)).resolves.toBeNull();
    await expect(access(tempSkillPath)).resolves.toBeNull();
    await expect(access(tempAgentPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
      override: true,
    });

    expect(result.status).toBe("success");

    // Verify temp files were cleaned
    await expect(access(tempCommandPath)).rejects.toBeDefined();
    await expect(access(tempSkillPath)).rejects.toBeDefined();
    await expect(access(tempAgentPath)).rejects.toBeDefined();

    // Verify project artifacts still exist
    await expect(access(resolve(userRootPath, "commands", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
  });
});
