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

  it("handles malformed API responses with graceful degradation", async () => {
    process.env.SKILLSMP_API_KEY = "skills-test-key";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/api/v1/skills/search",
        handler: () =>
          new Response(
            JSON.stringify({
              skills: [
                { id: null, displayName: 123, description: {} }, // Malformed
                {}, // Empty object
              ],
              pagination: { currentPage: "invalid" }, // Wrong type
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      const result = await new SkillCatalogSynchronizer().synchronize({ configRoot, force: true });
      // Should not crash, should handle gracefully
      expect(result.report.registryResults[0].status).toBe("success");
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    } finally {
      fetchMock.restore();
    }
  });

  it("handles empty arrays and missing fields gracefully", async () => {
    process.env.SMITHERY_API_KEY = "smithery-test-key";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [], // Empty array
              pagination: null, // Missing pagination
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      const result = await new McpCatalogSynchronizer().synchronize({ configRoot, force: true });
      expect(result.report.registryResults[0].status).toBe("success");
      expect(result.items).toHaveLength(0);
    } finally {
      fetchMock.restore();
    }
  });

  it("handles concurrent sync operations safely", async () => {
    process.env.SMITHERY_API_KEY = "smithery-test-key";
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers",
        handler: () =>
          new Response(
            JSON.stringify({
              servers: [{ qualifiedName: "test-server", displayName: "Test Server", description: "A test server" }],
              pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
      },
    ]);

    try {
      // Launch multiple concurrent sync operations
      const promises = [
        new McpCatalogSynchronizer().synchronize({ configRoot, force: true }),
        new McpCatalogSynchronizer().synchronize({ configRoot, force: true }),
        new McpCatalogSynchronizer().synchronize({ configRoot, force: true }),
      ];

      const results = await Promise.all(promises);

      // All should succeed without corruption
      results.forEach((r) => {
        expect(r.report.registryResults[0].status).toBe("success");
      });

      // State should be consistent
      const { CatalogStateFileStore } = await import("@/infrastructure/features/catalog/caching/CatalogStateFileStore");
      const store = new CatalogStateFileStore();
      const state = await store.load(configRoot);
      expect(state.success).toBe(true);
    } finally {
      fetchMock.restore();
    }
  });

  it("preserves partial results when pagination fails mid-stream", async () => {
    process.env.SMITHERY_API_KEY = "smithery-test-key";
    let _callCount = 0;
    const fetchMock = installMockFetch([
      {
        match: (url) => url.pathname === "/servers" && url.searchParams.get("page") === "1",
        handler: () => {
          _callCount++;
          return new Response(
            JSON.stringify({
              servers: [{ qualifiedName: "server-1", displayName: "Server 1", description: "First server" }],
              pagination: { currentPage: 1, totalPages: 3, totalCount: 3 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        },
      },
      {
        match: (url) => url.pathname === "/servers" && url.searchParams.get("page") === "2",
        handler: () => {
          _callCount++;
          return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
        },
      },
    ]);

    try {
      const result = await new McpCatalogSynchronizer().synchronize({ configRoot, force: true });
      // Should report partial status with some data
      expect(result.report.registryResults[0].status).toBe("partial");
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      // Should report issues about the pagination failure
      expect(result.report.registryResults[0].issues.length).toBeGreaterThan(0);
    } finally {
      fetchMock.restore();
    }
  });
});
