import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("MCP registry CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("mcp-cli-contract-"));
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("returns sync summaries plus inspection fields in search and list output", async () => {
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
                  description: "GitHub MCP server",
                  capabilities: ["git", "pull-request"],
                  categories: ["development"],
                  version: "2.0.0",
                  homepage: "https://smithery.ai/server/smithery/github",
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
              description: "GitHub MCP server",
              capabilities: ["git", "pull-request"],
              categories: ["development"],
              version: "2.0.0",
              homepage: "https://smithery.ai/server/smithery/github",
              command: "npx",
              args: ["-y", "@smithery/github"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createMcpCommand().parseAsync(["node", "test", "sync", "--path", configRoot, "--json"]);
      const syncJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(syncJson.report.registryResults[0].registryId).toBe("smithery");

      consoleCapture.logs.length = 0;
      await createMcpCommand().parseAsync(["node", "test", "search", "github", "--path", configRoot, "--json"]);
      const searchJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(searchJson.items[0]).toMatchObject({
        sourceItemId: "smithery/github",
        description: "GitHub MCP server",
        compatibilityState: "unknown",
        sourceVersion: "2.0.0",
      });

      await writeFile(
        resolve(configRoot, "mcps", "smithery-github.json"),
        JSON.stringify({
          mcpServers: {
            "smithery/github": { command: "npx", args: ["-y", "@smithery/github"], env: { API_TOKEN: "top-secret" } },
          },
        })
      );
      consoleCapture.logs.length = 0;
      await createMcpCommand().parseAsync(["node", "test", "ls", configRoot, "--json"]);
      const listJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(listJson.servers[0].env.API_TOKEN).toBe("***REDACTED***");
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
