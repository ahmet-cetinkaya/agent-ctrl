import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { AntigravityAdapter } from "@/infrastructure/features/antigravity/adapters/AntigravityAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("AntigravityAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: AntigravityAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "antigravity-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "antigravity-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new AntigravityAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes workspace rules and skills to GEMINI.md", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "GEMINI.md"));
    expect(result.surface).toBe("rules-skills-mcp");
    await expect(access(resolve(projectPath, "GEMINI.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "skills", "dev-fix-lint", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    // MCP is not supported — warning should be present
    expect(result.warnings!.some((w) => w.includes("MCP"))).toBe(true);
  });

  it("writes managed global Antigravity guidance into GEMINI.md", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.configPath).toBe(resolve(userRootPath, "GEMINI.md"));
    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:antigravity:start -->");
    expect(content).toContain("## Coding Style");
    await expect(
      access(resolve(userRootPath, "antigravity", "skills", "git-workflow", "SKILL.md"))
    ).resolves.toBeNull();
    // MCP is not supported — warning should be present
    expect(result.warnings!.some((w) => w.includes("MCP"))).toBe(true);
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp skill that should be cleaned (project scope - syncs to .agent/skills/)
    const tempSkillPath = resolve(projectPath, ".agent", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".agent", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Verify temp files exist
    await expect(access(tempSkillPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    // After override, verify temp files were cleaned
    const skillExists = await access(tempSkillPath)
      .then(() => true)
      .catch(() => false);

    expect(skillExists).toBe(false);

    // Verify project artifacts still exist
    await expect(access(resolve(projectPath, "GEMINI.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "skills", "dev-fix-lint", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
