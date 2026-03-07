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
});
