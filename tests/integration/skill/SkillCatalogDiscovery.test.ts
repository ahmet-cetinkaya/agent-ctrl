import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempConfigRoot, installMockFetch, readJson } from "../../helpers/catalogTestUtils";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { SearchSkillsQuery } from "@/core/application/features/skill/queries/SearchSkillsQuery";

describe("Skill catalog discovery", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("skill-discovery-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("persists scoped discovery results and deduplicates repeated syncs", async () => {
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
                  version: "1.0.0",
                },
                {
                  id: "code-review",
                  name: "Code Review",
                  description: "Review code",
                  capabilities: ["review"],
                  categories: ["dev"],
                  version: "1.0.0",
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Daily-Limit": "500",
                "X-RateLimit-Daily-Remaining": "498",
              },
            }
          ),
      },
    ]);

    try {
      const synchronizer = new SkillCatalogSynchronizer();
      await synchronizer.synchronize({ configRoot, query: "code review", force: true });
      await synchronizer.synchronize({ configRoot, query: "code review", force: true });

      const state = (await readJson(`${configRoot}/.catalog/state.json`)) as {
        discoveryScopes: Array<{ scopeId: string }>;
        catalogItems: Array<{ catalogKey: string }>;
      };
      expect(state.discoveryScopes.some((scope) => scope.scopeId.includes("code review"))).toBe(true);
      expect(state.catalogItems.filter((item) => item.catalogKey === "skillsmp:code-review")).toHaveLength(1);

      const query = new SearchSkillsQuery();
      const result = await query.execute({ configRoot, query: "review" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
      }
    } finally {
      fetchMock.restore();
    }
  });
});
