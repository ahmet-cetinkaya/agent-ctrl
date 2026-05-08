import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("OpenCodeAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: OpenCodeAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "opencode-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "opencode-user-root-"));
    await writeApplyFixtures(projectPath);
    adapter = new OpenCodeAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("syncs OpenCode native files", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:opencode:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".opencode", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "agents", "architect.md"))).resolves.toBeNull();
  });

  it("preserves unchanged state on rerun", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("writes user scope artifacts directly into the OpenCode config root", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.status).toBe("success");
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));

    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "opencode.json"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, ".opencode"))).rejects.toBeDefined();
  });
});
