import { Command } from "commander";
import { SyncMcpCatalogCommand } from "@/core/application/features/mcp/commands/SyncMcpCatalogCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
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
    .option("-d, --dry-run", "Preview what would be synced without syncing", false)
    .action(async (options: Record<string, string | boolean | undefined>) => {
      if (options.dryRun) {
        LogService.intro("Syncing MCPs");
        LogService.log("Would sync MCPs from Smithery catalog");
        LogService.log("Note: Use without --dry-run to sync");
        return;
      }

      PromptService.startTask("Syncing MCPs");
      const command = new SyncMcpCatalogCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query: options.query as string | undefined,
        force: Boolean(options.refresh),
        apiKey: options.apiKey as string | undefined,
      });

      PromptService.stopTask("Sync complete");

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        LogService.raw(JSON.stringify(result.data, null, 2));
        return;
      }
      for (const line of renderSyncReport(result.data.report)) {
        LogService.log(line);
      }
      for (const line of renderCatalogItems(result.data.items)) {
        LogService.log(line);
      }
    });
}
