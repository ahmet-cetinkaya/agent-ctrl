import type { OperationStatus, RegistryId, RegistrySyncStatus } from "./CatalogTypes";

export interface RegistryResult {
  registryId: RegistryId;
  status: RegistrySyncStatus;
  usedCache: boolean;
  itemCounts: {
    discovered: number;
    changed: number;
    failed: number;
    skipped: number;
  };
  issues: string[];
}

export interface SyncReportTotals {
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  skipped: number;
  failed: number;
}

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  requestedRegistries: RegistryId[];
  requestedScopes: string[];
  usedCachedData: boolean;
  totals: SyncReportTotals;
  registryResults: RegistryResult[];
}

export interface LifecycleOperationSummary {
  operation: "activate" | "deactivate" | "update";
  status: OperationStatus;
  changed: number;
  unchanged: number;
  skipped: number;
  failed: number;
  unavailable: number;
  message: string;
}

export function createEmptySyncReport(requestedRegistries: RegistryId[], requestedScopes: string[]): SyncReport {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    finishedAt: now,
    requestedRegistries,
    requestedScopes,
    usedCachedData: false,
    totals: {
      discovered: 0,
      added: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      skipped: 0,
      failed: 0,
    },
    registryResults: [],
  };
}
