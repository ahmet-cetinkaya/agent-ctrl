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

export class McpCatalogSynchronizer {
  constructor(
    private readonly store: ICatalogStateStore = new CatalogStateFileStore(),
    private readonly client: ISmitheryRegistryClient = new SmitheryRegistryClient(),
    private readonly reportBuilder = new CatalogOperationReportBuilder(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly compatibilityEvaluator = new CatalogCompatibilityEvaluator(),
    private readonly cachePolicy = new CatalogCachePolicy(),
    private readonly logStore = new CatalogOperationLogStore(),
    private readonly credentialBootstrap = new CatalogCredentialBootstrap()
  ) {}

  async synchronize(options: McpCatalogSyncOptions): Promise<McpCatalogSyncResult> {
    await this.credentialBootstrap.applySmitheryCredentials(options.configRoot, options.apiKey);
    const loaded = await this.store.load(options.configRoot);
    if (!loaded.success) {
      throw loaded.error;
    }

    const state = loaded.data;
    const registry = this.stateSupport.getRegistry(state, "smithery");
    const cacheDecision = this.cachePolicy.shouldRefresh(registry, { force: options.force });
    const report = this.reportBuilder.createSyncReport(["smithery"], options.query ? [options.query] : ["all"]);
    if (!cacheDecision.shouldRefresh && state.catalogItems.some((item) => item.registryId === "smithery")) {
      const cached = this.filterItems(state.catalogItems, options.query);
      this.reportBuilder.addRegistryResult(
        report,
        this.reportBuilder.createRegistryResult({
          registryId: "smithery",
          status: "cached",
          usedCache: true,
          discovered: cached.length,
        })
      );
      return { state, items: cached, report };
    }

    this.stateSupport.updateRegistrySyncState(state, "smithery", {
      lastSyncStartedAt: new Date().toISOString(),
    });

    const seenKeys = new Set<string>();
    const synchronizedItems: CatalogItem[] = [];
    const issues: string[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.client.listServers({ query: options.query, page, pageSize: 100 });
      if (!response.success) {
        issues.push(response.error.message);
        break;
      }

      totalPages = response.data.totalPages ?? page;
      for (const server of response.data.servers) {
        const details = await this.client.getServerDetails(server.id);
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

    this.stateSupport.upsertCatalogItems(state, synchronizedItems);
    for (const item of synchronizedItems) {
      this.stateSupport.setCompatibility(state, this.compatibilityEvaluator.evaluate(item));
    }
    this.stateSupport.updateCatalogAvailability(state, "smithery", seenKeys, {
      markMissingUnavailable: !options.query,
    });
    this.stateSupport.updateRegistrySyncState(state, "smithery", {
      authState: issues.some(
        (issue) => issue.toLowerCase().includes("api key") || issue.toLowerCase().includes("authentication")
      )
        ? "missing"
        : "configured",
      lastSyncSucceededAt: synchronizedItems.length > 0 ? new Date().toISOString() : registry.lastSyncSucceededAt,
      lastSyncStatus: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
      cacheFreshUntil: synchronizedItems.length > 0 ? this.cachePolicy.computeFreshUntil() : registry.cacheFreshUntil,
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
    this.stateSupport.addOperationLog(state, operationEntry);

    const saved = await this.store.save(options.configRoot, state);
    if (!saved.success) {
      throw saved.error;
    }
    await this.logStore.append(options.configRoot, operationEntry);

    this.reportBuilder.addRegistryResult(
      report,
      this.reportBuilder.createRegistryResult({
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
