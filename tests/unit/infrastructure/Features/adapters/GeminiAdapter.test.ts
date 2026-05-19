import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("GeminiAdapter", () => {
  let projectPath: string;
  let adapter: GeminiAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "gemini-adapter-"));
    await writeApplyFixtures(projectPath);
    adapter = new GeminiAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates Gemini guidance and skills", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "GEMINI.md"));
    expect(result.surface).toBe("gemini-md-skills-settings");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:gemini:start -->");
    await expect(access(resolve(projectPath, ".gemini", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    // Commands are not supported — warning should be present
    expect(result.warnings!.some((w) => w.includes("commands"))).toBe(true);
  });

  it("reapplies deterministically", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // Create initial artifacts
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp skill that should be cleaned
    const tempSkillPath = resolve(projectPath, ".gemini", "skills", "_temp_mock", "SKILL.md");
    await mkdir(resolve(projectPath, ".gemini", "skills", "_temp_mock"), { recursive: true });
    await writeFile(tempSkillPath, "# Temp Mock Skill\n");

    // Create a temp agent that should be cleaned (in .agents/, not .gemini/agents/)
    const tempAgentPath = resolve(projectPath, ".agents", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".agents"), { recursive: true });
    await writeFile(tempAgentPath, "# Temp Mock Agent\n");

    // Verify temp files exist
    await expect(access(tempSkillPath)).resolves.toBeNull();
    await expect(access(tempAgentPath)).resolves.toBeNull();

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
    const agentExists = await access(tempAgentPath)
      .then(() => true)
      .catch(() => false);

    expect(skillExists).toBe(false);
    expect(agentExists).toBe(false);

    // Verify project artifacts still exist
    await expect(access(resolve(projectPath, ".gemini", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
