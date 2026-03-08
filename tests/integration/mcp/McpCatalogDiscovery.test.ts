import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempConfigRoot, installMockFetch, readJson } from "../../helpers/catalogTestUtils";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";
import { SearchMcpCatalogQuery } from "@/core/application/features/mcp/queries/SearchMcpCatalogQuery";

describe("MCP catalog discovery", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("mcp-discovery-"));
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("persists discovery results across pages and deduplicates repeated syncs", async () => {
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers" && url.searchParams.get("page") === "1",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [{ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: "1.0.0" }],
              pagination: { currentPage: 1, pageSize: 100, totalPages: 2, totalCount: 2 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) => url.pathname === "/servers" && url.searchParams.get("page") === "2",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [{ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: "1.0.0" }],
              pagination: { currentPage: 2, pageSize: 100, totalPages: 2, totalCount: 2 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) => url.pathname === "/servers/smithery%2Fgithub",
        handler: () =>
          new Response(
            JSON.stringify({ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: "1.0.0", command: "npx", args: ["-y", "@smithery/github"] }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      const synchronizer = new McpCatalogSynchronizer();
      await synchronizer.synchronize({ configRoot, force: true });

      const state = (await readJson(`${configRoot}/.catalog/state.json`)) as { catalogItems: Array<{ catalogKey: string }> };
      expect(state.catalogItems.filter((item) => item.catalogKey === "smithery:smithery/github")).toHaveLength(1);

      const query = new SearchMcpCatalogQuery();
      const result = await query.execute({ configRoot, query: "github" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
      }
    } finally {
      fetchMock.restore();
    }
  });
});
