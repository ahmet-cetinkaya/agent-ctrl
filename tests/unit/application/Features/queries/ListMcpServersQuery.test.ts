import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { ListMcpServersQuery } from "@/core/application/features/mcp/queries/ListMcpServersQuery";

describe("ListMcpServersQuery", () => {
  let query: ListMcpServersQuery;
  let testDir: string;

  beforeEach(async () => {
    query = new ListMcpServersQuery();
    testDir = resolve(tmpdir(), `mcp-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("returns loaded mcp servers when configs are valid", async () => {
    const mcpDir = resolve(testDir, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      resolve(mcpDir, "servers.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: {
              command: "node",
              args: ["server.js"],
            },
          },
        },
        null,
        2
      )
    );

    const result = await query.execute({ projectPath: testDir });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.servers).toHaveLength(1);
    expect(result.data.servers[0].serverId).toBe("local");
  });

  it("returns empty list when no mcp config directory exists", async () => {
    const result = await query.execute({ projectPath: testDir });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.servers).toEqual([]);
    expect(result.data.report.totalDiscovered).toBe(0);
  });

  it("handles invalid JSON gracefully by reporting errors", async () => {
    // Create an invalid mcp config - loader should handle this gracefully
    const mcpDir = resolve(testDir, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });
    // Write invalid JSON - loader adds issue to report but doesn't fail
    await writeFile(resolve(mcpDir, "servers.json"), "{ invalid json content");

    const result = await query.execute({ projectPath: testDir });
    // Loader handles JSON parse errors gracefully, returning success with error report
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    // No servers loaded due to invalid JSON
    expect(result.data.servers).toEqual([]);
    // Report shows 1 file was discovered but had errors
    expect(result.data.report.fileResults).toHaveLength(1);
    expect(result.data.report.fileResults[0].loadedServerCount).toBe(0);
    expect(result.data.report.fileResults[0].failedServerCount).toBeGreaterThan(0);
  });

  it("handles catalog state load failure gracefully", async () => {
    const mcpDir = resolve(testDir, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      resolve(mcpDir, "servers.json"),
      JSON.stringify({
        mcpServers: {
          local: {
            command: "node",
            args: ["server.js"],
          },
        },
      })
    );

    // Create invalid catalog state file
    const catalogDir = resolve(testDir, ".catalog");
    await mkdir(catalogDir, { recursive: true });
    await writeFile(resolve(catalogDir, "state.json"), "{ invalid catalog json");

    // Spy on console.warn to verify warning is logged
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(" "));
    };

    const result = await query.execute({ projectPath: testDir });

    console.warn = originalWarn;

    expect(result.success).toBe(true);
    expect(warnings.some((w) => w.includes("Failed to load catalog state"))).toBe(true);

    if (!result.success) {
      return;
    }

    // Should still return servers even with catalog load failure
    expect(result.data.servers).toHaveLength(1);
    // Catalog state should be empty maps due to load failure
    expect(result.data.catalogState.managedById.size).toBe(0);
    expect(result.data.catalogState.catalogById.size).toBe(0);
  });

  it("includes catalog state when catalog loads successfully", async () => {
    const mcpDir = resolve(testDir, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      resolve(mcpDir, "servers.json"),
      JSON.stringify({
        mcpServers: {
          local: {
            command: "node",
            args: ["server.js"],
          },
        },
      })
    );

    // Create valid catalog state
    const catalogDir = resolve(testDir, ".catalog");
    await mkdir(catalogDir, { recursive: true });
    await writeFile(
      resolve(catalogDir, "state.json"),
      JSON.stringify({
        managedIntegrations: [
          {
            itemType: "mcp",
            managedId: "local",
            catalogKey: "test-registry:local-mcp",
            registryId: "test-registry",
            sourceItemId: "local-mcp",
          },
        ],
        catalogItems: [
          {
            itemType: "mcp",
            catalogKey: "test-registry:local-mcp",
            registryId: "test-registry",
            sourceItemId: "local-mcp",
            displayName: "Local MCP",
            description: "A test MCP server",
            compatibilityState: "compatible",
            activationState: "active",
            availabilityState: "available",
            capabilities: [],
            categories: [],
            lastSeenAt: "2024-01-01T00:00:00Z",
          },
        ],
      })
    );

    const result = await query.execute({ projectPath: testDir });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.servers).toHaveLength(1);
    // Catalog state should be populated
    expect(result.data.catalogState.managedById.size).toBe(1);
    expect(result.data.catalogState.managedById.get("local")?.managedId).toBe("local");
    expect(result.data.catalogState.catalogById.size).toBeGreaterThan(0);
  });
});
