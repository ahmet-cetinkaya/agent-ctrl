import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

describe("MCP performance", () => {
  it("processes 100 files within 10 seconds", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "mcp-performance-"));

    try {
      const mcpDir = join(projectPath, ".agent-ctrl", "mcps");
      await mkdir(mcpDir, { recursive: true });

      const writes: Promise<unknown>[] = [];
      for (let i = 0; i < 100; i += 1) {
        writes.push(
          writeFile(
            join(mcpDir, `server-${i}.json`),
            JSON.stringify(
              {
                mcpServers: {
                  [`srv-${i}`]: {
                    command: "npx",
                    args: ["echo", String(i)],
                  },
                },
              },
              null,
              2
            )
          )
        );
      }
      await Promise.all(writes);

      const aggregator = new McpServerAggregator();
      const started = Date.now();
      const result = await aggregator.load(projectPath);
      const elapsedMs = Date.now() - started;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.report.totalDiscovered).toBe(100);
        expect(result.data.report.totalLoaded).toBe(100);
      }
      expect(elapsedMs).toBeLessThan(10_000);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });
});
