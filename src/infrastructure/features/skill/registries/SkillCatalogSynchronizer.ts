import type { CatalogItem, DiscoveryScope, SyncReport } from "@/core/domain/shared/entities";
import type { CatalogState, ICatalogStateStore } from "@/core/domain/shared/interfaces/ICatalogStateStore";
import type { ISkillsMpClient } from "@/core/domain/shared/interfaces/ISkillsMpClient";
import { createCatalogItem } from "@/core/domain/shared/entities/CatalogItem";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { CatalogCachePolicy } from "@/infrastructure/features/catalog/caching/CatalogCachePolicy";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogOperationReportBuilder } from "@/infrastructure/features/catalog/reporting/CatalogOperationReportBuilder";
import { DiscoveryScopePlanner } from "@/infrastructure/features/catalog/scopes/DiscoveryScopePlanner";
import { SkillsMpClient } from "@/infrastructure/features/catalog/clients/SkillsMpClient";

export interface SkillCatalogSyncOptions {
  configRoot: string;
  query?: string;
  category?: string;
  ai?: boolean;
  force?: boolean;
  apiKey?: string;
}

export interface SkillCatalogSyncResult {
  state: CatalogState;
  items: CatalogItem[];
  scopes: DiscoveryScope[];
  report: SyncReport;
}

