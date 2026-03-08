import { Command } from "commander";
import { SyncMcpCatalogCommand } from "@/core/application/features/mcp/commands/SyncMcpCatalogCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { renderCatalogItems, renderSyncReport } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createMcpSyncCommand(): Command {
  return new Command("sync")
    .description("Refresh the synchronized Smithery catalog")
    .option("-j, --json", "Output as JSON")
    .option("--query <value>", "Refresh with a scoped query")
    .option("--refresh", "Force a refresh even if cache is still fresh")
    .option("--api-key <value>", "Override the Smithery API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const command = new SyncMcpCatalogCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query: options.query as string | undefined,
        force: Boolean(options.refresh),
        apiKey: options.apiKey as string | undefined,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }
      for (const line of renderSyncReport(result.data.report)) {
        console.log(line);
      }
      for (const line of renderCatalogItems(result.data.items)) {
        console.log(line);
      }
    });
}
