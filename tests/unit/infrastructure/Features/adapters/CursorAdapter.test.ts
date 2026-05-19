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

  it("writes project-scope rules as .mdc files when explicitly requested", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, ".cursor", "rules"));
    expect(result.surface).toBe("cursor-rules-mdc");
    // Rules are written as .mdc files with YAML frontmatter
    await expect(access(resolve(projectPath, ".cursor", "rules"))).resolves.toBeNull();
    // Warnings for unsupported artifact types
    expect(result.warnings!.some((w) => w.includes("skills"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("commands"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("agents"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("MCP"))).toBe(true);
  });

  it("writes user-scope rules as a fallback with warning", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "rules"));
    // Warning about global rules being via Settings UI
    expect(result.warnings!.some((w) => w.includes("Settings UI"))).toBe(true);
  });

  it("cleans existing managed rules when override is enabled", async () => {
    // Create initial rules
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp rule that should be cleaned
    const tempRulePath = resolve(projectPath, ".cursor", "rules", "_temp_mock.mdc");
    await mkdir(resolve(projectPath, ".cursor", "rules"), { recursive: true });
    await writeFile(tempRulePath, "---\nalwaysApply: true\n---\n# Temp Mock Rule\n");

    // Verify temp file exists
    await expect(access(tempRulePath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    // Verify temp file is gone
    const ruleExists = await access(tempRulePath)
      .then(() => true)
      .catch(() => false);
    expect(ruleExists).toBe(false);

    // Verify rules directory exists
    await expect(access(resolve(projectPath, ".cursor", "rules"))).resolves.toBeNull();
  });
});
