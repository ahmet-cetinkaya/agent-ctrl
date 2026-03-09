import type { ActivationState, AvailabilityState, CompatibilityState, ItemType, RegistryId } from "./CatalogTypes";

export interface CatalogItemMetadata {
  author?: string;
  homepage?: string;
  repository?: string;
  downloadUrl?: string;
  readmeUrl?: string;
  packageName?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  connectionType?: string;
  deploymentUrl?: string;
  tags?: string[];
  rawSchema?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  installation?: {
    skillMarkdown?: string;
    files?: Record<string, string>;
  };
  compatibility?: {
    state?: CompatibilityState;
    reasons?: string[];
    requiredConstraints?: string[];
  };
}

export interface CatalogItem {
  catalogKey: string;
  registryId: RegistryId;
  itemType: ItemType;
  sourceItemId: string;
  displayName: string;
  description?: string;
  capabilities: string[];
  categories: string[];
  sourceVersion?: string;
  availabilityState: AvailabilityState;
  compatibilityState: CompatibilityState;
  activationState: ActivationState;
  lastSeenAt: string;
  removedAt?: string;
  lastSyncAt?: string;
  sourceUrl?: string;
  metadata?: CatalogItemMetadata;
}

export function createCatalogItem(input: Omit<CatalogItem, "catalogKey"> & { catalogKey?: string }): CatalogItem {
  return {
    ...input,
    catalogKey: input.catalogKey ?? `${input.registryId}:${input.sourceItemId}`,
    capabilities: [...input.capabilities].sort((a, b) => a.localeCompare(b)),
    categories: [...input.categories].sort((a, b) => a.localeCompare(b)),
  };
}
