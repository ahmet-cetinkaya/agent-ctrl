import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { ManagedIntegration } from "@/core/domain/shared/entities";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { SkillInstallMaterializer } from "@/infrastructure/features/skill/metadata/SkillInstallMaterializer";

export interface RemoveSkillCommandOptions {
  configRoot: string;
  ref: string;
}

export interface RemoveSkillCommandResult {
  managedIntegration: ManagedIntegration;
}

export class RemoveSkillCommand {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly materializer = new SkillInstallMaterializer(),
    private readonly logStore = new CatalogOperationLogStore()
  ) {}

  async execute(options: RemoveSkillCommandOptions): Promise<Result<RemoveSkillCommandResult, Error>> {
    try {
      const loaded = await this.store.load(options.configRoot);
      if (!loaded.success) {
        return err(loaded.error);
      }
      const state = loaded.data;
      const managed = this.stateSupport.findManagedIntegration(state, options.ref);
      if (!managed || managed.itemType !== "skill") {
        return err(new Error(`Managed skill ${options.ref} was not found.`));
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
        operationId: `skill-rm-${Date.now()}`,
        operationType: "deactivate",
        registryId: "skillsmp",
        catalogKey: managed.catalogKey,
        status: "success",
        message: `Deactivated skill ${managed.managedId}`,
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
