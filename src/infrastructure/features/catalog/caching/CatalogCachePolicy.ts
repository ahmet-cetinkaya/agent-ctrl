import type { SourceRegistry } from "@/core/domain/shared/entities";

export interface CatalogCacheDecision {
  shouldRefresh: boolean;
  reason: "forced" | "missing" | "stale" | "throttled" | "fresh";
}

export class CatalogCachePolicy {
  constructor(
    private readonly freshnessWindowMs = 15 * 60 * 1000,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  shouldRefresh(registry: SourceRegistry | undefined, options: { force?: boolean }): CatalogCacheDecision {
    const now = this.nowProvider();

    if (options.force) {
      return { shouldRefresh: true, reason: "forced" };
    }

    if (!registry || !registry.lastSyncSucceededAt) {
      return { shouldRefresh: true, reason: "missing" };
    }

    if (registry.throttleUntil && new Date(registry.throttleUntil).getTime() > now.getTime()) {
      return { shouldRefresh: false, reason: "throttled" };
    }

    if (registry.cacheFreshUntil && new Date(registry.cacheFreshUntil).getTime() >= now.getTime()) {
      return { shouldRefresh: false, reason: "fresh" };
    }

    return { shouldRefresh: true, reason: "stale" };
  }

  computeFreshUntil(from = this.nowProvider()): string {
    return new Date(from.getTime() + this.freshnessWindowMs).toISOString();
  }
}
