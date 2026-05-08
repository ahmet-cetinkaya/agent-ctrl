import { describe, it, expect, beforeEach } from "bun:test";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import type { CatalogItem } from "@/core/domain/shared/entities";

describe("CatalogCompatibilityEvaluator", () => {
  let evaluator: CatalogCompatibilityEvaluator;

  beforeEach(() => {
    evaluator = new CatalogCompatibilityEvaluator();
  });

  const createMockCatalogItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
    catalogKey: "skillsmp:test-skill",
    registryId: "skillsmp",
    itemType: "skill",
    sourceItemId: "test-skill",
    displayName: "Test Skill",
    compatibilityState: "unknown",
    activationState: "inactive",
    availabilityState: "available",
    capabilities: [],
    categories: [],
    lastSeenAt: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  describe("evaluate", () => {
    it("should return unknown state when no compatibility metadata is provided", () => {
      const item = createMockCatalogItem();

      const result = evaluator.evaluate(item);

      expect(result.catalogKey).toBe("skillsmp:test-skill");
      expect(result.state).toBe("unknown");
      expect(result.reasons).toEqual([]);
      expect(result.requiredConstraints).toEqual([]);
      expect(result.checkedAt).toBeDefined();
    });

    it("should use forced compatibility state from metadata", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "compatible",
            reasons: ["Test reason 1", "Test reason 2"],
            requiredConstraints: ["constraint1", "constraint2"],
          },
        },
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("compatible");
      expect(result.reasons).toEqual(["Test reason 1", "Test reason 2"]);
      expect(result.requiredConstraints).toEqual(["constraint1", "constraint2"]);
    });

    it("should return incompatible when capability requires unavailable runtime", () => {
      const item = createMockCatalogItem({
        capabilities: ["feature1", "requires-unavailable-runtime", "feature2"],
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("incompatible");
      expect(result.reasons).toEqual(["Required runtime or capability is unavailable in the current environment."]);
    });

    it("should be case-insensitive when checking for requires-unavailable-runtime", () => {
      const item = createMockCatalogItem({
        capabilities: ["REQUIRES-UNAVAILABLE-RUNTIME"],
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("incompatible");
      expect(result.reasons).toHaveLength(1);
    });

    it("should return incompatible when capability contains requires-unavailable-runtime as substring", () => {
      const item = createMockCatalogItem({
        capabilities: ["some-requires-unavailable-runtime-feature"],
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("incompatible");
    });

    it("should prioritize forced state over runtime requirement check", () => {
      const item = createMockCatalogItem({
        capabilities: ["requires-unavailable-runtime"],
        metadata: {
          compatibility: {
            state: "compatible",
            reasons: ["Manual override"],
          },
        },
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("compatible");
      expect(result.reasons).toEqual(["Manual override"]);
    });

    it("should use provided reasons and constraints when state is forced", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "incompatible",
            reasons: ["Custom reason"],
            requiredConstraints: ["Node.js >= 18"],
          },
        },
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("incompatible");
      expect(result.reasons).toEqual(["Custom reason"]);
      expect(result.requiredConstraints).toEqual(["Node.js >= 18"]);
    });

    it("should include empty reasons and constraints when not provided in forced state", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "compatible",
          },
        },
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("compatible");
      expect(result.reasons).toEqual([]);
      expect(result.requiredConstraints).toEqual([]);
    });

    it("should handle multiple capabilities with one requiring unavailable runtime", () => {
      const item = createMockCatalogItem({
        capabilities: ["feature1", "feature2", "requires-unavailable-runtime", "feature3"],
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("incompatible");
    });

    it("should return unknown for normal capabilities without runtime requirements", () => {
      const item = createMockCatalogItem({
        capabilities: ["code-review", "refactoring", "formatting"],
      });

      const result = evaluator.evaluate(item);

      expect(result.state).toBe("unknown");
      expect(result.reasons).toEqual([]);
    });
  });

  describe("canActivate", () => {
    it("should allow activation when state is unknown", () => {
      const item = createMockCatalogItem();

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(true);
      expect(result.assessment.state).toBe("unknown");
      expect(result.message).toBeUndefined();
    });

    it("should allow activation when state is compatible", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "compatible",
          },
        },
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(true);
      expect(result.assessment.state).toBe("compatible");
    });

    it("should deny activation when state is incompatible", () => {
      const item = createMockCatalogItem({
        capabilities: ["requires-unavailable-runtime"],
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(false);
      expect(result.assessment.state).toBe("incompatible");
      expect(result.message).toBe("Required runtime or capability is unavailable in the current environment.");
    });

    it("should include custom reasons in denial message", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "incompatible",
            reasons: ["Requires Python 3.12", "Needs GPU"],
          },
        },
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe("Requires Python 3.12 Needs GPU");
    });

    it("should use default message when no reasons are provided", () => {
      const item = createMockCatalogItem({
        capabilities: ["requires-unavailable-runtime"],
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe("Required runtime or capability is unavailable in the current environment.");
    });

    it("should return assessment even when activation is allowed", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "compatible",
            reasons: ["Verified compatible"],
          },
        },
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(true);
      expect(result.assessment.state).toBe("compatible");
      expect(result.assessment.reasons).toEqual(["Verified compatible"]);
      expect(result.message).toBeUndefined();
    });

    it("should handle forced incompatible state with empty reasons", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "incompatible",
            reasons: [],
          },
        },
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe("Item is incompatible with the current environment.");
    });

    it("should combine forced incompatible state with custom message", () => {
      const item = createMockCatalogItem({
        metadata: {
          compatibility: {
            state: "incompatible",
            reasons: ["Platform not supported", "Missing dependency"],
          },
        },
      });

      const result = evaluator.canActivate(item);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe("Platform not supported Missing dependency");
    });
  });
});
