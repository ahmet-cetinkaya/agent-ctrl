import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, SourceRegistry, SyncReport } from "@/core/domain/shared/entities";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";

export interface SearchSkillsQueryOptions {
  configRoot: string;
  query: string;
  capability?: string;
  status?: string;
  refresh?: boolean;
  ai?: boolean;
  apiKey?: string;
}

export interface SearchSkillsQueryResult {
  items: CatalogItem[];
  registry: SourceRegistry;
  report?: SyncReport;
}

export class SearchSkillsQuery {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly synchronizer = new SkillCatalogSynchronizer()
  ) {}

  async execute(options: SearchSkillsQueryOptions): Promise<Result<SearchSkillsQueryResult, Error>> {
    try {
      let report: SyncReport | undefined;
      if (options.refresh) {
        const synchronized = await this.synchronizer.synchronize({
          configRoot: options.configRoot,
          query: options.query,
          ai: options.ai,
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
      const registry = this.stateSupport.getRegistry(state, "skillsmp");
      const needle = options.query.toLowerCase();
      const items = state.catalogItems
        .filter((item) => item.registryId === "skillsmp")
        .filter((item) =>
          [item.displayName, item.description ?? "", item.sourceItemId, ...item.capabilities, ...item.categories]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
        .filter((item) => (options.capability ? item.capabilities.includes(options.capability) : true))
        .filter((item) => this.matchesStatus(item, options.status));

      return ok({ items, registry, report });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private matchesStatus(item: CatalogItem, status?: string): boolean {
    if (!status) {
      return true;
    }
    return [item.activationState, item.compatibilityState, item.availabilityState].includes(
      status as CatalogItem["activationState"]
    );
  }
}
