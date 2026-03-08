import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, ManagedIntegration } from "@/core/domain/shared/entities";
import { createManagedIntegration } from "@/core/domain/shared/entities/ManagedIntegration";
import { createOperationLogEntry } from "@/core/domain/shared/entities/OperationLogEntry";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { SkillInstallMaterializer } from "@/infrastructure/features/skill/metadata/SkillInstallMaterializer";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { SkillsMpClient } from "@/infrastructure/features/catalog/clients/SkillsMpClient";

export interface AddSkillCommandOptions {
  configRoot: string;
  ref: string;
  refresh?: boolean;
  version?: string;
  apiKey?: string;
}

export interface AddSkillCommandResult {
  item: CatalogItem;
  managedIntegration: ManagedIntegration;
}

export class AddSkillCommand {
  constructor(
    private readonly store = new CatalogStateFileStore(),
    private readonly stateSupport = new CatalogStateSupport(),
    private readonly materializer = new SkillInstallMaterializer(),
    private readonly synchronizer = new SkillCatalogSynchronizer(),
    private readonly client = new SkillsMpClient(),
    private readonly compatibilityEvaluator = new CatalogCompatibilityEvaluator(),
    private readonly logStore = new CatalogOperationLogStore(),
    private readonly credentialBootstrap = new CatalogCredentialBootstrap()
  ) {}

  async execute(options: AddSkillCommandOptions): Promise<Result<AddSkillCommandResult, Error>> {
    try {
      await this.credentialBootstrap.applySkillCredentials(options.configRoot, options.apiKey);
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
        const detail = await this.client.getSkillDetails(this.normalizeRef(options.ref));
        if (!detail.success) {
          return err(detail.error);
        }
        item = {
          catalogKey: `skillsmp:${detail.data.id}`,
          registryId: "skillsmp",
          itemType: "skill",
          sourceItemId: detail.data.id,
          displayName: detail.data.name,
          description: detail.data.description,
          capabilities: detail.data.capabilities,
          categories: detail.data.categories,
          sourceVersion: options.version ?? detail.data.version,
          availabilityState: "available",
          compatibilityState: detail.data.metadata?.compatibility?.state ?? "unknown",
          activationState: "inactive",
          lastSeenAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          sourceUrl: detail.data.sourceUrl,
          metadata: {
            ...detail.data.metadata,
            installation: detail.data.installation,
          },
        };
        this.stateSupport.upsertCatalogItems(state, [item]);
      }
      if (!item) {
        return err(new Error(`Skill ${options.ref} could not be resolved from the local catalog or SkillsMP.`));
      }

      const installable = await this.ensureInstallableItem(item);
      if (!installable.success) {
        return err(installable.error);
      }
      item = installable.data;
      this.stateSupport.upsertCatalogItems(state, [item]);

      if (item.availabilityState !== "available") {
        return err(new Error(`Skill ${item.sourceItemId} is no longer available and cannot be activated.`));
      }

      const gate = this.compatibilityEvaluator.canActivate(item);
      this.stateSupport.setCompatibility(state, gate.assessment);
      if (!gate.allowed) {
        return err(new Error(gate.message ?? "Skill is incompatible."));
      }

      const materialized = await this.materializer.install(options.configRoot, {
        ...item,
        sourceVersion: options.version ?? item.sourceVersion,
      });
      const now = new Date().toISOString();
      const managed = createManagedIntegration({
        managedId: this.normalizeRef(options.ref),
        catalogKey: item.catalogKey,
        itemType: "skill",
        localPath: materialized.localPath,
        state: "active",
        installedVersion: options.version ?? item.sourceVersion,
        requestedVersion: options.version,
        installedAt: now,
        updatedAt: now,
        lastOperationStatus: "success",
        sourceRef: `skillsmp:${item.sourceItemId}`,
      });

      this.stateSupport.upsertManagedIntegration(state, managed);
      const entry = createOperationLogEntry({
        operationId: `skill-add-${Date.now()}`,
        operationType: "activate",
        registryId: "skillsmp",
        catalogKey: item.catalogKey,
        status: "success",
        message: `Activated skill ${item.sourceItemId}`,
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
    return ref.replace(/^skillsmp:/, "").split("@")[0];
  }

  private async ensureInstallableItem(item: CatalogItem): Promise<Result<CatalogItem, Error>> {
    if (this.hasInstallPayload(item)) {
      return ok(item);
    }

    const detail = await this.client.getSkillDetails(item.sourceItemId, {
      id: item.sourceItemId,
      name: item.displayName,
      description: item.description,
      capabilities: item.capabilities,
      categories: item.categories,
      version: item.sourceVersion,
      sourceUrl: item.sourceUrl,
      metadata: item.metadata,
    });
    if (!detail.success) {
      return err(detail.error);
    }

    const enriched: CatalogItem = {
      ...item,
      displayName: detail.data.name ?? item.displayName,
      description: detail.data.description ?? item.description,
      capabilities: detail.data.capabilities.length > 0 ? detail.data.capabilities : item.capabilities,
      categories: detail.data.categories.length > 0 ? detail.data.categories : item.categories,
      sourceVersion: detail.data.version ?? item.sourceVersion,
      sourceUrl: detail.data.sourceUrl ?? item.sourceUrl,
      metadata: {
        ...(item.metadata ?? {}),
        ...(detail.data.metadata ?? {}),
        installation: detail.data.installation ?? detail.data.metadata?.installation ?? item.metadata?.installation,
      },
    };

    if (!this.hasInstallPayload(enriched)) {
      return err(
        new Error(
          `Could not fetch installable files for skill ${item.sourceItemId}. SkillsMP returned catalog metadata but not the skill contents.`
        )
      );
    }

    return ok(enriched);
  }

  private hasInstallPayload(item: CatalogItem): boolean {
    const installation = item.metadata?.installation;
    return Boolean(installation?.skillMarkdown || (installation?.files && Object.keys(installation.files).length > 0));
  }
}
