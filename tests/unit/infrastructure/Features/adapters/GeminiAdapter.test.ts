import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";

describe("GeminiAdapter", () => {
  let projectPath: string;
  let adapter: GeminiAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "gemini-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    adapter = new GeminiAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates managed toml command content", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("success");
    expect(result.configPath).toContain(".gemini/commands/appy.toml");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain('name = "appy"');
  });

  it("replaces conflicting command content when override is enabled", async () => {
    await adapter.applyAppyIntegration({ projectPath });
    const result = await adapter.applyAppyIntegration({ projectPath, override: true });
    expect(result.status).toBe("success");
  });
});
