import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, SourceRegistry, SyncReport } from "@/core/domain/shared/entities";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";

export interface SearchMcpCatalogQueryOptions {
  configRoot: string;
  query: string;
  capability?: string;
  status?: string;
  refresh?: boolean;
  apiKey?: string;
}

export interface SearchMcpCatalogQueryResult {
  items: CatalogItem[];
  registry: SourceRegistry;
  report?: SyncReport;
}

export class SearchMcpCatalogQuery {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly synchronizer = new McpCatalogSynchronizer()
  ) {}

  async execute(options: SearchMcpCatalogQueryOptions): Promise<Result<SearchMcpCatalogQueryResult, Error>> {
    try {
      let report: SyncReport | undefined;
      if (options.refresh) {
        const synchronized = await this.synchronizer.synchronize({
          configRoot: options.configRoot,
          query: options.query,
          force: true,
          apiKey: options.apiKey,
        });
        report = synchronized.report;
      }

      const loaded = await this.store.load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }

      const state = loaded.data;
      const registry = this.stateSupport.getRegistry(state, "smithery");
      const needle = options.query.toLowerCase();
      const items = state.catalogItems
        .filter((item) => item.registryId === "smithery")
        .filter((item) =>
          [item.displayName, item.description ?? "", item.sourceItemId, ...item.capabilities, ...item.categories]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
        .filter((item) => (options.capability ? item.capabilities.includes(options.capability) : true))
        .filter((item) =>
          options.status
            ? [item.activationState, item.compatibilityState, item.availabilityState].includes(
                options.status as CatalogItem["activationState"]
              )
            : true
        );

      return ok({ items, registry, report });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
