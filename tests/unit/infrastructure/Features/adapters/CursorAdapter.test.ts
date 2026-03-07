import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";

describe("CursorAdapter", () => {
  let projectPath: string;
  let adapter: CursorAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "cursor-adapter-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    delete process.env.AGENT_CTRL_CURSOR_SCOPE;
    adapter = new CursorAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_CURSOR_SCOPE;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes user-scope rule content by default", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("user");

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("agent-ctrl apply cursor");
  });

  it("can use user scope when explicitly requested", async () => {
    process.env.AGENT_CTRL_CURSOR_SCOPE = "user";
    const result = await adapter.applyAppyIntegration({ projectPath });
    expect(result.scope).toBe("user");
  });

  it("supports explicit project scope selection", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "project",
    });
    expect(result.scope).toBe("project");
    expect(result.configPath).toContain(".cursor/rules/appy.mdc");
  });
});
