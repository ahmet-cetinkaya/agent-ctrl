import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("QwenAdapter", () => {
  let projectPath: string;
  let adapter: QwenAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "qwen-adapter-"));
    await writeApplyFixtures(projectPath);
    adapter = new QwenAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates managed QWEN.md guidance for qwen", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "QWEN.md"));
    expect(result.surface).toBe("qwen-md-commands-skills-settings");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:qwen:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".qwen", "commands", "dev", "fix-lint.toml"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".qwen", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Qwen does not have a documented apply target for commands.");
    expect(result.warnings).not.toContain("Qwen does not have a documented apply target for skills.");
  });

  it("returns unchanged when desired state already exists", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("supports documented user-scope file writes", async () => {
    const userRoot = resolve(projectPath, ".qwen-user");
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRoot,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRoot, "QWEN.md"));
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp command that should be cleaned
    const tempCommandPath = resolve(projectPath, ".qwen", "commands", "_temp_mock.md");
    await writeFile(tempCommandPath, "# Temp Mock Command\n");

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(projectPath, ".qwen", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".qwen", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned (in .agents/, not .qwen/agents/)
    const tempAgentPath = resolve(projectPath, ".agents", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".agents"), { recursive: true });
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempCommandPath)).resolves.toBeNull();
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
    const commandExists = await access(tempCommandPath)
      .then(() => true)
      .catch(() => false);
    const skillExists = await access(tempSkillPath)
      .then(() => true)
      .catch(() => false);
    const agentExists = await access(tempAgentPath)
      .then(() => true)
      .catch(() => false);

    expect(commandExists).toBe(false);
    expect(skillExists).toBe(false);
    expect(agentExists).toBe(false);

    // Verify project artifacts still exist
    await expect(access(resolve(projectPath, ".qwen", "commands", "dev", "fix-lint.toml"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".qwen", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
