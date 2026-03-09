import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { captureConsole, cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";

describe("Skill activation CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("skill-activation-cli-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("activates and deactivates skills through the CLI surface", async () => {
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: () =>
          new Response(JSON.stringify({ skills: [{ id: "code-review", name: "Code Review", description: "Review code", capabilities: ["review"], categories: ["dev"], version: "1.0.0" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" },
          }),
      },
      { match: (url) => url.pathname === "/skills/code-review", handler: () => new Response("<pre># Code Review</pre>", { status: 200 }) },
    ]);
    const consoleCapture = captureConsole();

    try {
      await createSkillCommand().parseAsync(["node", "test", "sync", "--query", "code review", "--path", configRoot]);
      await createSkillCommand().parseAsync(["node", "test", "add", "skillsmp:code-review", "--path", configRoot]);
      expect(consoleCapture.logs.some((line) => line.includes("Activated skill Code Review"))).toBe(true);
      await createSkillCommand().parseAsync(["node", "test", "rm", "code-review", "--path", configRoot]);
      expect(consoleCapture.logs.some((line) => line.includes("Deactivated skill code-review"))).toBe(true);
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
