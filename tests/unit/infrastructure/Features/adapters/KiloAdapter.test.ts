import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";

describe("KiloAdapter", () => {
  let projectPath: string;
  let adapter: KiloAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "kilo-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    adapter = new KiloAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates managed workflow content", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("success");
    expect(result.configPath).toContain("kilo/workflows/appy.md");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply kilo");
  });

  it("upserts appy workflow idempotently", async () => {
    await adapter.applyAppyIntegration({ projectPath });
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.status).toBe("unchanged");
  });
});
