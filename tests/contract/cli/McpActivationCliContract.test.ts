import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("MCP activation CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("mcp-activation-cli-"));
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("activates and deactivates MCPs through the CLI surface", async () => {
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [{ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: "1.0.0" }],
              pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalCount: 1 },
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
    const consoleCapture = captureConsole();

    try {
      await createMcpCommand().parseAsync(["node", "test", "sync", "--path", configRoot]);
      await createMcpCommand().parseAsync(["node", "test", "add", "smithery:smithery/github", "--path", configRoot]);
      expect(consoleCapture.logs.some((line) => line.includes("Activated MCP GitHub"))).toBe(true);
      await createMcpCommand().parseAsync(["node", "test", "rm", "smithery/github", "--path", configRoot]);
      expect(consoleCapture.logs.some((line) => line.includes("Deactivated MCP smithery/github"))).toBe(true);
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
