import type { AuthState, RegistryId, RegistrySyncStatus } from "./CatalogTypes";

export interface SourceRegistry {
  registryId: RegistryId;
  displayName: string;
  authState: AuthState;
  lastSyncStartedAt?: string;
  lastSyncSucceededAt?: string;
  lastSyncStatus: RegistrySyncStatus;
  throttleUntil?: string;
  cacheFreshUntil?: string;
  catalogItemCount: number;
}

export function createSourceRegistry(registryId: RegistryId): SourceRegistry {
  return {
    registryId,
    displayName: registryId === "skillsmp" ? "SkillsMP" : "Smithery",
    authState: "unknown",
    lastSyncStatus: "idle",
    catalogItemCount: 0,
  };
}
