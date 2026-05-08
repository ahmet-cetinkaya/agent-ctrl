import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("Registry credential source CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("registry-credential-cli-"));
    delete process.env.SKILLSMP_API_KEY;
    delete process.env.SKILLSMP_TOKEN;
    delete process.env.SMITHERY_API_KEY;
    delete process.env.SMITHERY_TOKEN;
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    delete process.env.SKILLSMP_TOKEN;
    delete process.env.SMITHERY_API_KEY;
    delete process.env.SMITHERY_TOKEN;
    await cleanupTempDir(baseDir);
  });

  it("loads registry credentials from the config-root .env file", async () => {
    await writeFile(
      resolve(configRoot, ".env"),
      ["SKILLSMP_API_KEY=skills-from-config", "SMITHERY_API_KEY=smithery-from-config", ""].join("\n"),
      "utf-8"
    );

    const authHeaders: string[] = [];
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: (_url, init) => {
          authHeaders.push(String(new Headers(init?.headers).get("Authorization")));
          return new Response(JSON.stringify({ skills: [] }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Daily-Limit": "500",
              "X-RateLimit-Daily-Remaining": "500",
            },
          });
        },
      },
      {
        match: (url) => url.pathname === "/servers",
        handler: (_url, init) => {
          authHeaders.push(String(new Headers(init?.headers).get("Authorization")));
          return new Response(
            JSON.stringify({
              servers: [],
              pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalCount: 0 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        },
      },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createSkillCommand().parseAsync(["node", "test", "sync", "--query", "code review", "--path", configRoot]);
      await createMcpCommand().parseAsync(["node", "test", "sync", "--path", configRoot]);

      expect(authHeaders).toContain("Bearer skills-from-config");
      expect(authHeaders).toContain("Bearer smithery-from-config");
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });

  it("prefers --api-key over config-root .env credentials", async () => {
    await writeFile(resolve(configRoot, ".env"), "SKILLSMP_API_KEY=skills-from-config\n", "utf-8");

    const authHeaders: string[] = [];
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: (_url, init) => {
          authHeaders.push(String(new Headers(init?.headers).get("Authorization")));
          return new Response(JSON.stringify({ skills: [] }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Daily-Limit": "500",
              "X-RateLimit-Daily-Remaining": "500",
            },
          });
        },
      },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createSkillCommand().parseAsync([
        "node",
        "test",
        "sync",
        "--query",
        "code review",
        "--api-key",
        "skills-from-flag",
        "--path",
        configRoot,
      ]);

      expect(authHeaders).toContain("Bearer skills-from-flag");
      expect(authHeaders).not.toContain("Bearer skills-from-config");
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
