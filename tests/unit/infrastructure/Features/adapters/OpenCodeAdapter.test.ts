import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";

describe("OpenCodeAdapter", () => {
  let projectPath: string;
  let adapter: OpenCodeAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "opencode-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    adapter = new OpenCodeAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates managed appy command content", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("success");
    expect(result.configPath).toContain("opencode/commands/appy.md");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply opencode");
  });

  it("preserves unchanged state on rerun", async () => {
    await adapter.applyAppyIntegration({ projectPath });
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("unchanged");
  });
});
