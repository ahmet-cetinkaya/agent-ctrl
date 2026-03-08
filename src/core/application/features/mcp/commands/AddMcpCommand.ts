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

export class AddMcpCommand {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly materializer = new ManagedMcpMaterializer(),
    private readonly synchronizer = new McpCatalogSynchronizer(),
    private readonly client = new SmitheryRegistryClient(),
    private readonly compatibilityEvaluator = new CatalogCompatibilityEvaluator(),
    private readonly logStore = new CatalogOperationLogStore(),
    private readonly credentialBootstrap = new CatalogCredentialBootstrap()
  ) {}

  async execute(options: AddMcpCommandOptions): Promise<Result<AddMcpCommandResult, Error>> {
    try {
      await this.credentialBootstrap.applySmitheryCredentials(options.configRoot, options.apiKey);
      if (options.refresh) {
        await this.synchronizer.synchronize({
          configRoot: options.configRoot,
          query: this.normalizeRef(options.ref),
          force: true,
          apiKey: options.apiKey,
        });
      }

      const loaded = await this.store.load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;

      let item = this.stateSupport.findCatalogItem(state, options.ref);
      if (!item) {
        const detail = await this.client.getServerDetails(this.normalizeRef(options.ref));
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
        this.stateSupport.upsertCatalogItems(state, [item]);
      }

      if (item.availabilityState !== "available") {
        return err(new Error(`MCP ${item.sourceItemId} is no longer available and cannot be activated.`));
      }

      const gate = this.compatibilityEvaluator.canActivate(item);
      this.stateSupport.setCompatibility(state, gate.assessment);
      if (!gate.allowed) {
        return err(new Error(gate.message ?? "MCP is incompatible."));
      }

      const materialized = await this.materializer.install(options.configRoot, {
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

      this.stateSupport.upsertManagedIntegration(state, managed);
      const entry = createOperationLogEntry({
        operationId: `mcp-add-${Date.now()}`,
        operationType: "activate",
        registryId: "smithery",
        catalogKey: item.catalogKey,
        status: "success",
        message: `Activated MCP ${item.sourceItemId}`,
        occurredAt: now,
      });
      this.stateSupport.addOperationLog(state, entry);

      const saved = await this.store.save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }
      await this.logStore.append(options.configRoot, entry);

      return ok({ item, managedIntegration: managed });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private normalizeRef(ref: string): string {
    return ref.replace(/^smithery:/, "");
  }
}