export class SkillCatalogSynchronizer {
  constructor(
    private readonly store: ICatalogStateStore = new CatalogStateFileStore(),
    private readonly client: ISkillsMpClient = new SkillsMpClient(),
    private readonly planner = new DiscoveryScopePlanner(),
    private readonly reportBuilder = new CatalogOperationReportBuilder(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly compatibilityEvaluator = new CatalogCompatibilityEvaluator(),
    private readonly cachePolicy = new CatalogCachePolicy(),
    private readonly logStore = new CatalogOperationLogStore(),
    private readonly credentialBootstrap = new CatalogCredentialBootstrap()
  ) {}

  async synchronize(options: SkillCatalogSyncOptions): Promise<SkillCatalogSyncResult> {
    await this.credentialBootstrap.applySkillCredentials(options.configRoot, options.apiKey);
    const loaded = await this.store.load(options.configRoot);
    if (!loaded.success) {
      throw loaded.error;
    }

    const state = loaded.data;
    const registry = this.stateSupport.getRegistry(state, "skillsmp");
    const trackedItems = state.managedIntegrations
      .filter((entry) => entry.itemType === "skill")
      .map((entry) => entry.sourceRef.replace(/^skillsmp:/, ""));
    const scopes = this.planner.planSkillScopes(state, {
      query: options.query,
      category: options.category,
      trackedItems: trackedItems.length > 0 && !options.query && !options.category ? trackedItems : undefined,
    });

    const cacheDecision = this.cachePolicy.shouldRefresh(registry, { force: options.force });
    const report = this.reportBuilder.createSyncReport(
      ["skillsmp"],
      scopes.map((scope) => scope.scopeId)
    );
    if (!cacheDecision.shouldRefresh && state.catalogItems.some((item) => item.registryId === "skillsmp")) {
      const cachedItems = this.filterItemsForScopes(state.catalogItems, scopes);
      this.reportBuilder.addRegistryResult(
        report,
        this.reportBuilder.createRegistryResult({
          registryId: "skillsmp",
          status: "cached",
          usedCache: true,
          discovered: cachedItems.length,
        })
      );
      return { state, items: cachedItems, scopes, report };
    }

    const seenKeys = new Set<string>();
    const synchronizedItems: CatalogItem[] = [];
    const issues: string[] = [];
    let discovered = 0;

    this.stateSupport.updateRegistrySyncState(state, "skillsmp", {
      lastSyncStartedAt: new Date().toISOString(),
    });

    for (const scope of scopes) {
      const queries = this.scopeToQueries(scope);
      for (const query of queries) {
        const response = await this.client.search({
          query,
          ai: options.ai,
          category: scope.category,
          limit: 100,
        });

        if (!response.success) {
          issues.push(response.error.message);
          continue;
        }

        scope.lastRefreshedAt = new Date().toISOString();

        for (const skill of response.data.skills) {
          const catalogItem = createCatalogItem({
            registryId: "skillsmp",
            itemType: "skill",
            sourceItemId: skill.id,
            displayName: skill.name,
            description: skill.description,
            capabilities: skill.capabilities,
            categories: skill.categories,
            sourceVersion: skill.version,
            availabilityState: "available",
            compatibilityState: skill.metadata?.compatibility?.state ?? "unknown",
            activationState: "inactive",
            lastSeenAt: new Date().toISOString(),
            lastSyncAt: new Date().toISOString(),
            sourceUrl: skill.sourceUrl,
            metadata: skill.metadata,
          });
          synchronizedItems.push(catalogItem);
          seenKeys.add(catalogItem.catalogKey);
          discovered += 1;
        }

        const remainingHeader = response.data.rateLimit?.dailyRemaining;
        if (typeof remainingHeader === "number" && remainingHeader <= 0) {
          issues.push("SkillsMP daily quota exhausted.");
          break;
        }
      }
    }

    this.stateSupport.upsertCatalogItems(state, synchronizedItems);
    for (const item of synchronizedItems) {
      const assessment = this.compatibilityEvaluator.evaluate(item);
      this.stateSupport.setCompatibility(state, assessment);
    }
    this.stateSupport.updateCatalogAvailability(state, "skillsmp", seenKeys, {
      markMissingUnavailable: scopes.some((scope) => scope.scopeType === "tracked-items"),
    });

    this.stateSupport.updateRegistrySyncState(state, "skillsmp", {
      authState: issues.some(
        (issue) => issue.toLowerCase().includes("api key") || issue.toLowerCase().includes("authentication")
      )
        ? "missing"
        : "configured",
      lastSyncSucceededAt: issues.length === 0 ? new Date().toISOString() : registry.lastSyncSucceededAt,
      lastSyncStatus: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
      cacheFreshUntil: synchronizedItems.length > 0 ? this.cachePolicy.computeFreshUntil() : registry.cacheFreshUntil,
      catalogItemCount: state.catalogItems.filter((item) => item.registryId === "skillsmp").length,
    });

    const operationEntry = createOperationLogEntry({
      operationId: `skill-sync-${Date.now()}`,
      operationType: "sync",
      registryId: "skillsmp",
      status: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
      message: issues.join(" ") || `Synchronized ${synchronizedItems.length} SkillsMP items.`,
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
        registryId: "skillsmp",
        status: issues.length === 0 ? "success" : synchronizedItems.length > 0 ? "partial" : "failed",
        discovered,
        changed: synchronizedItems.length,
        failed: issues.length,
        issues,
      })
    );
    report.totals.added = synchronizedItems.length;

    return {
      state,
      items: this.filterItemsForScopes(state.catalogItems, scopes),
      scopes,
      report,
    };
  }

  private filterItemsForScopes(items: CatalogItem[], scopes: DiscoveryScope[]): CatalogItem[] {
    const scopeTerms = new Set(
      scopes
        .flatMap((scope) => [scope.query?.toLowerCase(), scope.category?.toLowerCase(), scope.scopeKey.toLowerCase()])
        .filter(Boolean) as string[]
    );

    const registryItems = items.filter((item) => item.registryId === "skillsmp");
    if (scopeTerms.size === 0) {
      return registryItems;
    }

    return registryItems.filter((item) => {
      const haystack = [
        item.displayName,
        item.description ?? "",
        item.sourceItemId,
        ...item.capabilities,
        ...item.categories,
      ]
        .join(" ")
        .toLowerCase();
      return Array.from(scopeTerms).some((term) => haystack.includes(term));
    });
  }

  private scopeToQueries(scope: DiscoveryScope): string[] {
    if (scope.scopeType === "tracked-items") {
      return (scope.query ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [scope.query ?? scope.category ?? scope.scopeKey];
  }
}
