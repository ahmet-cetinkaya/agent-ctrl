import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import {
  captureConsole,
  cleanupTempDir,
  createTempConfigRoot,
  installMockFetch,
  seedSkill,
} from "../../helpers/catalogTestUtils";

describe("Skill registry CLI contract", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("skill-cli-contract-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("returns sync summaries plus inspection fields in search and list output", async () => {
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: () =>
          new Response(
            JSON.stringify({
              skills: [
                {
                  id: "code-review",
                  name: "Code Review",
                  description: "Review code and identify issues",
                  capabilities: ["code-review", "quality"],
                  categories: ["development"],
                  version: "1.0.0",
                  url: "https://skillsmp.com/skills/code-review",
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Daily-Limit": "500",
                "X-RateLimit-Daily-Remaining": "499",
              },
            }
          ),
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
        "--path",
        configRoot,
        "--json",
      ]);
      const syncJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(syncJson.report.registryResults[0].registryId).toBe("skillsmp");
      expect(syncJson.report.registryResults[0].status).toBe("success");

      consoleCapture.logs.length = 0;
      await createSkillCommand().parseAsync(["node", "test", "search", "code", "--path", configRoot, "--json"]);
      const searchJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(searchJson.items[0]).toMatchObject({
        sourceItemId: "code-review",
        description: "Review code and identify issues",
        compatibilityState: "unknown",
        sourceVersion: "1.0.0",
      });
      expect(searchJson.items[0].capabilities).toContain("code-review");

      await seedSkill(configRoot, "code-review");
      consoleCapture.logs.length = 0;
      await createSkillCommand().parseAsync(["node", "test", "ls", configRoot, "--json"]);
      const listJson = JSON.parse(consoleCapture.logs.at(-1) ?? "{}");
      expect(listJson.managed[0].artifact.id).toBe("code-review");
      expect(listJson.managed[0].catalog.sourceItemId).toBe("code-review");
    } finally {
      fetchMock.restore();
      consoleCapture.restore();
    }
  });
});
