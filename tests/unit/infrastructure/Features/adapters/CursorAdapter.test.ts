import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
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

  it("writes project-scope artifacts when explicitly requested", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, ".cursor"));
    expect(result.surface).toBe("rules-skills-commands-agents-mcp");
    await expect(access(resolve(projectPath, ".cursor", "rules", "coding-style.mdc"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".cursor", "mcp.json"))).resolves.toBeNull();
  });

  it("writes user-scope artifacts by default", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath));
    await expect(access(resolve(userRootPath, "rules", "coding-style.mdc"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "mcp.json"))).resolves.toBeNull();
  });
});
