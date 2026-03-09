import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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

  it("writes workspace rules and workflows", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toContain(".agent/rules");
    expect(result.surface).toBe("rules-workflows-skills-mcp");
    await expect(access(resolve(projectPath, ".agent", "rules", "coding-style.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "workflows", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".agent", "mcp_config.json"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Antigravity does not have a documented apply target for skills.");
    expect(result.warnings).not.toContain("Antigravity does not have a documented apply target for MCP servers.");
  });

  it("writes managed global Antigravity guidance into GEMINI.md", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.configPath).toBe(resolve(userRootPath, "GEMINI.md"));
    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:antigravity:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(userRootPath, "antigravity", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "antigravity", "mcp_config.json"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Antigravity does not have a documented apply target for skills.");
    expect(result.warnings).not.toContain("Antigravity does not have a documented apply target for MCP servers.");
  });
});
