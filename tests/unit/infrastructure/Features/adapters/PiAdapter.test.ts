import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PiAdapter } from "@/infrastructure/features/pi/adapters/PiAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("PiAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: PiAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pi-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "pi-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new PiAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes project-scope rules to AGENTS.md and syncs commands/skills/agents", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    expect(result.surface).toBe("pi-agents-md-prompts-skills");

    // Rules are upserted into a managed AGENTS.md section
    await expect(access(resolve(projectPath, "AGENTS.md"))).resolves.toBeNull();

    // Commands are written as prompt templates under .pi/prompts/
    const promptPath = resolve(projectPath, ".pi", "prompts", "fix-lint.md");
    await expect(access(promptPath)).resolves.toBeNull();
    expect(await readFile(promptPath, "utf-8")).toContain("description:");

    // Skills are written natively under .pi/skills/
    await expect(access(resolve(projectPath, ".pi", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();

    // Agents are degraded to skills with a warning (no persona concept in Pi) — verify
    // the actual degraded skill file was written, not just that the warning was pushed
    // (the warning is emitted unconditionally before the sync call, so on its own it
    // does not prove the file landed correctly).
    const architectSkillPath = resolve(projectPath, ".pi", "skills", "architect", "SKILL.md");
    await expect(access(architectSkillPath)).resolves.toBeNull();
    expect(await readFile(architectSkillPath, "utf-8")).toContain("name: architect");
    expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("pi install npm:pi-subagents"))).toBe(true);

    // MCP servers are not supported, but the warning points to the popular community extension
    expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("pi install npm:pi-mcp-adapter"))).toBe(true);
  });

  it("writes user-scope rules under the configured user root", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    await expect(access(resolve(userRootPath, "AGENTS.md"))).resolves.toBeNull();
  });

  it("cleans existing managed prompts/skills when override is enabled", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const tempPromptPath = resolve(projectPath, ".pi", "prompts", "_temp_mock.md");
    await mkdir(resolve(projectPath, ".pi", "prompts"), { recursive: true });
    await writeFile(tempPromptPath, "---\ndescription: temp\n---\n\nTemp");

    await expect(access(tempPromptPath)).resolves.toBeNull();

    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    const promptExists = await access(tempPromptPath)
      .then(() => true)
      .catch(() => false);
    expect(promptExists).toBe(false);
  });

  describe("pi-mcp-adapter plugin detection", () => {
    it("applies MCP servers to .mcp.json when pi-mcp-adapter is declared in the project's .pi/settings.json", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-mcp-adapter" }] })
      );

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(false);
      expect(result.message).toContain("via pi-mcp-adapter");

      const mcpConfigPath = resolve(projectPath, ".mcp.json");
      const mcpConfig = JSON.parse(await readFile(mcpConfigPath, "utf-8"));
      expect(mcpConfig.mcpServers.context7).toEqual({
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
      });
    });

    it("detects a personally-installed plugin (~/.pi/agent/settings.json) even in project scope", async () => {
      await writeFile(
        resolve(userRootPath, "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-mcp-adapter@2.37.0" }] })
      );

      const result = await adapter.applyApplyIntegration({
        projectPath,
        targetScope: "project",
        userConfigRootPath: userRootPath,
      });

      expect(result.message).toContain("via pi-mcp-adapter");
      await expect(access(resolve(projectPath, ".mcp.json"))).resolves.toBeNull();
    });

    it("falls back to the warning when settings.json declares an unrelated package", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:some-other-extension" }] })
      );

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(true);
      const mcpExists = await access(resolve(projectPath, ".mcp.json"))
        .then(() => true)
        .catch(() => false);
      expect(mcpExists).toBe(false);
    });

    it("falls back to the warning without throwing when settings.json is malformed JSON", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(resolve(projectPath, ".pi", "settings.json"), "{ not valid json");

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(true);
    });
  });
});
