import type {
  CatalogItem,
  CompatibilityAssessment,
  DiscoveryScope,
  ManagedIntegration,
  OperationLogEntry,
  SourceRegistry,
} from "@/core/domain/shared/entities";
import type { Result } from "@/core/domain/shared/value-objects/Result";

export interface CatalogState {
  version: 1;
  registries: SourceRegistry[];
  discoveryScopes: DiscoveryScope[];
  catalogItems: CatalogItem[];
  managedIntegrations: ManagedIntegration[];
  compatibilityAssessments: CompatibilityAssessment[];
  operationLogs: OperationLogEntry[];
}

export interface ICatalogStateStore {
  load(configRoot: string): Promise<Result<CatalogState, Error>>;
  save(configRoot: string, state: CatalogState): Promise<Result<void, Error>>;
}
