import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { CatalogItem, ManagedIntegration } from "@/core/domain/shared/entities";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";

export interface ListSkillsQueryOptions {
  skillsPath: string;
}

export interface ListSkillsQueryResult {
  artifacts: Skill[];
  warnings: string[];
  catalogState: {
    managedById: Map<string, ManagedIntegration>;
    catalogById: Map<string, CatalogItem>;
  };
}

export class ListSkillsQuery {
  private scanner: SkillScanner;
  private catalogStore: CatalogStateFileStore;

  constructor() {
    this.scanner = new SkillScanner();
    this.catalogStore = new CatalogStateFileStore();
  }

  async execute(options: ListSkillsQueryOptions): Promise<Result<ListSkillsQueryResult, Error>> {
    try {
      const result = await this.scanner.scan(options.skillsPath);

      const configRootPath = options.skillsPath.replace(/\/skills$/, "");
      const catalogState = await this.catalogStore.load(configRootPath);
      const managedById = new Map(
        catalogState.success
          ? catalogState.data.managedIntegrations
              .filter((entry) => entry.itemType === "skill")
              .map((entry) => [entry.managedId, entry])
          : []
      );
      const catalogById = new Map(
        catalogState.success
          ? catalogState.data.catalogItems
              .filter((entry) => entry.itemType === "skill")
              .map((entry) => [entry.sourceItemId, entry])
          : []
      );

      return ok({
        artifacts: result.artifacts,
        warnings: result.warnings,
        catalogState: {
          managedById,
          catalogById,
        },
      });
    } catch (error) {
      return err(new UserError(`Failed to list skills: ${error}`));
    }
  }
}
