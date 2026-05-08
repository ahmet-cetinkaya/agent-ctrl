import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
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

  it("writes project AGENTS guidance when explicitly requested", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    expect(result.surface).toBe("agents-md-workflows-skills-mcp");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:windsurf:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".windsurf", "workflows", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "mcp_config.json"))).resolves.toBeNull();
  });

  it("writes global Windsurf rules/workflows/skills by default", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "global_rules.md"));
    expect(result.surface).toBe("global-rules-workflows-skills-mcp");
    await expect(access(resolve(userRootPath, "workflows", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "mcp_config.json"))).resolves.toBeNull();
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp workflow that should be cleaned
    const tempWorkflowPath = resolve(projectPath, ".windsurf", "workflows", "_temp_mock.md");
    await writeFile(tempWorkflowPath, "# Temp Mock Workflow\n");

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(projectPath, ".windsurf", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".windsurf", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned
    const tempAgentPath = resolve(projectPath, ".windsurf", "agents", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".windsurf", "agents"), { recursive: true });
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempWorkflowPath)).resolves.toBeNull();
    await expect(access(tempSkillPath)).resolves.toBeNull();
    await expect(access(tempAgentPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    // The result should be either "success" or "unchanged" since we're syncing the same artifacts
    expect(["success", "unchanged"]).toContain(result.status);

    // After override, verify temp files were cleaned by checking they no longer exist
    const workflowExists = await access(tempWorkflowPath)
      .then(() => true)
      .catch(() => false);
    const skillExists = await access(tempSkillPath)
      .then(() => true)
      .catch(() => false);
    const agentExists = await access(tempAgentPath)
      .then(() => true)
      .catch(() => false);

    expect(workflowExists).toBe(false);
    expect(skillExists).toBe(false);
    expect(agentExists).toBe(false);

    // Verify project artifacts still exist
    await expect(access(resolve(projectPath, ".windsurf", "workflows", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".windsurf", "agents", "architect.md"))).resolves.toBeNull();
  });
});
