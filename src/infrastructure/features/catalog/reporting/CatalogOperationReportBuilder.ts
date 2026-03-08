import type { LifecycleOperationSummary, RegistryResult, SyncReport } from "@/core/domain/shared/entities/SyncReport";
import { createEmptySyncReport } from "@/core/domain/shared/entities/SyncReport";
import type { RegistryId, RegistrySyncStatus } from "@/core/domain/shared/entities/CatalogTypes";

export class CatalogOperationReportBuilder {
  createSyncReport(registries: RegistryId[], scopes: string[]): SyncReport {
    return createEmptySyncReport(registries, scopes);
  }

  addRegistryResult(report: SyncReport, input: RegistryResult): SyncReport {
    report.registryResults.push(input);
    report.usedCachedData = report.usedCachedData || input.usedCache;
    report.totals.discovered += input.itemCounts.discovered;
    report.totals.failed += input.itemCounts.failed;
    report.totals.skipped += input.itemCounts.skipped;
    report.finishedAt = new Date().toISOString();
    return report;
  }

  createRegistryResult(input: {
    registryId: RegistryId;
    status: RegistrySyncStatus;
    usedCache?: boolean;
    discovered?: number;
    changed?: number;
    failed?: number;
    skipped?: number;
    issues?: string[];
  }): RegistryResult {
    return {
      registryId: input.registryId,
      status: input.status,
      usedCache: input.usedCache ?? false,
      itemCounts: {
        discovered: input.discovered ?? 0,
        changed: input.changed ?? 0,
        failed: input.failed ?? 0,
        skipped: input.skipped ?? 0,
      },
      issues: input.issues ?? [],
    };
  }

  createLifecycleSummary(input: LifecycleOperationSummary): LifecycleOperationSummary {
    return input;
  }
}
