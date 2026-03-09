import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { LifecycleOperationSummary } from "@/core/domain/shared/entities/SyncReport";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";
import { CatalogCredentialBootstrap } from "@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap";
import { CatalogStateSupport } from "@/infrastructure/features/catalog/caching/CatalogStateSupport";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { CatalogCompatibilityEvaluator } from "@/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator";
import { CatalogOperationReportBuilder } from "@/infrastructure/features/catalog/reporting/CatalogOperationReportBuilder";
import { SkillInstallMaterializer } from "@/infrastructure/features/skill/metadata/SkillInstallMaterializer";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";
import { SkillsMpClient } from "@/infrastructure/features/catalog/clients/SkillsMpClient";
import type { CatalogItem } from "@/core/domain/shared/entities";

export interface UpdateSkillCommandOptions {
  configRoot: string;
  ref?: string;
  all?: boolean;
  refresh?: boolean;
  apiKey?: string;
}

interface UpdateSkillCommandDependencies {
  store: CatalogStateFileStore;
  stateSupport: CatalogStateSupport;
  synchronizer: SkillCatalogSynchronizer;
  compatibilityEvaluator: CatalogCompatibilityEvaluator;
  materializer: SkillInstallMaterializer;
  reportBuilder: CatalogOperationReportBuilder;
  logStore: CatalogOperationLogStore;
  credentialBootstrap: CatalogCredentialBootstrap;
  client: SkillsMpClient;
}

export class UpdateSkillCommand {
  constructor(private readonly deps: Partial<UpdateSkillCommandDependencies> = {}) {}

  async execute(options: UpdateSkillCommandOptions): Promise<Result<LifecycleOperationSummary, Error>> {
    try {
      await this.getCredentialBootstrap().applySkillCredentials(options.configRoot, options.apiKey);
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
        (entry) => entry.itemType === "skill" && (options.all || entry.managedId === options.ref)
      );
      if (targets.length === 0) {
        return err(new Error("No managed skills matched the requested update target."));
      }

      let changed = 0;
      let unchanged = 0;
      let skipped = 0;
      let failed = 0;
      let unavailable = 0;

      for (const managed of targets) {
        let item = this.getStateSupport().findCatalogItem(state, managed.catalogKey);
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
        const installable = await this.ensureInstallableItem(item);
        if (!installable.success) {
          failed += 1;
          continue;
        }
        item = installable.data;
        this.getStateSupport().upsertCatalogItems(state, [item]);
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
        message: `Updated ${changed} skill(s), ${unchanged} unchanged, ${skipped} skipped, ${unavailable} unavailable, ${failed} failed.`,
      });
      await this.getLogStore().append(options.configRoot, {
        operationId: `skill-update-${Date.now()}`,
        operationType: "update",
        registryId: "skillsmp",
        status: summary.status,
        message: summary.message,
        occurredAt: new Date().toISOString(),
      });

      return ok(summary);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async ensureInstallableItem(item: CatalogItem): Promise<Result<CatalogItem, Error>> {
    if (this.hasInstallPayload(item)) {
      return ok(item);
    }

    const detail = await this.getClient().getSkillDetails(item.sourceItemId, {
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

  private getStore(): CatalogStateFileStore {
    return (this.deps.store ??= new CatalogStateFileStore());
  }

  private getStateSupport(): CatalogStateSupport {
    return (this.deps.stateSupport ??= new CatalogStateSupport());
  }

  private getSynchronizer(): SkillCatalogSynchronizer {
    return (this.deps.synchronizer ??= new SkillCatalogSynchronizer());
  }

  private getCompatibilityEvaluator(): CatalogCompatibilityEvaluator {
    return (this.deps.compatibilityEvaluator ??= new CatalogCompatibilityEvaluator());
  }

  private getMaterializer(): SkillInstallMaterializer {
    return (this.deps.materializer ??= new SkillInstallMaterializer());
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

  private getClient(): SkillsMpClient {
    return (this.deps.client ??= new SkillsMpClient());
  }
}
