import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { writeModelFrontmatterFixtures } from "@tests/helpers/writeModelFrontmatterFixtures";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { ForgeCodeAdapter } from "@/infrastructure/features/forgecode/adapters/ForgeCodeAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";

describe("Claude model frontmatter flow", () => {
  let projectPath: string;
  let claudeHomePath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "claude-model-project-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "claude-model-home-"));
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    await writeModelFrontmatterFixtures(projectPath);
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("claude: strips provider prefix on commands and agents, never writes models map", async () => {
    const adapter = new ClaudeApplyAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "user" });
    expect(result.status).toBe("success");

    const command = await readFile(resolve(claudeHomePath, ".claude", "commands", "model-test.md"), "utf-8");
    expect(command).toContain("model: claude-sonnet-4-5");
    expect(command).not.toContain("models:");
    expect(command).not.toContain("qwen");

    const agent = await readFile(resolve(claudeHomePath, ".claude", "agents", "model-agent.md"), "utf-8");
    expect(agent).toContain("model: claude-sonnet-4-5");
    expect(agent).not.toContain("models:");

    const skill = await readFile(resolve(claudeHomePath, ".claude", "skills", "model-skill", "SKILL.md"), "utf-8");
    expect(skill).toContain("model: anthropic/claude-sonnet-4-5");
    expect(skill).not.toContain("models:");
  });

  it("claude: reports model warnings in dry-run", async () => {
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "commands", "invalid-model.md"),
      "---\nmodel: 42\n---\n\nBody.\n",
      "utf-8"
    );

    const result = await new ClaudeApplyAdapter().applyApplyIntegration({
      projectPath,
      targetScope: "user",
      dryRun: true,
    });

    expect(result.warnings?.some((warning) => warning.includes("model: value must be"))).toBe(true);
  });
});

describe("Model frontmatter platform flow", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "model-frontmatter-"));
    await writeModelFrontmatterFixtures(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("opencode: passes provider/model-id through unchanged on commands and agents", async () => {
    const adapter = new OpenCodeAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const command = await readFile(resolve(projectPath, ".opencode", "commands", "model-test.md"), "utf-8");
    expect(command).toContain("model: anthropic/claude-sonnet-4-5");
    expect(command).not.toContain("models:");

    const agent = await readFile(resolve(projectPath, ".opencode", "agents", "model-agent.md"), "utf-8");
    expect(agent).toContain("model: anthropic/claude-sonnet-4-5");
    expect(result.warnings?.some((warning) => warning.includes("OpenCode"))).toBe(true);
  });

  it("gemini: drops model with warning on command-as-skill output", async () => {
    const adapter = new GeminiAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const skillMd = await readFile(resolve(projectPath, ".gemini", "skills", "model-test", "SKILL.md"), "utf-8");
    expect(skillMd).not.toContain("model:");
    expect(skillMd).not.toContain("models:");
    const modelWarnings = result.warnings?.filter((w) => w.includes("model")) ?? [];
    expect(modelWarnings.length).toBe(1);
  });

  it("forgecode: splits model + provider on agents, drops on commands with warning", async () => {
    const adapter = new ForgeCodeAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const agent = await readFile(resolve(projectPath, ".forge", "agents", "model-agent.md"), "utf-8");
    expect(agent).toContain("model: claude-sonnet-4-5");
    expect(agent).toContain("provider: anthropic");
    expect(agent).not.toContain("models:");

    expect(result.warnings?.some((w) => w.includes("model"))).toBe(true);
  });

  it("codex: writes TOML model on agents", async () => {
    const adapter = new CodexAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const toml = await readFile(resolve(projectPath, ".codex", "agents", "model-agent.toml"), "utf-8");
    expect(toml).toContain('model = "anthropic/claude-sonnet-4-5"');
  });

  it("codex: does not derive a TOML model from a body line", async () => {
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "agents", "body-model.md"),
      "# Body model\n\nmodel: should-not-be-a-setting\n",
      "utf-8"
    );

    const result = await new CodexAdapter().applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const toml = await readFile(resolve(projectPath, ".codex", "agents", "body-model.toml"), "utf-8");
    expect(toml).not.toContain('model = "should-not-be-a-setting"');
  });

  it("kilo: passes model through on agents, drops on command-as-skill with warning", async () => {
    const adapter = new KiloAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const agent = await readFile(resolve(projectPath, ".kilo", "agents", "model-agent.md"), "utf-8");
    expect(agent).toContain("model: anthropic/claude-sonnet-4-5");
    expect(result.warnings?.some((w) => w.includes("model"))).toBe(true);
  });

  it("qwen: applies models.qwen override on agents, drops on command-as-skill with warning", async () => {
    const adapter = new QwenAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const agent = await readFile(resolve(projectPath, ".agents", "agents", "model-agent.md"), "utf-8");
    expect(agent).toContain("model: fast");
    expect(agent).not.toContain("models:");
    expect(result.warnings?.some((w) => w.includes("model"))).toBe(true);
  });

  it("unknown models key surfaces a warning and apply completes (US4)", async () => {
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "commands", "bad-override.md"),
      ["---", "model: anthropic/claude-sonnet-4-5", "models:", "  zzz: pro", "---", "", "Body.", ""].join("\n"),
      "utf-8"
    );

    const adapter = new OpenCodeAdapter();
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");

    const command = await readFile(resolve(projectPath, ".opencode", "commands", "bad-override.md"), "utf-8");
    expect(command).toContain("model: anthropic/claude-sonnet-4-5");
    expect(command).not.toContain("models:");
    expect(command).not.toContain("zzz");
    expect(result.warnings?.some((w) => w.includes("zzz"))).toBe(true);
  });

  it("backward compatibility: artifacts without model fields produce model-free output and no warnings (SC-003)", async () => {
    const plainPath = await mkdtemp(join(tmpdir(), "model-frontmatter-plain-"));
    try {
      await mkdir(resolve(plainPath, ".agent-ctrl", "commands"), { recursive: true });
      await writeFile(
        resolve(plainPath, ".agent-ctrl", "commands", "plain.md"),
        "# Plain\n\nNo frontmatter.\n",
        "utf-8"
      );

      const adapter = new OpenCodeAdapter();
      const result = await adapter.applyApplyIntegration({ projectPath: plainPath, targetScope: "project" });
      expect(result.status).toBe("success");
      expect(result.warnings ?? []).toEqual([]);
    } finally {
      await rm(plainPath, { recursive: true, force: true });
    }
  });
});
