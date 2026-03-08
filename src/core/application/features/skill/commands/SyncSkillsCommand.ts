import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, SyncReport } from "@/core/domain/shared/entities";
import { SkillCatalogSynchronizer } from "@/infrastructure/features/skill/registries/SkillCatalogSynchronizer";

export interface SyncSkillsCommandOptions {
  configRoot: string;
  query?: string;
  category?: string;
  ai?: boolean;
  force?: boolean;
  apiKey?: string;
}

export interface SyncSkillsCommandResult {
  items: CatalogItem[];
  report: SyncReport;
}

export class SyncSkillsCommand {
  constructor(private readonly synchronizer = new SkillCatalogSynchronizer()) {}

  async execute(options: SyncSkillsCommandOptions): Promise<Result<SyncSkillsCommandResult, Error>> {
    try {
      const result = await this.synchronizer.synchronize(options);
      return ok({ items: result.items, report: result.report });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
