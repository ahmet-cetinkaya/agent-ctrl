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
import { GitSkillClient } from "@/infrastructure/features/catalog/clients/GitSkillClient";

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

interface AddSkillCommandDependencies {
  store: CatalogStateFileStore;
  stateSupport: CatalogStateSupport;
  materializer: SkillInstallMaterializer;
  synchronizer: SkillCatalogSynchronizer;
  client: SkillsMpClient;
  gitClient: GitSkillClient;
  compatibilityEvaluator: CatalogCompatibilityEvaluator;
  logStore: CatalogOperationLogStore;
  credentialBootstrap: CatalogCredentialBootstrap;
}

export class AddSkillCommand {
  constructor(private readonly deps: Partial<AddSkillCommandDependencies> = {}) {}

  async execute(options: AddSkillCommandOptions): Promise<Result<AddSkillCommandResult, Error>> {
    try {
      const isGitRef = options.ref.startsWith("git:");

      if (isGitRef) {
        return this.executeGitSkill(options);
      }

      return this.executeSkillsMpSkill(options);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async executeGitSkill(options: AddSkillCommandOptions): Promise<Result<AddSkillCommandResult, Error>> {
    await this.getCredentialBootstrap().applySkillCredentials(options.configRoot, options.apiKey);

    const loaded = await this.getStore().load(options.configRoot);
    if (!loaded.success) {
      return err(loaded.error);
    }
    const state = loaded.data;

    const gitRef = options.ref.replace(/^git:/, "");
    let item = this.getStateSupport().findCatalogItem(state, options.ref);
    if (!item) {
      const detail = await this.getGitClient().getSkillDetails(gitRef);
      if (!detail.success) {
        return err(detail.error);
      }
      item = {
        catalogKey: `git:${detail.data.id}`,
        registryId: "git",
        itemType: "skill",
        sourceItemId: detail.data.name,
        displayName: detail.data.name,
        description: detail.data.description,
        capabilities: [],
        categories: [],
        sourceVersion: options.version,
        availabilityState: "available",
        compatibilityState: "unknown",
        activationState: "inactive",
        lastSeenAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        sourceUrl: gitRef,
        metadata: {
          installation: {
            skillMarkdown: detail.data.skillMarkdown,
            files: detail.data.files,
          },
        },
      };
      this.getStateSupport().upsertCatalogItems(state, [item]);
    }
    if (!item) {
      return err(new Error(`Skill ${options.ref} could not be resolved.`));
    }

    const installable = await this.ensureInstallableItem(item);
    if (!installable.success) {
      return err(installable.error);
    }
    item = installable.data;
    this.getStateSupport().upsertCatalogItems(state, [item]);

    if (item.availabilityState !== "available") {
      return err(new Error(`Skill ${item.sourceItemId} is no longer available and cannot be activated.`));
    }

    const gate = this.getCompatibilityEvaluator().canActivate(item);
    this.getStateSupport().setCompatibility(state, gate.assessment);
    if (!gate.allowed) {
      return err(new Error(gate.message ?? "Skill is incompatible."));
    }

    const materialized = await this.getMaterializer().install(options.configRoot, {
      ...item,
      sourceVersion: options.version ?? item.sourceVersion,
    });
    const now = new Date().toISOString();
    const managed = createManagedIntegration({
      managedId: options.ref,
      catalogKey: item.catalogKey,
      itemType: "skill",
      localPath: materialized.localPath,
      state: "active",
      installedVersion: options.version ?? item.sourceVersion,
      requestedVersion: options.version,
      installedAt: now,
      updatedAt: now,
      lastOperationStatus: "success",
      sourceRef: options.ref,
    });

    this.getStateSupport().upsertManagedIntegration(state, managed);
    const entry = createOperationLogEntry({
      operationId: `skill-add-${Date.now()}`,
      operationType: "activate",
      registryId: "git",
      catalogKey: item.catalogKey,
      status: "success",
      message: `Activated skill ${item.sourceItemId}`,
      occurredAt: now,
    });
    this.getStateSupport().addOperationLog(state, entry);

    const saved = await this.getStore().save(options.configRoot, state);
    if (!saved.success) {
      return err(saved.error);
    }
    await this.getLogStore().append(options.configRoot, entry);

    return ok({ item, managedIntegration: managed });
  }

  private async executeSkillsMpSkill(options: AddSkillCommandOptions): Promise<Result<AddSkillCommandResult, Error>> {
    await this.getCredentialBootstrap().applySkillCredentials(options.configRoot, options.apiKey);
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
      const detail = await this.getClient().getSkillDetails(this.normalizeRef(options.ref));
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
      this.getStateSupport().upsertCatalogItems(state, [item]);
    }
    if (!item) {
      return err(new Error(`Skill ${options.ref} could not be resolved from the local catalog or SkillsMP.`));
    }

    const installable = await this.ensureInstallableItem(item);
    if (!installable.success) {
      return err(installable.error);
    }
    item = installable.data;
    this.getStateSupport().upsertCatalogItems(state, [item]);

    if (item.availabilityState !== "available") {
      return err(new Error(`Skill ${item.sourceItemId} is no longer available and cannot be activated.`));
    }

    const gate = this.getCompatibilityEvaluator().canActivate(item);
    this.getStateSupport().setCompatibility(state, gate.assessment);
    if (!gate.allowed) {
      return err(new Error(gate.message ?? "Skill is incompatible."));
    }

    const materialized = await this.getMaterializer().install(options.configRoot, {
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

    this.getStateSupport().upsertManagedIntegration(state, managed);
    const entry = createOperationLogEntry({
      operationId: `skill-add-${Date.now()}`,
      operationType: "activate",
      registryId: "skillsmp",
      catalogKey: item.catalogKey,
      status: "success",
      message: `Activated skill ${item.sourceItemId}`,
      occurredAt: now,
    });
    this.getStateSupport().addOperationLog(state, entry);

    const saved = await this.getStore().save(options.configRoot, state);
    if (!saved.success) {
      return err(saved.error);
    }
    await this.getLogStore().append(options.configRoot, entry);

    return ok({ item, managedIntegration: managed });
  }

  private normalizeRef(ref: string): string {
    return ref.replace(/^skillsmp:/, "").split("@")[0];
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

  private getMaterializer(): SkillInstallMaterializer {
    return (this.deps.materializer ??= new SkillInstallMaterializer());
  }

  private getSynchronizer(): SkillCatalogSynchronizer {
    return (this.deps.synchronizer ??= new SkillCatalogSynchronizer());
  }

  private getClient(): SkillsMpClient {
    return (this.deps.client ??= new SkillsMpClient());
  }

  private getGitClient(): GitSkillClient {
    return (this.deps.gitClient ??= new GitSkillClient());
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
}
