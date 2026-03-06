import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";

describe("CodexAdapter", () => {
  let projectPath: string;
  let adapter: CodexAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "codex-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    delete process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT;
    adapter = new CodexAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes skill-style appy integration for trusted project scope", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("project");
    expect(result.configPath).toContain(".codex/skills/appy/SKILL.md");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply codex");
  });

  it("uses user scope when project trust is disabled", async () => {
    process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT = "false";
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("user");
  });
});
