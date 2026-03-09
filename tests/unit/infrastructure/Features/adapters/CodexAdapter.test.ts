import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:codex:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".agents", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });

  it("supports explicit user scope selection", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    expect(result.surface).toBe("agents-md-prompts-skills-config-toml");
    await expect(access(resolve(userRootPath, "prompts", "dev", "fix-lint.md"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Codex does not have a documented apply target for commands.");
  });

  it("updates only the managed block when AGENTS.md already exists", async () => {
    const first = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(first.status).toBe("success");

    const second = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(second.status).toBe("unchanged");
  });

  it("keeps project-scope commands unsupported because Codex docs only define global prompts", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });

    expect(result.warnings).toContain("Codex does not have a documented apply target for commands.");
    await expect(access(resolve(projectPath, ".codex", "prompts", "dev", "fix-lint.md"))).rejects.toBeDefined();
  });
});
