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

interface RemoveMcpCommandDependencies {
  store: CatalogStateFileStore;
  stateSupport: CatalogStateSupport;
  materializer: ManagedMcpMaterializer;
  logStore: CatalogOperationLogStore;
}

export class RemoveMcpCommand {
  constructor(private readonly deps: Partial<RemoveMcpCommandDependencies> = {}) {}

  async execute(options: RemoveMcpCommandOptions): Promise<Result<RemoveMcpCommandResult, Error>> {
    try {
      const loaded = await this.getStore().load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;
      const managed = this.getStateSupport().findManagedIntegration(state, options.ref);
      if (!managed || managed.itemType !== "mcp") {
        return err(new Error(`Managed MCP ${options.ref} was not found.`));
      }

      await this.getMaterializer().remove(managed.localPath);
      const updated = {
        ...managed,
        state: "inactive" as const,
        deactivatedAt: new Date().toISOString(),
        lastOperationStatus: "success" as const,
      };
      this.getStateSupport().upsertManagedIntegration(state, updated);

      const entry = createOperationLogEntry({
        operationId: `mcp-rm-${Date.now()}`,
        operationType: "deactivate",
        registryId: "smithery",
        catalogKey: managed.catalogKey,
        status: "success",
        message: `Deactivated MCP ${managed.managedId}`,
        occurredAt: new Date().toISOString(),
      });
      this.getStateSupport().addOperationLog(state, entry);

      const saved = await this.getStore().save(options.configRoot, state);
      if (!saved.success) {
        return err(saved.error);
      }
      await this.getLogStore().append(options.configRoot, entry);

      return ok({ managedIntegration: updated });
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

  private getLogStore(): CatalogOperationLogStore {
    return (this.deps.logStore ??= new CatalogOperationLogStore());
  }
}
