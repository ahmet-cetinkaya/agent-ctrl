import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("OpenCodeAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: OpenCodeAdapter;
  let tempCommandPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "opencode-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "opencode-user-root-"));
    await writeApplyFixtures(projectPath);
    adapter = new OpenCodeAdapter();
    // Create a temp command that won't be in the project
    tempCommandPath = resolve(userRootPath, "commands", "dev", "temp-command.md");
    const commandsDir = resolve(userRootPath, "commands", "dev");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(tempCommandPath, "# Temp Command\n\nA temporary command for testing.");
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

  it("normalizes a Claude-style tools array in agent frontmatter into an object", async () => {
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "agents", "architect.md"),
      [
        "---",
        "name: architect",
        "description: Software architecture specialist",
        'tools: ["Read", "Grep", "Glob"]',
        "---",
        "",
        "Be explicit.",
      ].join("\n"),
      "utf-8"
    );

    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const content = await readFile(resolve(projectPath, ".opencode", "agents", "architect.md"), "utf-8");
    expect(content).toContain("read: true");
    expect(content).toContain("grep: true");
    expect(content).toContain("glob: true");
    expect(content).not.toContain('tools: ["Read"');
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // First apply without override
    await adapter.applyApplyIntegration({ projectPath, targetScope: "user", userConfigRootPath: userRootPath });

    // Verify temp command exists
    await expect(access(tempCommandPath)).resolves.toBeNull();

    // Apply with override - should clean existing artifacts and replace with project artifacts
    await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
      override: true,
    });

    // Verify temp command was removed (project doesn't have it)
    await expect(access(tempCommandPath)).rejects.toBeDefined();

    // Verify project artifacts were applied
    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
