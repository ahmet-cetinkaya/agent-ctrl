import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("CursorAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: CursorAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "cursor-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "cursor-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new CursorAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes project-scope artifacts when explicitly requested", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    expect(result.surface).toBe("rules-skills-commands-agents-mcp");
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "mcp.json"))).resolves.toBeNull();
  });

  it("writes user-scope artifacts by default", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    await expect(access(resolve(userRootPath, "AGENTS.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "mcp.json"))).resolves.toBeNull();
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(projectPath, ".cursor", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".cursor", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp command that should be cleaned
    const tempCommandPath = resolve(projectPath, ".cursor", "commands", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".cursor", "commands"), { recursive: true });
    await writeFile(tempCommandPath, "# Temp Mock Command\n");

    // Create a temp agent that should be cleaned
    const tempAgentPath = resolve(projectPath, ".cursor", "agents", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".cursor", "agents"), { recursive: true });
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempSkillPath)).resolves.toBeNull();
    await expect(access(tempCommandPath)).resolves.toBeNull();
    await expect(access(tempAgentPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    // The result should be either "success" or "unchanged" since we're syncing the same artifacts
    expect(["success", "unchanged"]).toContain(result.status);

    // Verify temp files are gone
    const skillExists = await access(tempSkillPath)
      .then(() => true)
      .catch(() => false);

    expect(skillExists).toBe(false);

    // Verify project artifacts exist
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
