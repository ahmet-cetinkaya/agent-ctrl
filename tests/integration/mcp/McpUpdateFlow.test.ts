import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";
import { AddMcpCommand } from "@/core/application/features/mcp/commands/AddMcpCommand";
import { UpdateMcpCommand } from "@/core/application/features/mcp/commands/UpdateMcpCommand";

describe("MCP update flow", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("mcp-update-flow-"));
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("refreshes and updates managed MCPs when a new source version is available", async () => {
    let version = "1.0.0";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [
                {
                  qualifiedName: "smithery/github",
                  displayName: "GitHub",
                  description: "GitHub tools",
                  capabilities: ["git"],
                  categories: ["dev"],
                  version,
                },
              ],
              pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalCount: 1 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) => url.pathname === "/servers/smithery%2Fgithub",
        handler: () =>
          new Response(
            JSON.stringify({
              qualifiedName: "smithery/github",
              displayName: "GitHub",
              description: "GitHub tools",
              capabilities: ["git"],
              categories: ["dev"],
              version,
              command: "npx",
              args: ["-y", "@smithery/github"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      await new McpCatalogSynchronizer().synchronize({ configRoot, force: true });
      await new AddMcpCommand().execute({ configRoot, ref: "smithery:smithery/github" });
      version = "1.1.0";
      const update = await new UpdateMcpCommand().execute({ configRoot, all: true, refresh: true });
      expect(update.success).toBe(true);
      if (update.success) {
        expect(update.data.changed).toBe(1);
      }
    } finally {
      fetchMock.restore();
    }
  });
});
