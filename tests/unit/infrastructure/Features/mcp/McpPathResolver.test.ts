import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { McpPathResolver } from "@/infrastructure/features/mcp/loaders/McpPathResolver";

describe("McpPathResolver", () => {
  it("resolves default config root under project", () => {
    const resolver = new McpPathResolver();
    const projectPath = "/tmp/my-project";

    const paths = resolver.resolve(projectPath);
    expect(paths.configRoot).toBe("/tmp/my-project/.agent-ctrl");
    expect(paths.mcpDir).toBe("/tmp/my-project/.agent-ctrl/mcps");
  });

  it("uses project path directly when already inside config root", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "mcp-path-resolver-"));
    try {
      await mkdir(resolve(projectPath, "mcps"), { recursive: true });
      const resolver = new McpPathResolver();

      const paths = resolver.resolve(projectPath);
      expect(paths.configRoot).toBe(projectPath);
      expect(paths.mcpDir).toBe(resolve(projectPath, "mcps"));
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });
});
