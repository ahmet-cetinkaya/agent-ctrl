import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AntigravityAdapter } from "@/infrastructure/features/antigravity/adapters/AntigravityAdapter";

describe("AntigravityAdapter", () => {
  let projectPath: string;
  let adapter: AntigravityAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "antigravity-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    adapter = new AntigravityAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes managed rules/workflow style appy integration", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("success");
    expect(result.configPath).toContain(".antigravity/rules/appy.md");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply antigravity");
  });
});
