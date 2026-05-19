import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { WindsurfAdapter } from "@/infrastructure/features/windsurf/adapters/WindsurfAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("WindsurfAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: WindsurfAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "windsurf-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "windsurf-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new WindsurfAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes project rules as .md files with YAML frontmatter", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, ".windsurf", "rules"));
    expect(result.surface).toBe("windsurf-rules-workflows");

    // Rules are written as .md files with YAML frontmatter
    await expect(access(resolve(projectPath, ".windsurf", "rules"))).resolves.toBeNull();
    // Workflows are supported
    await expect(access(resolve(projectPath, ".windsurf", "workflows", "dev", "fix-lint.md"))).resolves.toBeNull();
    // Warnings for unsupported artifact types
    expect(result.warnings!.some((w) => w.includes("skills"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("agents"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("MCP"))).toBe(true);
  });

  it("writes global rules as a fallback with warning", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "rules"));
    expect(result.surface).toBe("windsurf-global-rules");
    // Warning about global rules being via Cascade Customizations UI
    expect(result.warnings!.some((w) => w.includes("Cascade Customizations UI"))).toBe(true);
  });

  it("cleans existing managed rules and workflows when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp rule that should be cleaned
    const tempRulePath = resolve(projectPath, ".windsurf", "rules", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".windsurf", "rules"), { recursive: true });
    await writeFile(tempRulePath, "---\nalwaysApply: true\n---\n# Temp Mock Rule\n");

    // Create a temp workflow that should be cleaned
    const tempWorkflowPath = resolve(projectPath, ".windsurf", "workflows", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".windsurf", "workflows"), { recursive: true });
    await writeFile(tempWorkflowPath, "# Temp Mock Workflow\n");

    // Verify temp files exist
    await expect(access(tempRulePath)).resolves.toBeNull();
    await expect(access(tempWorkflowPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    // Verify temp files are gone
    const ruleExists = await access(tempRulePath)
      .then(() => true)
      .catch(() => false);
    const workflowExists = await access(tempWorkflowPath)
      .then(() => true)
      .catch(() => false);
    expect(ruleExists).toBe(false);
    expect(workflowExists).toBe(false);

    // Verify rules and workflows directories exist
    await expect(access(resolve(projectPath, ".windsurf", "rules"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "workflows"))).resolves.toBeNull();
  });
});
