import type { ItemType, ManagedIntegrationState } from "./CatalogTypes";

export interface ManagedIntegration {
  managedId: string;
  catalogKey: string;
  itemType: ItemType;
  localPath: string;
  state: ManagedIntegrationState;
  installedVersion?: string;
  requestedVersion?: string;
  installedAt: string;
  updatedAt?: string;
  deactivatedAt?: string;
  lastOperationStatus: "success" | "unchanged" | "failed";
  sourceRef: string;
}

export function createManagedIntegration(input: ManagedIntegration): ManagedIntegration {
  return input;
}
