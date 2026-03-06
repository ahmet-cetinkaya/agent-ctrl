import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";

describe("QwenAdapter", () => {
  let projectPath: string;
  let adapter: QwenAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "qwen-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    adapter = new QwenAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates managed appy command for qwen", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("success");
    expect(result.configPath).toContain("qwen/commands/appy.toml");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply qwen");
  });

  it("returns unchanged when desired state already exists", async () => {
    await adapter.applyAppyIntegration({ projectPath });
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("unchanged");
  });
});
