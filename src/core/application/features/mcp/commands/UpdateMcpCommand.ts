import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { LifecycleOperationSummary } from "@/core/domain/shared/entities/SyncReport";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { CatalogOperationReportBuilder } from "@/infrastructure/features/catalog/reporting/CatalogOperationReportBuilder";
import { ManagedMcpMaterializer } from "@/infrastructure/features/mcp/metadata/ManagedMcpMaterializer";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";

export interface UpdateMcpCommandOptions {
  configRoot: string;
  ref?: string;
  all?: boolean;
  refresh?: boolean;
  apiKey?: string;
}

export class UpdateMcpCommand {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly synchronizer = new McpCatalogSynchronizer(),
    private readonly compatibilityEvaluator = new CatalogCompatibilityEvaluator(),
    private readonly materializer = new ManagedMcpMaterializer(),
    private readonly reportBuilder = new CatalogOperationReportBuilder(),
    private readonly logStore = new CatalogOperationLogStore(),
    private readonly credentialBootstrap = new CatalogCredentialBootstrap()
  ) {}

  async execute(options: UpdateMcpCommandOptions): Promise<Result<LifecycleOperationSummary, Error>> {
    try {
      await this.credentialBootstrap.applySmitheryCredentials(options.configRoot, options.apiKey);
      if (options.refresh) {
        await this.synchronizer.synchronize({ configRoot: options.configRoot, force: true, apiKey: options.apiKey });
      }

      const loaded = await this.store.load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;
      const targets = state.managedIntegrations.filter(
        (entry) => entry.itemType === "mcp" && (options.all || entry.managedId === options.ref)
      );
      if (targets.length === 0) {
        return err(new Error("No managed MCPs matched the requested update target."));
      }

      let changed = 0;
      let unchanged = 0;
      let skipped = 0;
      let failed = 0;
      let unavailable = 0;

      for (const managed of targets) {
        const item = this.stateSupport.findCatalogItem(state, managed.catalogKey);
        if (!item) {
          failed += 1;
          continue;
        }
        if (item.availabilityState !== "available") {
          unavailable += 1;
          continue;
        }
        const gate = this.compatibilityEvaluator.canActivate(item);
        this.stateSupport.setCompatibility(state, gate.assessment);
        if (!gate.allowed) {
          skipped += 1;
          continue;
        }
        if (!item.sourceVersion || item.sourceVersion === managed.installedVersion) {
          unchanged += 1;
          continue;
        }
        await this.materializer.install(options.configRoot, item);
        this.stateSupport.upsertManagedIntegration(state, {
          ...managed,
          state: "active",
          installedVersion: item.sourceVersion,
          updatedAt: new Date().toISOString(),
          lastOperationStatus: "success",
        });
        changed += 1;
      }

      const saved = await this.store.save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }

      const summary = this.reportBuilder.createLifecycleSummary({
        operation: "update",
        status: failed > 0 ? "partial" : "success",
        changed,
        unchanged,
        skipped,
        failed,
        unavailable,
        message: `Updated ${changed} MCP(s), ${unchanged} unchanged, ${skipped} skipped, ${unavailable} unavailable, ${failed} failed.`,
      });
      await this.logStore.append(options.configRoot, {
        operationId: `mcp-update-${Date.now()}`,
        operationType: "update",
        registryId: "smithery",
        status: summary.status,
        message: summary.message,
        occurredAt: new Date().toISOString(),
      });

      return ok(summary);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
