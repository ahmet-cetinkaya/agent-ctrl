import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

describe("MCP contracts", () => {
  it("enforces config contract and produces load report contract", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "mcp-contract-"));

    try {
      const mcpDir = join(projectPath, ".agent-ctrl", "mcps");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(
        join(mcpDir, "bright-data.json"),
        JSON.stringify(
          {
            mcpServers: {
              "Bright Data": {
                command: "npx",
                args: ["@brightdata/mcp"],
                env: {
                  API_TOKEN: "${API_TOKEN}",
                },
              },
            },
          },
          null,
          2
        )
      );
      await writeFile(join(mcpDir, ".env"), "API_TOKEN=token-value\n");

      const aggregator = new McpServerAggregator();
      const result = await aggregator.load(projectPath);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.servers).toHaveLength(1);
      expect(result.data.servers[0].serverId).toBe("Bright Data");
      expect(result.data.servers[0].command).toBe("npx");
      expect(result.data.servers[0].args).toEqual(["@brightdata/mcp"]);
      expect(result.data.servers[0].env.API_TOKEN).toBe("token-value");

      const report = result.data.report;
      expect(typeof report.startedAt).toBe("string");
      expect(typeof report.finishedAt).toBe("string");
      expect(report.totalDiscovered).toBe(1);
      expect(report.totalLoaded).toBe(1);
      expect(report.totalFailed).toBe(0);
      expect(report.fileResults).toHaveLength(1);
      expect(report.fileResults[0].status).toBe("loaded");
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });

  it("fails entries with invalid command/args contract", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "mcp-contract-invalid-"));

    try {
      const mcpDir = join(projectPath, ".agent-ctrl", "mcps");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(
        join(mcpDir, "invalid.json"),
        JSON.stringify(
          {
            mcpServers: {
              broken: {
                command: "",
                args: [1, 2, 3],
              },
            },
          },
          null,
          2
        )
      );

      const aggregator = new McpServerAggregator();
      const result = await aggregator.load(projectPath);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.report.totalLoaded).toBe(0);
      expect(result.data.report.totalFailed).toBeGreaterThan(0);
      expect(result.data.report.fileResults[0].issues.some((issue) => issue.code === "MCP_COMMAND_INVALID")).toBe(true);
      expect(result.data.report.fileResults[0].issues.some((issue) => issue.code === "MCP_ARGS_INVALID")).toBe(true);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });
});
