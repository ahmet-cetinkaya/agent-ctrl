import { ok, err, type Result } from "@/core/domain/shared/value-objects/Result";
import type { CatalogItem, SyncReport } from "@/core/domain/shared/entities";
import { McpCatalogSynchronizer } from "@/infrastructure/features/mcp/registries/McpCatalogSynchronizer";

export interface SyncMcpCatalogCommandOptions {
  configRoot: string;
  query?: string;
  force?: boolean;
  apiKey?: string;
}

export interface SyncMcpCatalogCommandResult {
  items: CatalogItem[];
  report: SyncReport;
}

export class SyncMcpCatalogCommand {
  constructor(private readonly synchronizer = new McpCatalogSynchronizer()) {}

  async execute(options: SyncMcpCatalogCommandOptions): Promise<Result<SyncMcpCatalogCommandResult, Error>> {
    try {
      const result = await this.synchronizer.synchronize(options);
      return ok({ items: result.items, report: result.report });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
