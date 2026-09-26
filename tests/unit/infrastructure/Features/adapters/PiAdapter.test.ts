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

    // Commands are written as prompt templates under .pi/prompts/, namespace-prefixed
    // with "-" since Pi has no folder-based namespace concept (fixture id "dev/fix-lint"
    // → "dev-fix-lint.md", not a bare "fix-lint.md" that would drop the namespace).
    const promptPath = resolve(projectPath, ".pi", "prompts", "dev-fix-lint.md");
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

  it("does not delete anything when override is combined with dry-run", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const promptPath = resolve(projectPath, ".pi", "prompts", "dev-fix-lint.md");
    await expect(access(promptPath)).resolves.toBeNull();

    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
      dryRun: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);
    // dry-run must be a full preview: no file may be deleted by the override cleanup.
    await expect(access(promptPath)).resolves.toBeNull();
  });

  it("honors PI_CODING_AGENT_DIR when no explicit user config root is given", async () => {
    const envDir = await mkdtemp(join(tmpdir(), "pi-envdir-"));
    process.env.PI_CODING_AGENT_DIR = envDir;
    try {
      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "user" });
      expect(result.configPath).toBe(resolve(envDir, "AGENTS.md"));
      await expect(access(resolve(envDir, "AGENTS.md"))).resolves.toBeNull();
    } finally {
      delete process.env.PI_CODING_AGENT_DIR;
      await rm(envDir, { recursive: true, force: true });
    }
  });

  it("reports zero mcpServers in artifactCounts when the plugin is absent and servers are dropped", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(true);
    expect(result.artifactCounts!.mcpServers).toBe(0);
    expect(result.artifactCounts!.rules).toBeGreaterThan(0);
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

  describe("pi-subagents plugin detection", () => {
    it("applies agents natively to .pi/agents/ when pi-subagents is declared in the project's .pi/settings.json", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-subagents" }] })
      );

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(false);
      expect(result.message).toContain("via pi-subagents");

      const agentPath = resolve(projectPath, ".pi", "agents", "architect.md");
      await expect(access(agentPath)).resolves.toBeNull();
      const agentContent = await readFile(agentPath, "utf-8");
      expect(agentContent).toContain("name: architect");

      // Not also written as a degraded skill
      const skillFallbackExists = await access(resolve(projectPath, ".pi", "skills", "architect", "SKILL.md"))
        .then(() => true)
        .catch(() => false);
      expect(skillFallbackExists).toBe(false);
    });

    it("passes the canonical model frontmatter through verbatim on the native agents surface", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-subagents" }] })
      );
      // Overwrite the fixture agent with one carrying a model field.
      await mkdir(resolve(projectPath, ".agent-ctrl", "agents"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".agent-ctrl", "agents", "architect.md"),
        "---\nname: architect\ndescription: Plans systems\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBe explicit."
      );

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("model: dropped"))).toBe(false);
      const agentContent = await readFile(resolve(projectPath, ".pi", "agents", "architect.md"), "utf-8");
      expect(agentContent).toContain("model: anthropic/claude-sonnet-4-5");
    });

    it("detects a personally-installed pi-subagents (~/.pi/agent/settings.json) even in project scope", async () => {
      await writeFile(
        resolve(userRootPath, "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-subagents@0.71.0" }] })
      );

      const result = await adapter.applyApplyIntegration({
        projectPath,
        targetScope: "project",
        userConfigRootPath: userRootPath,
      });

      expect(result.message).toContain("via pi-subagents");
      await expect(access(resolve(projectPath, ".pi", "agents", "architect.md"))).resolves.toBeNull();
    });

    it("falls back to the skill-degrade warning when settings.json declares an unrelated package", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:some-other-extension" }] })
      );

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(true);
      const nativeAgentExists = await access(resolve(projectPath, ".pi", "agents", "architect.md"))
        .then(() => true)
        .catch(() => false);
      expect(nativeAgentExists).toBe(false);
    });

    it("cleans .pi/agents/ on override, independent of pi-mcp-adapter detection", async () => {
      await mkdir(resolve(projectPath, ".pi"), { recursive: true });
      await writeFile(
        resolve(projectPath, ".pi", "settings.json"),
        JSON.stringify({ packages: [{ source: "npm:pi-subagents" }] })
      );
      await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      const staleAgentPath = resolve(projectPath, ".pi", "agents", "_stale.md");
      await writeFile(staleAgentPath, "---\nname: _stale\n---\n\nStale");

      await adapter.applyApplyIntegration({ projectPath, targetScope: "project", override: true });

      const staleExists = await access(staleAgentPath)
        .then(() => true)
        .catch(() => false);
      expect(staleExists).toBe(false);
      await expect(access(resolve(projectPath, ".pi", "agents", "architect.md"))).resolves.toBeNull();
    });
  });
});
