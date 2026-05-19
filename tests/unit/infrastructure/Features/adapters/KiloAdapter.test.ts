import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("KiloAdapter", () => {
  let projectPath: string;
  let adapter: KiloAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "kilo-adapter-"));
    await writeApplyFixtures(projectPath);
    adapter = new KiloAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates rules, workflows, and skills", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    expect(result.surface).toBe("rules-workflows-skills-agents-mcp");
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "commands", "dev:fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "kilo.json"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "commands", "dev:fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "kilo.json"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Kilo does not have a documented apply target for agents.");
    expect(result.warnings).not.toContain("Kilo does not have a documented apply target for MCP servers.");
  });

  it("reapplies idempotently", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp command that should be cleaned
    const tempCommandPath = resolve(projectPath, ".kilo", "commands", "_temp_mock.md");
    await writeFile(tempCommandPath, "# Temp Mock Command\n");

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(projectPath, ".kilo", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".kilo", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned
    const tempAgentPath = resolve(projectPath, ".kilo", "agents", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".kilo", "agents"), { recursive: true });
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

    // After override, verify temp files were cleaned
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
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "commands", "dev:fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilo", "agents", "architect.md"))).resolves.toBeNull();
  });
});
