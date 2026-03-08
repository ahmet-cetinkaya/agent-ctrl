import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { ManagedIntegration } from "@/core/domain/shared/entities";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { ManagedMcpMaterializer } from "@/infrastructure/features/mcp/metadata/ManagedMcpMaterializer";

export interface RemoveMcpCommandOptions {
  configRoot: string;
  ref: string;
}

export interface RemoveMcpCommandResult {
  managedIntegration: ManagedIntegration;
}

export class RemoveMcpCommand {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly materializer = new ManagedMcpMaterializer(),
    private readonly logStore = new CatalogOperationLogStore()
  ) {}

  async execute(options: RemoveMcpCommandOptions): Promise<Result<RemoveMcpCommandResult, Error>> {
    try {
      const loaded = await this.store.load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;
      const managed = this.stateSupport.findManagedIntegration(state, options.ref);
      if (!managed || managed.itemType !== "mcp") {
        return err(new Error(`Managed MCP ${options.ref} was not found.`));
      }

      await this.materializer.remove(managed.localPath);
      const updated = {
        ...managed,
        state: "inactive" as const,
        deactivatedAt: new Date().toISOString(),
        lastOperationStatus: "success" as const,
      };
      this.stateSupport.upsertManagedIntegration(state, updated);

      const entry = createOperationLogEntry({
        operationId: `mcp-rm-${Date.now()}`,
        operationType: "deactivate",
        registryId: "smithery",
        catalogKey: managed.catalogKey,
        status: "success",
        message: `Deactivated MCP ${managed.managedId}`,
        occurredAt: new Date().toISOString(),
      });
      this.stateSupport.addOperationLog(state, entry);

      const saved = await this.store.save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }
      await this.logStore.append(options.configRoot, entry);

      return ok({ managedIntegration: updated });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
