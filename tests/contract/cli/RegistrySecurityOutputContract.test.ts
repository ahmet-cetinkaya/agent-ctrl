import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("Registry security output contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("registry-security-cli-"));
  });

  afterEach(async () => {
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("does not leak bearer tokens in auth failure output", async () => {
    process.env.SMITHERY_API_KEY = "super-secret-token";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers",
        handler: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
      },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createMcpCommand().parseAsync(["node", "test", "sync", "--path", configRoot]);
      const output = [...consoleCapture.logs, ...consoleCapture.errors].join("\n");
      expect(output).toContain("authentication failed");
      expect(output).not.toContain("super-secret-token");
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
