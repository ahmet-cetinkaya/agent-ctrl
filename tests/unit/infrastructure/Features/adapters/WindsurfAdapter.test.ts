import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WindsurfAdapter } from "@/infrastructure/features/windsurf/adapters/WindsurfAdapter";

describe("WindsurfAdapter", () => {
  let projectPath: string;
  let adapter: WindsurfAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "windsurf-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    delete process.env.AGENT_CTRL_WINDSURF_SCOPE;
    adapter = new WindsurfAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_WINDSURF_SCOPE;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes workspace rule content by default", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("project");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply windsurf");
  });

  it("supports global scope override", async () => {
    process.env.AGENT_CTRL_WINDSURF_SCOPE = "global";
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("user");
  });
});
