import type { CatalogState } from "@/core/domain/shared/interfaces/ICatalogStateStore";
import { createDiscoveryScope, type DiscoveryScope } from "@/core/domain/shared/entities/DiscoveryScope";
import type { RegistryId } from "@/core/domain/shared/entities/CatalogTypes";

export class DiscoveryScopePlanner {
  ensureScope(state: CatalogState, scope: Omit<DiscoveryScope, "scopeId"> & { scopeId?: string }): DiscoveryScope {
    const candidate = createDiscoveryScope(scope);
    const existing = state.discoveryScopes.find((entry) => entry.scopeId === candidate.scopeId);
    if (existing) {
      return existing;
    }
    state.discoveryScopes.push(candidate);
    state.discoveryScopes.sort((a, b) => a.scopeId.localeCompare(b.scopeId));
    return candidate;
  }

  planSkillScopes(
    state: CatalogState,
    options: { query?: string; category?: string; trackedItems?: string[] }
  ): DiscoveryScope[] {
    const scopes: DiscoveryScope[] = [];

    if (options.query) {
      scopes.push(
        this.ensureScope(state, {
          registryId: "skillsmp",
          scopeType: "query",
          scopeKey: options.query.trim().toLowerCase(),
          query: options.query,
        })
      );
    }

    if (options.category) {
      scopes.push(
        this.ensureScope(state, {
          registryId: "skillsmp",
          scopeType: "category",
          scopeKey: options.category.trim().toLowerCase(),
          category: options.category,
        })
      );
    }

    if ((options.trackedItems ?? []).length > 0) {
      const trackedItems = [...new Set(options.trackedItems)].sort((a, b) => a.localeCompare(b));
      scopes.push(
        this.ensureScope(state, {
          registryId: "skillsmp",
          scopeType: "tracked-items",
          scopeKey: trackedItems.join(","),
          query: trackedItems.join(","),
        })
      );
    }

    if (scopes.length === 0) {
      scopes.push(...state.discoveryScopes.filter((scope) => scope.registryId === "skillsmp"));
    }

    return scopes;
  }

  listScopes(state: CatalogState, registryId: RegistryId): DiscoveryScope[] {
    return state.discoveryScopes.filter((scope) => scope.registryId === registryId);
  }
}
