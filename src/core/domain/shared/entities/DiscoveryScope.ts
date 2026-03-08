import type { DiscoveryScopeType, RegistryId } from "./CatalogTypes";

export interface DiscoveryScope {
  scopeId: string;
  registryId: RegistryId;
  scopeType: DiscoveryScopeType;
  scopeKey: string;
  query?: string;
  category?: string;
  lastRefreshedAt?: string;
}

export function createDiscoveryScope(input: Omit<DiscoveryScope, "scopeId"> & { scopeId?: string }): DiscoveryScope {
  return {
    scopeId: input.scopeId ?? `${input.registryId}:${input.scopeType}:${input.scopeKey}`,
    registryId: input.registryId,
    scopeType: input.scopeType,
    scopeKey: input.scopeKey,
    query: input.query,
    category: input.category,
    lastRefreshedAt: input.lastRefreshedAt,
  };
}
