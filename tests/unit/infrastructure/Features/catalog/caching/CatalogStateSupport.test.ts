import { describe, expect, it, beforeEach } from "bun:test";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { createSourceRegistry } from "@/core/domain/shared/entities/SourceRegistry";
import type { CatalogState } from "@/core/domain/shared/interfaces/ICatalogStateStore";

describe("CatalogStateSupport", () => {
  let stateSupport: CatalogStateSupport;
  let state: CatalogState;

  beforeEach(() => {
    stateSupport = new CatalogStateSupport();
    state = {
      version: 1,
      registries: [],
      discoveryScopes: [],
      catalogItems: [],
      managedIntegrations: [],
      compatibilityAssessments: [],
      operationLogs: [],
    };
  });

  describe("getRegistry", () => {
    it("returns existing registry when it exists", () => {
      const existingRegistry = createSourceRegistry("smithery");
      state.registries.push(existingRegistry);

      const result = stateSupport.getRegistry(state, "smithery");

      expect(result.registryId).toBe("smithery");
      expect(state.registries.length).toBe(1);
    });

    it("creates new registry when it does not exist", () => {
      const result = stateSupport.getRegistry(state, "smithery");

      expect(result.registryId).toBe("smithery");
      expect(state.registries.length).toBe(1);
    });

    it("sorts registries after adding new one", () => {
      state.registries.push(createSourceRegistry("smithery"));

      stateSupport.getRegistry(state, "skillsmp");

      expect(state.registries.map((r) => r.registryId)).toEqual(["skillsmp", "smithery"]);
    });
  });

  describe("updateCatalogAvailability", () => {
    it("does nothing when markMissingUnavailable is false", () => {
      state.catalogItems.push({
        catalogKey: "skill:test",
        registryId: "smithery",
        itemType: "skill",
        sourceItemId: "test",
        displayName: "Test",
        description: "Test skill",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available",
        compatibilityState: "unknown",
        activationState: "inactive",
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      });

      stateSupport.updateCatalogAvailability(state, "smithery", new Set(["skill:test"]), {
        markMissingUnavailable: false,
      });

      expect(state.catalogItems[0].availabilityState).toBe("available");
    });

    it("marks missing items as unavailable when markMissingUnavailable is true", () => {
      state.catalogItems.push(
        {
          catalogKey: "smithery:exists",
          registryId: "smithery",
          itemType: "skill",
          sourceItemId: "exists",
          displayName: "Exists",
          description: "Exists",
          capabilities: [],
          categories: [],
          sourceVersion: "1.0.0",
          availabilityState: "available",
          compatibilityState: "unknown",
          activationState: "inactive",
          lastSeenAt: "2024-01-01T00:00:00Z",
          lastSyncAt: "2024-01-01T00:00:00Z",
          sourceUrl: "https://example.com",
        },
        {
          catalogKey: "smithery:missing",
          registryId: "smithery",
          itemType: "skill",
          sourceItemId: "missing",
          displayName: "Missing",
          description: "Missing",
          capabilities: [],
          categories: [],
          sourceVersion: "1.0.0",
          availabilityState: "available",
          compatibilityState: "unknown",
          activationState: "inactive",
          lastSeenAt: "2024-01-01T00:00:00Z",
          lastSyncAt: "2024-01-01T00:00:00Z",
          sourceUrl: "https://example.com",
        }
      );

      stateSupport.updateCatalogAvailability(state, "smithery", new Set(["smithery:exists"]), {
        markMissingUnavailable: true,
      });

      const exists = state.catalogItems.find((i) => i.catalogKey === "smithery:exists");
      const missing = state.catalogItems.find((i) => i.catalogKey === "smithery:missing");

      expect(exists?.availabilityState).toBe("available");
      expect(missing?.availabilityState).toBe("unavailable");
      expect(missing?.removedAt).toBeDefined();
    });

    it("keeps active items as active when marking unavailable", () => {
      state.catalogItems.push({
        catalogKey: "smithery:active-missing",
        registryId: "smithery",
        itemType: "skill",
        sourceItemId: "active-missing",
        displayName: "Active Missing",
        description: "Active but missing from catalog",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available",
        compatibilityState: "unknown",
        activationState: "active",
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      });

      stateSupport.updateCatalogAvailability(state, "smithery", new Set([]), { markMissingUnavailable: true });

      expect(state.catalogItems[0].availabilityState).toBe("unavailable");
      expect(state.catalogItems[0].activationState).toBe("active");
    });

    it("marks inactive items as activation-blocked", () => {
      state.catalogItems.push({
        catalogKey: "smithery:inactive-missing",
        registryId: "smithery",
        itemType: "skill",
        sourceItemId: "inactive-missing",
        displayName: "Inactive Missing",
        description: "Inactive and missing from catalog",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available",
        compatibilityState: "unknown",
        activationState: "inactive",
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      });

      stateSupport.updateCatalogAvailability(state, "smithery", new Set([]), { markMissingUnavailable: true });

      expect(state.catalogItems[0].availabilityState).toBe("unavailable");
      expect(state.catalogItems[0].activationState).toBe("activation-blocked");
    });

    it("does not affect items from other registries", () => {
      state.catalogItems.push({
        catalogKey: "skillsmp:item",
        registryId: "skillsmp",
        itemType: "skill",
        sourceItemId: "item",
        displayName: "Item",
        description: "Item",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available",
        compatibilityState: "unknown",
        activationState: "inactive",
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      });

      stateSupport.updateCatalogAvailability(state, "smithery", new Set([]), { markMissingUnavailable: true });

      expect(state.catalogItems[0].availabilityState).toBe("available");
    });
  });

  describe("upsertCatalogItems", () => {
    it("adds new items to empty catalog", () => {
      const newItem = {
        catalogKey: "smithery:new-item",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "new-item",
        displayName: "New Item",
        description: "A new skill",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [newItem]);

      expect(state.catalogItems).toHaveLength(1);
      expect(state.catalogItems[0].catalogKey).toBe("smithery:new-item");
    });

    it("updates existing items when catalogKey matches", () => {
      state.catalogItems.push({
        catalogKey: "smithery:existing",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "existing",
        displayName: "Existing",
        description: "Old description",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      });

      const updatedItem = {
        catalogKey: "smithery:existing",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "existing",
        displayName: "Updated",
        description: "New description",
        capabilities: [],
        categories: [],
        sourceVersion: "2.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [updatedItem]);

      expect(state.catalogItems).toHaveLength(1);
      expect(state.catalogItems[0].description).toBe("New description");
      expect(state.catalogItems[0].sourceVersion).toBe("2.0.0");
    });
  });

  describe("resolveActivationState through upsertCatalogItems", () => {
    it("sets update-available when managed has update-available state", () => {
      state.managedIntegrations.push({
        managedId: "test-skill",
        catalogKey: "smithery:test-skill",
        itemType: "skill",
        localPath: "/path/to/skill",
        state: "update-available",
        installedVersion: "1.0.0",
        requestedVersion: "2.0.0",
        installedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        lastOperationStatus: "success",
        sourceRef: "smithery:test-skill",
      });

      const newItem = {
        catalogKey: "smithery:test-skill",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        capabilities: [],
        categories: [],
        sourceVersion: "2.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [newItem]);

      expect(state.catalogItems[0].activationState).toBe("update-available");
    });

    it("sets update-available when active with version mismatch", () => {
      state.managedIntegrations.push({
        managedId: "test-skill",
        catalogKey: "smithery:test-skill",
        itemType: "skill",
        localPath: "/path/to/skill",
        state: "active",
        installedVersion: "1.0.0",
        requestedVersion: undefined,
        installedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        lastOperationStatus: "success",
        sourceRef: "smithery:test-skill",
      });

      const newItem = {
        catalogKey: "smithery:test-skill",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        capabilities: [],
        categories: [],
        sourceVersion: "2.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [newItem]);

      expect(state.catalogItems[0].activationState).toBe("update-available");
    });

    it("keeps active when active with same version", () => {
      state.managedIntegrations.push({
        managedId: "test-skill",
        catalogKey: "smithery:test-skill",
        itemType: "skill",
        localPath: "/path/to/skill",
        state: "active",
        installedVersion: "1.0.0",
        requestedVersion: undefined,
        installedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        lastOperationStatus: "success",
        sourceRef: "smithery:test-skill",
      });

      const newItem = {
        catalogKey: "smithery:test-skill",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available" as const,
        compatibilityState: "unknown" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [newItem]);

      expect(state.catalogItems[0].activationState).toBe("active");
    });

    it("blocks activation when item compatibility is incompatible", () => {
      const newItem = {
        catalogKey: "smithery:incompatible-skill",
        registryId: "smithery" as const,
        itemType: "skill" as const,
        sourceItemId: "incompatible-skill",
        displayName: "Incompatible Skill",
        description: "An incompatible skill",
        capabilities: [],
        categories: [],
        sourceVersion: "1.0.0",
        availabilityState: "available" as const,
        compatibilityState: "incompatible" as const,
        activationState: "inactive" as const,
        lastSeenAt: "2024-01-01T00:00:00Z",
        lastSyncAt: "2024-01-01T00:00:00Z",
        sourceUrl: "https://example.com",
      };

      stateSupport.upsertCatalogItems(state, [newItem]);

      expect(state.catalogItems[0].activationState).toBe("activation-blocked");
    });
  });
});
