import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../helpers/catalogTestUtils";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { AddSkillCommand } from "@/core/application/features/skill/commands/AddSkillCommand";
import { RemoveSkillCommand } from "@/core/application/features/skill/commands/RemoveSkillCommand";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";

describe("Skill activation flow", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("skill-activation-"));
    process.env.SKILLSMP_API_KEY = "skills-test-key";
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("activates, deactivates, and preserves history while blocking unavailable items", async () => {
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
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" } }
          ),
      },
      {
        match: (url) => url.pathname === "/skills/code-review",
        handler: () => new Response("<pre># Code Review\n\nReview code.</pre>", { status: 200 }),
      },
    ]);

    try {
      await new SkillCatalogSynchronizer().synchronize({ configRoot, query: "code review", force: true });
      const addResult = await new AddSkillCommand().execute({ configRoot, ref: "skillsmp:code-review" });
      expect(addResult.success).toBe(true);
      await access(resolve(configRoot, "skills", "code-review", "SKILL.md"));

      const removeResult = await new RemoveSkillCommand().execute({ configRoot, ref: "code-review" });
      expect(removeResult.success).toBe(true);

      const state = await new CatalogStateFileStore().load(configRoot);
      expect(state.success).toBe(true);
      if (state.success) {
        expect(state.data.managedIntegrations[0].state).toBe("inactive");
        state.data.catalogItems[0].availabilityState = "unavailable";
        await new CatalogStateFileStore().save(configRoot, state.data);
      }

      const blocked = await new AddSkillCommand().execute({ configRoot, ref: "skillsmp:code-review" });
      expect(blocked.success).toBe(false);
      if (!blocked.success) {
        expect(blocked.error.message).toContain("no longer available");
      }
    } finally {
      fetchMock.restore();
    }
  });

  it("hydrates real skill files from the upstream GitHub folder when the synchronized catalog lacks installation content", async () => {
    let searchCalls = 0;
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: () => {
          searchCalls += 1;
          return (
          new Response(
            JSON.stringify({
              skills: [
                {
                  id: "morphicai-openclaw-morphixai-packages-openclaw-plugin-skills-notion-skill-md",
                  name: "notion",
                  description: "Notion integration",
                  capabilities: ["notion"],
                  categories: ["productivity"],
                  version: "1.0.0",
                  githubUrl: "https://github.com/Morphicai/openclaw-morphixai/tree/main/packages/openclaw-plugin/skills/notion",
                  skillUrl:
                    "https://skillsmp.com/skills/morphicai-openclaw-morphixai-packages-openclaw-plugin-skills-notion-skill-md",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" } }
          )
          );
        },
      },
      {
        match: (url) =>
          url.hostname === "api.github.com" &&
          url.pathname === "/repos/Morphicai/openclaw-morphixai/contents/packages/openclaw-plugin/skills/notion",
        handler: () =>
          new Response(
            JSON.stringify([
              {
                type: "file",
                path: "packages/openclaw-plugin/skills/notion/SKILL.md",
                download_url:
                  "https://raw.githubusercontent.com/Morphicai/openclaw-morphixai/main/packages/openclaw-plugin/skills/notion/SKILL.md",
              },
              {
                type: "dir",
                path: "packages/openclaw-plugin/skills/notion/scripts",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) =>
          url.hostname === "api.github.com" &&
          url.pathname === "/repos/Morphicai/openclaw-morphixai/contents/packages/openclaw-plugin/skills/notion/scripts",
        handler: () =>
          new Response(
            JSON.stringify([
              {
                type: "file",
                path: "packages/openclaw-plugin/skills/notion/scripts/notion.sh",
                download_url:
                  "https://raw.githubusercontent.com/Morphicai/openclaw-morphixai/main/packages/openclaw-plugin/skills/notion/scripts/notion.sh",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) =>
          url.hostname === "raw.githubusercontent.com" &&
          url.pathname === "/Morphicai/openclaw-morphixai/main/packages/openclaw-plugin/skills/notion/SKILL.md",
        handler: () =>
          new Response(
            "---\nname: notion\ndescription: Notion API for creating and managing pages.\n---\n\n# notion\n\nReal remote skill content.\n",
            { status: 200, headers: { "Content-Type": "text/markdown" } }
          ),
      },
      {
        match: (url) =>
          url.hostname === "raw.githubusercontent.com" &&
          url.pathname === "/Morphicai/openclaw-morphixai/main/packages/openclaw-plugin/skills/notion/scripts/notion.sh",
        handler: () => new Response("#!/usr/bin/env bash\necho notion\n", { status: 200, headers: { "Content-Type": "text/plain" } }),
      },
    ]);

    try {
      await new SkillCatalogSynchronizer().synchronize({ configRoot, query: "notion", force: true });

      const addResult = await new AddSkillCommand().execute({ configRoot, ref: "skillsmp:notion" });
      expect(addResult.success).toBe(true);
      if (!addResult.success) {
        return;
      }

      const skillMd = await readFile(resolve(addResult.data.managedIntegration.localPath, "SKILL.md"), "utf-8");
      const helperScript = await readFile(
        resolve(addResult.data.managedIntegration.localPath, "scripts", "notion.sh"),
        "utf-8"
      );

      expect(skillMd).toContain("Real remote skill content.");
      expect(helperScript).toContain("echo notion");
      expect(fetchMock.calls.some((call) => call.includes("api.github.com/repos/Morphicai/openclaw-morphixai/contents"))).toBe(true);
      expect(fetchMock.calls.some((call) => call.includes("raw.githubusercontent.com/Morphicai/openclaw-morphixai/main/packages/openclaw-plugin/skills/notion/SKILL.md"))).toBe(true);
      expect(fetchMock.calls.some((call) => call.includes("/skills/morphicai-openclaw-morphixai-packages-openclaw-plugin-skills-notion-skill-md"))).toBe(false);
      expect(searchCalls).toBe(1);
    } finally {
      fetchMock.restore();
    }
  });

  it("resolves a SkillsMP slug ref via repository fallback when slug search returns no exact match", async () => {
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search" && url.searchParams.get("q") === "openclaw-openclaw-skills-notion-skill-md",
        handler: () =>
          new Response(JSON.stringify({ skills: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" },
          }),
      },
      {
        match: (url) => url.pathname === "/api/v1/skills/search" && url.searchParams.get("q") === "notion",
        handler: () =>
          new Response(JSON.stringify({ skills: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" },
          }),
      },
      {
        match: (url) =>
          url.hostname === "api.github.com" && url.pathname === "/repos/openclaw/openclaw/contents/skills/notion",
        handler: () =>
          new Response(
            JSON.stringify([
              {
                type: "file",
                path: "skills/notion/SKILL.md",
                download_url: "https://raw.githubusercontent.com/openclaw/openclaw/main/skills/notion/SKILL.md",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
      {
        match: (url) =>
          url.hostname === "raw.githubusercontent.com" &&
          url.pathname === "/openclaw/openclaw/main/skills/notion/SKILL.md",
        handler: () =>
          new Response("# notion\n\nNotion API for creating and managing pages, databases, and blocks.\n", {
            status: 200,
            headers: { "Content-Type": "text/markdown" },
          }),
      },
    ]);

    try {
      const addResult = await new AddSkillCommand().execute({
        configRoot,
        ref: "skillsmp:openclaw-openclaw-skills-notion-skill-md",
      });
      expect(addResult.success).toBe(true);
      if (!addResult.success) {
        return;
      }

      const skillMd = await readFile(resolve(addResult.data.managedIntegration.localPath, "SKILL.md"), "utf-8");
      expect(skillMd).toContain("Notion API for creating and managing pages");
      expect(fetchMock.calls.some((call) => call.includes("/repos/openclaw/openclaw/contents/skills/notion"))).toBe(true);
      expect(fetchMock.calls.some((call) => call.includes("/skills/openclaw-openclaw-skills-notion-skill-md"))).toBe(false);
    } finally {
      fetchMock.restore();
    }
  });
});
