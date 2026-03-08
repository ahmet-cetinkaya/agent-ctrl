import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempConfigRoot, installMockFetch } from "../../../../helpers/catalogTestUtils";
import { CatalogCachePolicy } from "@/infrastructure/features/catalog/caching/CatalogCachePolicy";
import { createSourceRegistry } from "@/core/domain/shared/entities/SourceRegistry";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { SearchSkillsQuery } from "@/core/application/features/skill/queries/SearchSkillsQuery";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";

describe("Catalog sync resilience", () => {
  let baseDir = "";
  let configRoot = "";

  beforeEach(async () => {
    ({ baseDir, configRoot } = await createTempConfigRoot("catalog-resilience-"));
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    delete process.env.SMITHERY_API_KEY;
    await cleanupTempDir(baseDir);
  });

  it("reuses fresh cache without issuing new source requests", async () => {
    process.env.SKILLSMP_API_KEY = "skills-test-key";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: () => new Response(JSON.stringify({ skills: [{ id: "code-review", name: "Code Review", capabilities: ["review"], categories: ["dev"], version: "1.0.0" }] }), { status: 200, headers: { "Content-Type": "application/json", "X-RateLimit-Daily-Limit": "500", "X-RateLimit-Daily-Remaining": "500" } }),
      },
    ]);

    try {
      await new SkillCatalogSynchronizer().synchronize({ configRoot, query: "code review", force: true });
      const callsAfterSync = fetchMock.calls.length;
      const result = await new SearchSkillsQuery().execute({ configRoot, query: "code" });
      expect(result.success).toBe(true);
      expect(fetchMock.calls.length).toBe(callsAfterSync);
    } finally {
      fetchMock.restore();
    }
  });

  it("fails closed when source credentials are missing", async () => {
    const result = await new McpCatalogSynchronizer().synchronize({ configRoot, force: true });
    expect(result.report.registryResults[0].status).toBe("failed");
    expect(result.report.registryResults[0].issues[0]).toContain("Smithery API key is missing");
    expect(result.items).toHaveLength(0);
  });

  it("treats fresh registries as cache hits and throttled registries as non-refreshable", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    const policy = new CatalogCachePolicy(60_000, () => now);
    const fresh = createSourceRegistry("skillsmp");
    fresh.lastSyncSucceededAt = now.toISOString();
    fresh.cacheFreshUntil = new Date(now.getTime() + 30_000).toISOString();

    const throttled = createSourceRegistry("smithery");
    throttled.lastSyncSucceededAt = now.toISOString();
    throttled.throttleUntil = new Date(now.getTime() + 30_000).toISOString();

    expect(policy.shouldRefresh(fresh, { force: false })).toEqual({ shouldRefresh: false, reason: "fresh" });
    expect(policy.shouldRefresh(throttled, { force: false })).toEqual({ shouldRefresh: false, reason: "throttled" });
  });
});
