import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("CodexAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: CodexAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "codex-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "codex-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new CodexAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes managed Codex guidance into AGENTS.md by default", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:codex:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });

  it("supports explicit user scope selection", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    expect(result.surface).toBe("agents-md-skills-config-toml");
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "dev-fix-lint", "SKILL.md"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Codex does not have a documented apply target for commands.");
  });

  it("maps commands to skills in user scope", async () => {
    await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    const skillPath = resolve(userRootPath, "skills", "dev-fix-lint", "SKILL.md");
    await expect(access(skillPath)).resolves.toBeNull();

    const content = await readFile(skillPath, "utf-8");
    expect(content).toContain("name: dev-fix-lint");
    expect(content).toContain("description: Fix Lint");
    expect(content).toContain("# Fix Lint");
  });

  it("updates only the managed block when AGENTS.md already exists", async () => {
    const first = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(first.status).toBe("success");

    const second = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(second.status).toBe("unchanged");
  });

  it("keeps project-scope commands unsupported", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(result.warnings).toContain("Codex does not have a documented apply target for commands.");
  });

  it("syncs agents as TOML files in project scope", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const agentPath = resolve(projectPath, ".codex", "agents", "architect.toml");
    await expect(access(agentPath)).resolves.toBeNull();

    const content = await readFile(agentPath, "utf-8");
    expect(content).toContain('name = "architect"');
    expect(content).toContain('description = "Architect"');
    expect(content).toContain("Be explicit");
  });

  it("syncs agents as TOML files in user scope", async () => {
    await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    const agentPath = resolve(userRootPath, "agents", "architect.toml");
    await expect(access(agentPath)).resolves.toBeNull();

    const content = await readFile(agentPath, "utf-8");
    expect(content).toContain('name = "architect"');
    expect(content).toContain('description = "Architect"');
  });

  it("removes agents from unsupported warnings", async () => {
    const projectResult = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(projectResult.warnings).not.toContain("Codex does not have a documented apply target for agents.");

    const userResult = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(userResult.warnings).not.toContain("Codex does not have a documented apply target for agents.");
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "user", userConfigRootPath: userRootPath });

    // Create a temp skill that should be cleaned (in user scope)
    const tempSkillPath = resolve(userRootPath, "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(userRootPath, "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned (in user scope)
    const tempAgentPath = resolve(userRootPath, "agents", "_temp_mock.md");
    await mkdir(resolve(userRootPath, "agents"), { recursive: true });
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempSkillPath)).resolves.toBeNull();
    await expect(access(tempAgentPath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
      override: true,
    });

    // The result should be either "success" or "unchanged" since we're syncing the same artifacts
    expect(["success", "unchanged"]).toContain(result.status);

    // After override, verify temp files were cleaned by checking they no longer exist
    const skillExists = await access(tempSkillPath)
      .then(() => true)
      .catch(() => false);
    const agentExists = await access(tempAgentPath)
      .then(() => true)
      .catch(() => false);

    expect(skillExists).toBe(false);
    expect(agentExists).toBe(false);

    // Verify project artifacts still exist in user scope
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.toml"))).resolves.toBeNull();
  });
});
