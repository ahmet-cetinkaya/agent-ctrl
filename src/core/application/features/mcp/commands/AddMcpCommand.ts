import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, ManagedIntegration } from "@/core/domain/shared/entities";
import { createManagedIntegration } from "@/core/domain/shared/entities/ManagedIntegration";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { ManagedMcpMaterializer } from "@/infrastructure/features/mcp/metadata/ManagedMcpMaterializer";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";
import { SmitheryRegistryClient } from "@/infrastructure/features/catalog/clients/SmitheryRegistryClient";

export interface AddMcpCommandOptions {
  configRoot: string;
  ref: string;
  refresh?: boolean;
  version?: string;
  apiKey?: string;
}

export interface AddMcpCommandResult {
  item: CatalogItem;
  managedIntegration: ManagedIntegration;
}

interface AddMcpCommandDependencies {
  store: CatalogStateFileStore;
  stateSupport: CatalogStateSupport;
  materializer: ManagedMcpMaterializer;
  synchronizer: McpCatalogSynchronizer;
  client: SmitheryRegistryClient;
  compatibilityEvaluator: CatalogCompatibilityEvaluator;
  logStore: CatalogOperationLogStore;
  credentialBootstrap: CatalogCredentialBootstrap;
}

export class AddMcpCommand {
  constructor(private readonly deps: Partial<AddMcpCommandDependencies> = {}) {}

  async execute(options: AddMcpCommandOptions): Promise<Result<AddMcpCommandResult, Error>> {
    try {
      await this.getCredentialBootstrap().applySmitheryCredentials(options.configRoot, options.apiKey);
      if (options.refresh) {
        await this.getSynchronizer().synchronize({
          configRoot: options.configRoot,
          query: this.normalizeRef(options.ref),
          force: true,
          apiKey: options.apiKey,
        });
      }

      const loaded = await this.getStore().load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;

      let item = this.getStateSupport().findCatalogItem(state, options.ref);
      if (!item) {
        const detail = await this.getClient().getServerDetails(this.normalizeRef(options.ref));
        if (!detail.success) {
          return err(detail.error);
        }
        item = {
          catalogKey: `smithery:${detail.data.qualifiedName}`,
          registryId: "smithery",
          itemType: "mcp",
          sourceItemId: detail.data.qualifiedName,
          displayName: detail.data.displayName,
          description: detail.data.description,
          capabilities: detail.data.capabilities,
          categories: detail.data.categories,
          sourceVersion: options.version ?? detail.data.version,
          availabilityState: "available",
          compatibilityState: detail.data.metadata?.compatibility?.state ?? "unknown",
          activationState: "inactive",
          lastSeenAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          sourceUrl: detail.data.homepage,
          metadata: detail.data.metadata,
        };
        this.getStateSupport().upsertCatalogItems(state, [item]);
      }

      if (item.availabilityState !== "available") {
        return err(new Error(`MCP ${item.sourceItemId} is no longer available and cannot be activated.`));
      }

      const gate = this.getCompatibilityEvaluator().canActivate(item);
      this.getStateSupport().setCompatibility(state, gate.assessment);
      if (!gate.allowed) {
        return err(new Error(gate.message ?? "MCP is incompatible."));
      }

      const materialized = await this.getMaterializer().install(options.configRoot, {
        ...item,
        sourceVersion: options.version ?? item.sourceVersion,
      });
      const now = new Date().toISOString();
      const managed = createManagedIntegration({
        managedId: this.normalizeRef(options.ref),
        catalogKey: item.catalogKey,
        itemType: "mcp",
        localPath: materialized.localPath,
        state: "active",
        installedVersion: options.version ?? item.sourceVersion,
        requestedVersion: options.version,
        installedAt: now,
        updatedAt: now,
        lastOperationStatus: "success",
        sourceRef: `smithery:${item.sourceItemId}`,
      });

      this.getStateSupport().upsertManagedIntegration(state, managed);
      const entry = createOperationLogEntry({
        operationId: `mcp-add-${Date.now()}`,
        operationType: "activate",
        registryId: "smithery",
        catalogKey: item.catalogKey,
        status: "success",
        message: `Activated MCP ${item.sourceItemId}`,
        occurredAt: now,
      });
      this.getStateSupport().addOperationLog(state, entry);

      const saved = await this.getStore().save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }
      await this.getLogStore().append(options.configRoot, entry);

      return ok({ item, managedIntegration: managed });
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

  private getMaterializer(): ManagedMcpMaterializer {
    return (this.deps.materializer ??= new ManagedMcpMaterializer());
  }

  private getSynchronizer(): McpCatalogSynchronizer {
    return (this.deps.synchronizer ??= new McpCatalogSynchronizer());
  }

  private getClient(): SmitheryRegistryClient {
    return (this.deps.client ??= new SmitheryRegistryClient());
  }

  private getCompatibilityEvaluator(): CatalogCompatibilityEvaluator {
    return (this.deps.compatibilityEvaluator ??= new CatalogCompatibilityEvaluator());
  }

  private getLogStore(): CatalogOperationLogStore {
    return (this.deps.logStore ??= new CatalogOperationLogStore());
  }

  private getCredentialBootstrap(): CatalogCredentialBootstrap {
    return (this.deps.credentialBootstrap ??= new CatalogCredentialBootstrap());
  }

  private normalizeRef(ref: string): string {
    return ref.replace(/^smithery:/, "");
  }
}
