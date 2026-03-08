import type { CatalogItem, SyncReport } from "@/core/domain/shared/entities";
import type { CatalogState, ICatalogStateStore } from "@/core/domain/shared/interfaces/ICatalogStateStore";
import type { ISmitheryRegistryClient } from "@/core/domain/shared/interfaces/ISmitheryRegistryClient";
import { createCatalogItem } from "@/core/domain/shared/entities/CatalogItem";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { CatalogCachePolicy } from "@/infrastructure/features/catalog/caching/CatalogCachePolicy";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogOperationReportBuilder } from "@/infrastructure/features/catalog/reporting/CatalogOperationReportBuilder";
import { SmitheryRegistryClient } from "@/infrastructure/features/catalog/clients/SmitheryRegistryClient";

export interface McpCatalogSyncOptions {
  configRoot: string;
  query?: string;
  force?: boolean;
  apiKey?: string;
}

export interface McpCatalogSyncResult {
  state: CatalogState;
  items: CatalogItem[];
  report: SyncReport;
}

interface McpCatalogSynchronizerDependencies {
  store: ICatalogStateStore;
  client: ISmitheryRegistryClient;
  reportBuilder: CatalogOperationReportBuilder;
  stateSupport: CatalogStateSupport;
  compatibilityEvaluator: CatalogCompatibilityEvaluator;
  cachePolicy: CatalogCachePolicy;
  logStore: CatalogOperationLogStore;
  credentialBootstrap: CatalogCredentialBootstrap;
}

export class McpCatalogSynchronizer {
  constructor(private readonly deps: Partial<McpCatalogSynchronizerDependencies> = {}) {}

  async synchronize(options: McpCatalogSyncOptions): Promise<McpCatalogSyncResult> {
    await this.getCredentialBootstrap().applySmitheryCredentials(options.configRoot, options.apiKey);
    const loaded = await this.getStore().load(options.configRoot);
    if (!loaded.success) {
      throw loaded.error;
    }

    const state = loaded.data;
    const registry = this.getStateSupport().getRegistry(state, "smithery");
    const cacheDecision = this.getCachePolicy().shouldRefresh(registry, { force: options.force });
    const report = this.getReportBuilder().createSyncReport(["smithery"], options.query ? [options.query] : ["all"]);
    if (!cacheDecision.shouldRefresh && state.catalogItems.some((item) => item.registryId === "smithery")) {
      const cached = this.filterItems(state.catalogItems, options.query);
      this.getReportBuilder().addRegistryResult(
        report,
        this.getReportBuilder().createRegistryResult({
          registryId: "smithery",
          status: "cached",
          usedCache: true,
          discovered: cached.length,
        })
      );
      return { state, items: cached, report };
    }

    this.getStateSupport().updateRegistrySyncState(state, "smithery", {
      lastSyncStartedAt: new Date().toISOString(),
    });

    const seenKeys = new Set<string>();
    const synchronizedItems: CatalogItem[] = [];
    const issues: string[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.getClient().listServers({ query: options.query, page, pageSize: 100 });
      if (!response.success) {
        issues.push(response.error.message);
        break;
      }

      totalPages = response.data.totalPages ?? page;
      for (const server of response.data.servers) {
        const details = await this.getClient().getServerDetails(server.id);
        const merged = details.success ? details.data : server;
        const catalogItem = createCatalogItem({
          registryId: "smithery",
          itemType: "mcp",
          sourceItemId: merged.qualifiedName,
          displayName: merged.displayName,
          description: merged.description,
          capabilities: merged.capabilities,
          categories: merged.categories,
          sourceVersion: merged.version,
          availabilityState: "available",
          compatibilityState: merged.metadata?.compatibility?.state ?? "unknown",
          activationState: "inactive",
          lastSeenAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          sourceUrl: merged.homepage,
          metadata: merged.metadata,
        });
        synchronizedItems.push(catalogItem);
        seenKeys.add(catalogItem.catalogKey);
      }

      page += 1;
    } while (page <= totalPages);

    this.getStateSupport().upsertCatalogItems(state, synchronizedItems);
    for (const item of synchronizedItems) {
      this.getStateSupport().setCompatibility(state, this.getCompatibilityEvaluator().evaluate(item));
    }
    this.getStateSupport().updateCatalogAvailability(state, "smithery", seenKeys, {
      markMissingUnavailable: !options.query,
    });
    this.getStateSupport().updateRegistrySyncState(state, "smithery", {
      authState: issues.some(
        (issue) => issue.toLowerCase().includes("api key") || issue.toLowerCase().includes("authentication")
      )
        ? "missing"
        : "configured",
      lastSyncSucceededAt: synchronizedItems.length > 0 ? new Date().toISOString() : registry.lastSyncSucceededAt,
      lastSyncStatus: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
      cacheFreshUntil:
        synchronizedItems.length > 0 ? this.getCachePolicy().computeFreshUntil() : registry.cacheFreshUntil,
      catalogItemCount: state.catalogItems.filter((item) => item.registryId === "smithery").length,
    });

    const operationEntry = createOperationLogEntry({
      operationId: `mcp-sync-${Date.now()}`,
      operationType: "sync",
      registryId: "smithery",
      status: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
      message: issues.join(" ") || `Synchronized ${synchronizedItems.length} Smithery MCP items.`,
      occurredAt: new Date().toISOString(),
    });
    this.getStateSupport().addOperationLog(state, operationEntry);

    const saved = await this.getStore().save(options.configRoot, state);
    if (!saved.success) {
      throw saved.error;
    }
    await this.getLogStore().append(options.configRoot, operationEntry);

    this.getReportBuilder().addRegistryResult(
      report,
      this.getReportBuilder().createRegistryResult({
        registryId: "smithery",
        status: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
        discovered: synchronizedItems.length,
        changed: synchronizedItems.length,
        failed: issues.length,
        issues,
      })
    );
    report.totals.added = synchronizedItems.length;

    return {
      state,
      items: this.filterItems(state.catalogItems, options.query),
      report,
    };
  }

  private getStore(): ICatalogStateStore {
    return (this.deps.store ??= new CatalogStateFileStore());
  }

  private getClient(): ISmitheryRegistryClient {
    return (this.deps.client ??= new SmitheryRegistryClient());
  }

  private getReportBuilder(): CatalogOperationReportBuilder {
    return (this.deps.reportBuilder ??= new CatalogOperationReportBuilder());
  }

  private getStateSupport(): CatalogStateSupport {
    return (this.deps.stateSupport ??= new CatalogStateSupport());
  }

  private getCompatibilityEvaluator(): CatalogCompatibilityEvaluator {
    return (this.deps.compatibilityEvaluator ??= new CatalogCompatibilityEvaluator());
  }

  private getCachePolicy(): CatalogCachePolicy {
    return (this.deps.cachePolicy ??= new CatalogCachePolicy());
  }

  private getLogStore(): CatalogOperationLogStore {
    return (this.deps.logStore ??= new CatalogOperationLogStore());
  }

  private getCredentialBootstrap(): CatalogCredentialBootstrap {
    return (this.deps.credentialBootstrap ??= new CatalogCredentialBootstrap());
  }

  private filterItems(items: CatalogItem[], query?: string): CatalogItem[] {
    const registryItems = items.filter((item) => item.registryId === "smithery");
    if (!query) {
      return registryItems;
    }
    const needle = query.toLowerCase();
    return registryItems.filter((item) =>
      [item.displayName, item.description ?? "", item.sourceItemId, ...item.capabilities, ...item.categories]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }
}
