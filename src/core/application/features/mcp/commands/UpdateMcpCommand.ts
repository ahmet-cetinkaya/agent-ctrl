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

interface UpdateMcpCommandDependencies {
  store: CatalogStateFileStore;
  stateSupport: CatalogStateSupport;
  synchronizer: McpCatalogSynchronizer;
  compatibilityEvaluator: CatalogCompatibilityEvaluator;
  materializer: ManagedMcpMaterializer;
  reportBuilder: CatalogOperationReportBuilder;
  logStore: CatalogOperationLogStore;
  credentialBootstrap: CatalogCredentialBootstrap;
}

export class UpdateMcpCommand {
  constructor(private readonly deps: Partial<UpdateMcpCommandDependencies> = {}) {}

  async execute(options: UpdateMcpCommandOptions): Promise<Result<LifecycleOperationSummary, Error>> {
    try {
      await this.getCredentialBootstrap().applySmitheryCredentials(options.configRoot, options.apiKey);
      if (options.refresh) {
        await this.getSynchronizer().synchronize({
          configRoot: options.configRoot,
          force: true,
          apiKey: options.apiKey,
        });
      }

      const loaded = await this.getStore().load(options.configRoot);
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
        const item = this.getStateSupport().findCatalogItem(state, managed.catalogKey);
        if (!item) {
          failed += 1;
          continue;
        }
        if (item.availabilityState !== "available") {
          unavailable += 1;
          continue;
        }
        const gate = this.getCompatibilityEvaluator().canActivate(item);
        this.getStateSupport().setCompatibility(state, gate.assessment);
        if (!gate.allowed) {
          skipped += 1;
          continue;
        }
        if (!item.sourceVersion || item.sourceVersion === managed.installedVersion) {
          unchanged += 1;
          continue;
        }
        await this.getMaterializer().install(options.configRoot, item);
        this.getStateSupport().upsertManagedIntegration(state, {
          ...managed,
          state: "active",
          installedVersion: item.sourceVersion,
          updatedAt: new Date().toISOString(),
          lastOperationStatus: "success",
        });
        changed += 1;
      }

      const saved = await this.getStore().save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }

      const summary = this.getReportBuilder().createLifecycleSummary({
        operation: "update",
        status: failed > 0 ? "partial" : "success",
        changed,
        unchanged,
        skipped,
        failed,
        unavailable,
        message: `Updated ${changed} MCP(s), ${unchanged} unchanged, ${skipped} skipped, ${unavailable} unavailable, ${failed} failed.`,
      });
      await this.getLogStore().append(options.configRoot, {
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

  private getStore(): CatalogStateFileStore {
    return (this.deps.store ??= new CatalogStateFileStore());
  }

  private getStateSupport(): CatalogStateSupport {
    return (this.deps.stateSupport ??= new CatalogStateSupport());
  }

  private getSynchronizer(): McpCatalogSynchronizer {
    return (this.deps.synchronizer ??= new McpCatalogSynchronizer());
  }

  private getCompatibilityEvaluator(): CatalogCompatibilityEvaluator {
    return (this.deps.compatibilityEvaluator ??= new CatalogCompatibilityEvaluator());
  }

  private getMaterializer(): ManagedMcpMaterializer {
    return (this.deps.materializer ??= new ManagedMcpMaterializer());
  }

  private getReportBuilder(): CatalogOperationReportBuilder {
    return (this.deps.reportBuilder ??= new CatalogOperationReportBuilder());
  }

  private getLogStore(): CatalogOperationLogStore {
    return (this.deps.logStore ??= new CatalogOperationLogStore());
  }

  private getCredentialBootstrap(): CatalogCredentialBootstrap {
    return (this.deps.credentialBootstrap ??= new CatalogCredentialBootstrap());
  }
}
