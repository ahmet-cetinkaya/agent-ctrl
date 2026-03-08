import type { CatalogState } from "@/core/domain/shared/interfaces/ICatalogStateStore";
import type {
  CatalogItem,
  CompatibilityAssessment,
  ManagedIntegration,
  OperationLogEntry,
  SourceRegistry,
} from "@/core/domain/shared/entities";
import type { ActivationState, RegistryId, RegistrySyncStatus } from "@/core/domain/shared/entities/CatalogTypes";
import { createSourceRegistry } from "@/core/domain/shared/entities/SourceRegistry";

export class CatalogStateSupport {
  getRegistry(state: CatalogState, registryId: RegistryId): SourceRegistry {
    let registry = state.registries.find((entry) => entry.registryId === registryId);
    if (!registry) {
      registry = createSourceRegistry(registryId);
      state.registries.push(registry);
      state.registries.sort((a, b) => a.registryId.localeCompare(b.registryId));
    }
    return registry;
  }

  upsertCatalogItems(state: CatalogState, items: CatalogItem[]): void {
    const managedByCatalogKey = new Map(state.managedIntegrations.map((entry) => [entry.catalogKey, entry]));
    const byKey = new Map(state.catalogItems.map((entry) => [entry.catalogKey, entry]));

    for (const item of items) {
      const existing = byKey.get(item.catalogKey);
      const managed = managedByCatalogKey.get(item.catalogKey);
      const nextActivationState = this.resolveActivationState(item, managed, existing?.activationState);
      byKey.set(item.catalogKey, {
        ...existing,
        ...item,
        activationState: nextActivationState,
      });
    }

    state.catalogItems = Array.from(byKey.values()).sort((a, b) => a.catalogKey.localeCompare(b.catalogKey));
  }

  updateCatalogAvailability(
    state: CatalogState,
    registryId: RegistryId,
    seenCatalogKeys: Set<string>,
    options: { markMissingUnavailable: boolean }
  ): void {
    if (!options.markMissingUnavailable) {
      return;
    }

    state.catalogItems = state.catalogItems.map((item) => {
      if (item.registryId !== registryId || seenCatalogKeys.has(item.catalogKey)) {
        return item;
      }
      return {
        ...item,
        availabilityState: "unavailable",
        removedAt: item.removedAt ?? new Date().toISOString(),
        activationState: item.activationState === "active" ? "active" : "activation-blocked",
      };
    });
  }

  setCompatibility(state: CatalogState, assessment: CompatibilityAssessment): void {
    const remaining = state.compatibilityAssessments.filter((entry) => entry.catalogKey !== assessment.catalogKey);
    remaining.push(assessment);
    state.compatibilityAssessments = remaining.sort((a, b) => a.catalogKey.localeCompare(b.catalogKey));

    state.catalogItems = state.catalogItems.map((item) =>
      item.catalogKey === assessment.catalogKey
        ? {
            ...item,
            compatibilityState: assessment.state,
            activationState:
              assessment.state === "incompatible" && item.activationState !== "active"
                ? "activation-blocked"
                : item.activationState,
          }
        : item
    );
  }

  upsertManagedIntegration(state: CatalogState, managed: ManagedIntegration): void {
    const byId = new Map(state.managedIntegrations.map((entry) => [entry.managedId, entry]));
    byId.set(managed.managedId, managed);
    state.managedIntegrations = Array.from(byId.values()).sort((a, b) => a.managedId.localeCompare(b.managedId));

    state.catalogItems = state.catalogItems.map((item) =>
      item.catalogKey === managed.catalogKey
        ? {
            ...item,
            activationState:
              managed.state === "active"
                ? "active"
                : managed.state === "update-available"
                  ? "update-available"
                  : item.compatibilityState === "incompatible"
                    ? "activation-blocked"
                    : "inactive",
          }
        : item
    );
  }

  addOperationLog(state: CatalogState, entry: OperationLogEntry): void {
    state.operationLogs.push(entry);
    state.operationLogs.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  updateRegistrySyncState(
    state: CatalogState,
    registryId: RegistryId,
    input: {
      authState?: SourceRegistry["authState"];
      lastSyncStartedAt?: string;
      lastSyncSucceededAt?: string;
      lastSyncStatus?: RegistrySyncStatus;
      throttleUntil?: string;
      cacheFreshUntil?: string;
      catalogItemCount?: number;
    }
  ): void {
    const registry = this.getRegistry(state, registryId);
    Object.assign(registry, input);
  }

  findCatalogItem(state: CatalogState, ref: string): CatalogItem | undefined {
    const normalized = ref.replace(/^(skillsmp|smithery):/, "");
    return state.catalogItems.find(
      (item) =>
        item.catalogKey === ref ||
        item.sourceItemId === normalized ||
        item.sourceItemId.endsWith(`/${normalized}`) ||
        item.displayName === normalized
    );
  }

  findManagedIntegration(state: CatalogState, ref: string): ManagedIntegration | undefined {
    const normalized = ref.replace(/^(skillsmp|smithery):/, "");
    return state.managedIntegrations.find(
      (item) =>
        item.managedId === normalized ||
        item.catalogKey === ref ||
        item.sourceRef === ref ||
        item.sourceRef.endsWith(`:${normalized}`) ||
        item.sourceRef.endsWith(`/${normalized}`)
    );
  }

  private resolveActivationState(
    item: CatalogItem,
    managed: ManagedIntegration | undefined,
    existingActivationState?: ActivationState
  ): ActivationState {
    if (managed?.state === "update-available") {
      return "update-available";
    }
    if (managed?.state === "active") {
      if (managed.installedVersion && item.sourceVersion && managed.installedVersion !== item.sourceVersion) {
        return "update-available";
      }
      return "active";
    }
    if (item.compatibilityState === "incompatible") {
      return "activation-blocked";
    }
    return existingActivationState ?? "inactive";
  }
}
