import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { AddSkillCommand } from "@/core/application/features/skill/commands/AddSkillCommand";
import { UpdateSkillCommand } from "@/core/application/features/skill/commands/UpdateSkillCommand";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("Skill update flow", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("skill-update-flow-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("refreshes and updates managed skills when a new source version is available", async () => {
    let version = "1.0.0";
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
                  description: "Review code",
                  capabilities: ["review"],
                  categories: ["dev"],
                  version,
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Daily-Limit": "500",
                "X-RateLimit-Daily-Remaining": "500",
              },
            }
          ),
      },
      {
        match: (url) => url.pathname === "/skills/code-review",
        handler: () => new Response("<pre># Code Review</pre>", { status: 200 }),
      },
    ]);

    try {
      await new SkillCatalogSynchronizer().synchronize({ configRoot, query: "code review", force: true });
      await new AddSkillCommand().execute({ configRoot, ref: "skillsmp:code-review" });
      version = "1.1.0";
      const update = await new UpdateSkillCommand().execute({ configRoot, all: true, refresh: true });
      expect(update.success).toBe(true);
      if (update.success) {
        expect(update.data.changed).toBe(1);
      }
    } finally {
      fetchMock.restore();
    }
  });

  it("re-fetches installable skill files after refresh replaces catalog metadata", async () => {
    let version = "1.0.0";
    let skillMarkdown = "# Code Review v1\n";
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
                  description: "Review code",
                  capabilities: ["review"],
                  categories: ["dev"],
                  version,
                  githubUrl: "https://github.com/acme/skills/tree/main/code-review",
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Daily-Limit": "500",
                "X-RateLimit-Daily-Remaining": "500",
              },
            }
          ),
      },
      {
        match: (url) => url.hostname === "api.github.com" && url.pathname === "/repos/acme/skills/contents/code-review",
        handler: () =>
          new Response(
            JSON.stringify([
              {
                type: "file",
                path: "code-review/SKILL.md",
                download_url: "https://raw.githubusercontent.com/acme/skills/main/code-review/SKILL.md",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) =>
          url.hostname === "raw.githubusercontent.com" && url.pathname === "/acme/skills/main/code-review/SKILL.md",
        handler: () => new Response(skillMarkdown, { status: 200, headers: { "Content-Type": "text/markdown" } }),
      },
    ]);

    try {
      await new SkillCatalogSynchronizer().synchronize({ configRoot, query: "code review", force: true });
      await new AddSkillCommand().execute({ configRoot, ref: "skillsmp:code-review" });

      version = "1.1.0";
      skillMarkdown = "# Code Review v1.1\n";

      const update = await new UpdateSkillCommand().execute({ configRoot, all: true, refresh: true });
      expect(update.success).toBe(true);
      if (!update.success) {
        return;
      }

      const installed = await readFile(resolve(configRoot, "skills", "code-review", "SKILL.md"), "utf-8");
      expect(update.data.changed).toBe(1);
      expect(installed).toContain("v1.1");
    } finally {
      fetchMock.restore();
    }
  });
});
