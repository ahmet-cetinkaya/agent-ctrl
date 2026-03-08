import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("Registry update CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("registry-update-cli-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
    process.env.SMITHERY_API_KEY = "smithery-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("prints actionable summaries for update commands", async () => {
    let skillVersion = "1.0.0";
    let mcpVersion = "1.0.0";
    const fetchMock = installMockFetch([
      { match: (url) => url.pathname === "/api/v1/skills/search", handler: () => new Response(JSON.stringify({ skills: [{ id: "code-review", name: "Code Review", description: "Review code", capabilities: ["review"], categories: ["dev"], version: skillVersion }] }), { status: 200, headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" } }) },
      { match: (url) => url.pathname === "/skills/code-review", handler: () => new Response("<pre># Code Review</pre>", { status: 200 }) },
      { match: (url) => url.pathname === "/servers", handler: () => new Response(JSON.stringify({ servers: [{ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: mcpVersion }], pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalCount: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } }) },
      { match: (url) => url.pathname === "/servers/smithery%2Fgithub", handler: () => new Response(JSON.stringify({ qualifiedName: "smithery/github", displayName: "GitHub", description: "GitHub tools", capabilities: ["git"], categories: ["dev"], version: mcpVersion, command: "npx", args: ["-y", "@smithery/github"] }), { status: 200, headers: { "Content-Type": "application/json" } }) },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createSkillCommand().parseAsync(["node", "test", "sync", "--query", "code review", "--path", configRoot]);
      await createSkillCommand().parseAsync(["node", "test", "add", "skillsmp:code-review", "--path", configRoot]);
      await createMcpCommand().parseAsync(["node", "test", "sync", "--path", configRoot]);
      await createMcpCommand().parseAsync(["node", "test", "add", "smithery:smithery/github", "--path", configRoot]);

      skillVersion = "1.1.0";
      mcpVersion = "1.1.0";
      await createSkillCommand().parseAsync(["node", "test", "update", "--all", "--refresh", "--path", configRoot]);
      await createMcpCommand().parseAsync(["node", "test", "update", "--all", "--refresh", "--path", configRoot]);
      expect(consoleCapture.logs.some((line) => line.includes("Updated 1 skill"))).toBe(true);
      expect(consoleCapture.logs.some((line) => line.includes("Updated 1 MCP"))).toBe(true);
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
