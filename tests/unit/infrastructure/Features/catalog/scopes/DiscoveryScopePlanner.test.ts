import { describe, it, expect, beforeEach } from "bun:test";
import { DiscoveryScopePlanner } from "@/infrastructure/features/catalog/scopes/DiscoveryScopePlanner";
import { createSourceRegistry } from "@/core/domain/shared/entities/SourceRegistry";
import type { CatalogState } from "@/core/domain/shared/interfaces/ICatalogStateStore";

describe("DiscoveryScopePlanner", () => {
  let planner: DiscoveryScopePlanner;
  let state: CatalogState;

  beforeEach(() => {
    planner = new DiscoveryScopePlanner();
    state = {
      version: 1,
      registries: [createSourceRegistry("skillsmp"), createSourceRegistry("smithery")],
      discoveryScopes: [],
      catalogItems: [],
      managedIntegrations: [],
      compatibilityAssessments: [],
      operationLogs: [],
    };
  });

  describe("ensureScope", () => {
    it("should create and add new scope to state", () => {
      const scope = planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "test-query",
        query: "test query",
      });

      expect(scope.scopeId).toBe("skillsmp:query:test-query");
      expect(scope.registryId).toBe("skillsmp");
      expect(scope.scopeType).toBe("query");
      expect(scope.query).toBe("test query");
      expect(state.discoveryScopes).toHaveLength(1);
      expect(state.discoveryScopes[0]).toEqual(scope);
    });

    it("should return existing scope if it already exists", () => {
      const scope1 = planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "test-query",
        query: "test query",
      });

      const scope2 = planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "test-query",
        query: "different query", // This should be ignored
      });

      expect(scope1).toBe(scope2);
      expect(state.discoveryScopes).toHaveLength(1);
      expect(scope2.query).toBe("test query"); // Original value preserved
    });

    it("should sort discovery scopes by scopeId after adding", () => {
      planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "zebra",
        query: "zebra",
      });

      planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "alpha",
        query: "alpha",
      });

      planner.ensureScope(state, {
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "beta",
        query: "beta",
      });

      expect(state.discoveryScopes).toHaveLength(3);
      expect(state.discoveryScopes[0].scopeKey).toBe("alpha");
      expect(state.discoveryScopes[1].scopeKey).toBe("beta");
      expect(state.discoveryScopes[2].scopeKey).toBe("zebra");
    });

    it("should use provided scopeId if available", () => {
      const scope = planner.ensureScope(state, {
        scopeId: "custom-scope-id",
        registryId: "skillsmp",
        scopeType: "query",
        scopeKey: "test",
        query: "test",
      });

      expect(scope.scopeId).toBe("custom-scope-id");
    });
  });

  describe("planSkillScopes", () => {
    it("should create query scope when query is provided", () => {
      const scopes = planner.planSkillScopes(state, { query: "code review" });

      expect(scopes).toHaveLength(1);
      expect(scopes[0].scopeType).toBe("query");
      expect(scopes[0].query).toBe("code review");
      expect(scopes[0].registryId).toBe("skillsmp");
      expect(state.discoveryScopes).toHaveLength(1);
    });

    it("should create category scope when category is provided", () => {
      const scopes = planner.planSkillScopes(state, { category: "development" });

      expect(scopes).toHaveLength(1);
      expect(scopes[0].scopeType).toBe("category");
      expect(scopes[0].category).toBe("development");
      expect(scopes[0].registryId).toBe("skillsmp");
      expect(state.discoveryScopes).toHaveLength(1);
    });

    it("should create tracked-items scope when trackedItems are provided", () => {
      const scopes = planner.planSkillScopes(state, {
        trackedItems: ["skill1", "skill2", "skill1"],
      });

      expect(scopes).toHaveLength(1);
      expect(scopes[0].scopeType).toBe("tracked-items");
      expect(scopes[0].query).toBe("skill1,skill2"); // Deduplicated and sorted
      expect(scopes[0].registryId).toBe("skillsmp");
      expect(state.discoveryScopes).toHaveLength(1);
    });

    it("should deduplicate and sort tracked items", () => {
      const scopes = planner.planSkillScopes(state, {
        trackedItems: ["zebra", "alpha", "beta", "alpha", "zebra"],
      });

      expect(scopes).toHaveLength(1);
      expect(scopes[0].query).toBe("alpha,beta,zebra");
    });

    it("should create multiple scopes when query and category are provided", () => {
      const scopes = planner.planSkillScopes(state, {
        query: "code review",
        category: "development",
      });

      expect(scopes).toHaveLength(2);
      expect(scopes[0].scopeType).toBe("query");
      expect(scopes[0].query).toBe("code review");
      expect(scopes[1].scopeType).toBe("category");
      expect(scopes[1].category).toBe("development");
    });

    it("should create multiple scopes when all options are provided", () => {
      const scopes = planner.planSkillScopes(state, {
        query: "test",
        category: "testing",
        trackedItems: ["skill1"],
      });

      expect(scopes).toHaveLength(3);
      expect(scopes.map((s) => s.scopeType)).toEqual(["query", "category", "tracked-items"]);
    });

    it("should trim and lowercase scope keys", () => {
      const scopes = planner.planSkillScopes(state, {
        query: "  Code Review  ",
      });

      expect(scopes[0].scopeKey).toBe("code review");
    });

    it("should return all skillsmp scopes when no options are provided", () => {
      // Pre-populate state with some scopes
      state.discoveryScopes = [
        {
          scopeId: "skillsmp:query:scope1",
          registryId: "skillsmp",
          scopeType: "query",
          scopeKey: "scope1",
          query: "test1",
        },
        {
          scopeId: "smithery:query:scope2",
          registryId: "smithery",
          scopeType: "query",
          scopeKey: "scope2",
          query: "test2",
        },
        {
          scopeId: "skillsmp:category:scope3",
          registryId: "skillsmp",
          scopeType: "category",
          scopeKey: "scope3",
          category: "test3",
        },
      ];

      const scopes = planner.planSkillScopes(state, {});

      expect(scopes).toHaveLength(2);
      expect(scopes.every((s) => s.registryId === "skillsmp")).toBe(true);
      expect(scopes.map((s) => s.scopeId)).toEqual(["skillsmp:query:scope1", "skillsmp:category:scope3"]);
    });

    it("should return empty array when no options and no existing scopes", () => {
      const scopes = planner.planSkillScopes(state, {});

      expect(scopes).toHaveLength(0);
    });

    it("should not create new scope if query scope already exists", () => {
      const existingScope = {
        scopeId: "skillsmp:query:test query",
        registryId: "skillsmp" as const,
        scopeType: "query" as const,
        scopeKey: "test query",
        query: "existing query",
      };

      state.discoveryScopes = [existingScope];

      const scopes = planner.planSkillScopes(state, { query: "Test Query" });

      expect(scopes).toHaveLength(1);
      expect(scopes[0]).toBe(existingScope);
      expect(scopes[0].query).toBe("existing query"); // Not updated
      expect(state.discoveryScopes).toHaveLength(1); // No new scope added
    });
  });

  describe("listScopes", () => {
    beforeEach(() => {
      state.discoveryScopes = [
        {
          scopeId: "skillsmp:query:scope1",
          registryId: "skillsmp",
          scopeType: "query",
          scopeKey: "scope1",
          query: "test1",
        },
        {
          scopeId: "smithery:query:scope2",
          registryId: "smithery",
          scopeType: "query",
          scopeKey: "scope2",
          query: "test2",
        },
        {
          scopeId: "skillsmp:category:scope3",
          registryId: "skillsmp",
          scopeType: "category",
          scopeKey: "scope3",
          category: "test3",
        },
      ];
    });

    it("should filter scopes by registryId", () => {
      const skillsmpScopes = planner.listScopes(state, "skillsmp");
      const smitheryScopes = planner.listScopes(state, "smithery");

      expect(skillsmpScopes).toHaveLength(2);
      expect(skillsmpScopes.every((s) => s.registryId === "skillsmp")).toBe(true);

      expect(smitheryScopes).toHaveLength(1);
      expect(smitheryScopes[0].registryId).toBe("smithery");
    });

    it("should return empty array when no scopes match registryId", () => {
      // Remove skillsmp scopes from state before calling listScopes
      state.discoveryScopes = state.discoveryScopes.filter((s) => s.registryId !== "skillsmp");

      const scopes = planner.listScopes(state, "skillsmp");

      expect(scopes).toHaveLength(0);
    });

    it("should return all scopes when all match registryId", () => {
      state.discoveryScopes = [
        {
          scopeId: "skillsmp:scope1",
          registryId: "skillsmp",
          scopeType: "query",
          scopeKey: "scope1",
          query: "test1",
        },
        {
          scopeId: "skillsmp:scope2",
          registryId: "skillsmp",
          scopeType: "category",
          scopeKey: "scope2",
          category: "test2",
        },
      ];

      const scopes = planner.listScopes(state, "skillsmp");

      expect(scopes).toHaveLength(2);
    });
  });
});
