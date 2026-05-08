import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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

  it("creates Gemini guidance and TOML commands", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "GEMINI.md"));
    expect(result.surface).toBe("gemini-md-commands-skills-settings");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:gemini:start -->");
    await expect(access(resolve(projectPath, ".gemini", "commands", "dev", "fix-lint.toml"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".gemini", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Gemini does not have a documented apply target for skills.");
  });

  it("reapplies deterministically", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });
});
