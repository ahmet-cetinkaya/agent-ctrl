import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
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
    await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("supports documented user-scope file writes", async () => {
    const userRoot = resolve(projectPath, ".qwen-user");
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRoot,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRoot, "QWEN.md"));
  });
});
