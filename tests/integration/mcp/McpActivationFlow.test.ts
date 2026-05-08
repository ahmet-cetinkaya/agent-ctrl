import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";
import { AddMcpCommand } from "@/core/application/features/mcp/commands/AddMcpCommand";
import { RemoveMcpCommand } from "@/core/application/features/mcp/commands/RemoveMcpCommand";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";

describe("MCP activation flow", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("mcp-activation-"));
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("activates, deactivates, and preserves history while blocking unavailable items", async () => {
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
                  version: "1.0.0",
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
              version: "1.0.0",
              command: "npx",
              args: ["-y", "@smithery/github"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      await new McpCatalogSynchronizer().synchronize({ configRoot, force: true });
      const addResult = await new AddMcpCommand().execute({ configRoot, ref: "smithery:smithery/github" });
      expect(addResult.success).toBe(true);
      await access(resolve(configRoot, "mcps", "smithery-github.json"));

      const removeResult = await new RemoveMcpCommand().execute({ configRoot, ref: "smithery/github" });
      expect(removeResult.success).toBe(true);

      const state = await new CatalogStateFileStore().load(configRoot);
      expect(state.success).toBe(true);
      if (state.success) {
        expect(state.data.managedIntegrations[0].state).toBe("inactive");
        state.data.catalogItems[0].availabilityState = "unavailable";
        await new CatalogStateFileStore().save(configRoot, state.data);
      }

      const blocked = await new AddMcpCommand().execute({ configRoot, ref: "smithery:smithery/github" });
      expect(blocked.success).toBe(false);
      if (!blocked.success) {
        expect(blocked.error.message).toContain("no longer available");
      }
    } finally {
      fetchMock.restore();
    }
  });
});
