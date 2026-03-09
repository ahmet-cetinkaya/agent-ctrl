import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok } from "@/core/domain/shared/value-objects/Result";
import type { CatalogState, ICatalogStateStore } from "@/core/domain/shared/interfaces/ICatalogStateStore";
import { createSourceRegistry } from "@/core/domain/shared/entities/SourceRegistry";
import { CatalogPathResolver } from "./CatalogPathResolver";

export class CatalogStateFileStore implements ICatalogStateStore {
  private readonly pathResolver = new CatalogPathResolver();

  async load(configRoot: string) {
    const { stateFile } = this.pathResolver.resolveFromConfigRoot(configRoot);

    try {
      const raw = await readFile(stateFile, "utf-8");
      const parsed = JSON.parse(raw) as Partial<CatalogState>;
      return ok(this.normalize(parsed));
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        return ok(this.createEmptyState());
      }
      return err(new Error(`Failed to load catalog state from ${stateFile}: ${nodeErr.message}`));
    }
  }

  async save(configRoot: string, state: CatalogState) {
    const { stateFile } = this.pathResolver.resolveFromConfigRoot(configRoot);

    try {
      await mkdir(dirname(stateFile), { recursive: true });
      await writeFile(stateFile, JSON.stringify(this.normalize(state), null, 2), "utf-8");
      return ok(undefined);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      return err(new Error(`Failed to save catalog state to ${stateFile}: ${nodeErr.message}`));
    }
  }

  private createEmptyState(): CatalogState {
    return {
      version: 1,
      registries: [createSourceRegistry("skillsmp"), createSourceRegistry("smithery")],
      discoveryScopes: [],
      catalogItems: [],
      managedIntegrations: [],
      compatibilityAssessments: [],
      operationLogs: [],
    };
  }

  private normalize(input: Partial<CatalogState>): CatalogState {
    const empty = this.createEmptyState();
    const registriesById = new Map(empty.registries.map((registry) => [registry.registryId, registry]));

    for (const registry of input.registries ?? []) {
      registriesById.set(registry.registryId, { ...registriesById.get(registry.registryId), ...registry });
    }

    return {
      version: 1,
      registries: Array.from(registriesById.values()).sort((a, b) => a.registryId.localeCompare(b.registryId)),
      discoveryScopes: [...(input.discoveryScopes ?? [])].sort((a, b) => a.scopeId.localeCompare(b.scopeId)),
      catalogItems: [...(input.catalogItems ?? [])].sort((a, b) => a.catalogKey.localeCompare(b.catalogKey)),
      managedIntegrations: [...(input.managedIntegrations ?? [])].sort((a, b) =>
        a.managedId.localeCompare(b.managedId)
      ),
      compatibilityAssessments: [...(input.compatibilityAssessments ?? [])].sort((a, b) =>
        a.catalogKey.localeCompare(b.catalogKey)
      ),
      operationLogs: [...(input.operationLogs ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    };
  }
}
