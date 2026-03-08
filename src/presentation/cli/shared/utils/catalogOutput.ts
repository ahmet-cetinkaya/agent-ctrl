import type { CatalogItem, LifecycleOperationSummary, SourceRegistry, SyncReport } from "@/core/domain/shared/entities";

export function renderCatalogSearchResults(items: CatalogItem[]): string[] {
  if (items.length === 0) {
    return ["No catalog items matched the current query."];
  }

  const lines = [`Results: ${items.length}`];

  for (const item of items) {
    lines.push(`- ${item.displayName}`);
    lines.push(`  Source: ${item.registryId}:${item.sourceItemId}`);
    if (item.description) {
      lines.push(`  Description: ${item.description}`);
    }
    lines.push("");
  }

  return lines.slice(0, -1);
}

export function renderCatalogItems(items: CatalogItem[]): string[] {
  if (items.length === 0) {
    return ["No catalog items matched the current query."];
  }

  const lines = [`Results: ${items.length}`];

  for (const item of items) {
    lines.push(`- ${item.displayName}`);
    lines.push(`  Source: ${item.registryId}:${item.sourceItemId}`);
    lines.push(
      `  Status: compatibility=${item.compatibilityState}, activation=${item.activationState}, availability=${item.availabilityState}`
    );

    if (item.sourceVersion) {
      lines.push(`  Version: ${item.sourceVersion}`);
    }
    if (item.capabilities.length > 0) {
      lines.push(`  Capabilities: ${item.capabilities.join(", ")}`);
    }
    if (item.categories.length > 0) {
      lines.push(`  Categories: ${item.categories.join(", ")}`);
    }
    if (item.lastSyncAt) {
      lines.push(`  Last sync: ${item.lastSyncAt}`);
    }
    if (item.description) {
      lines.push(`  Description: ${item.description}`);
    }

    lines.push("");
  }

  return lines.slice(0, -1);
}

export function renderRegistryStatus(registry: SourceRegistry): string[] {
  return [
    `Registry: ${registry.displayName}`,
    `Auth: ${registry.authState}`,
    `Last status: ${registry.lastSyncStatus}`,
    registry.lastSyncSucceededAt ? `Last success: ${registry.lastSyncSucceededAt}` : "Last success: never",
    registry.cacheFreshUntil ? `Fresh until: ${registry.cacheFreshUntil}` : "Fresh until: unknown",
  ];
}

export function renderSyncReport(report: SyncReport): string[] {
  const lines = [
    "Sync summary:",
    `  Discovered: ${report.totals.discovered}`,
    `  Added: ${report.totals.added}`,
    `  Updated: ${report.totals.updated}`,
    `  Unchanged: ${report.totals.unchanged}`,
    `  Skipped: ${report.totals.skipped}`,
    `  Failed: ${report.totals.failed}`,
  ];

  for (const result of report.registryResults) {
    lines.push(`  Registry ${result.registryId}:`);
    lines.push(`    Status: ${result.status}${result.usedCache ? " (cached)" : ""}`);
    lines.push(`    Discovered: ${result.itemCounts.discovered}`);
    lines.push(`    Changed: ${result.itemCounts.changed}`);
    lines.push(`    Skipped: ${result.itemCounts.skipped}`);
    lines.push(`    Failed: ${result.itemCounts.failed}`);
    for (const issue of result.issues) {
      lines.push(`    Issue: ${issue}`);
    }
  }

  return lines;
}

export function renderLifecycleSummary(summary: LifecycleOperationSummary): string[] {
  return [summary.message];
}
