import { Command } from "commander";
import { SyncSkillsCommand } from "@/core/application/features/skill/commands/SyncSkillsCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import { renderCatalogItems, renderSyncReport } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createSkillSyncCommand(): Command {
  return new Command("sync")
    .description("Refresh tracked SkillsMP discovery scopes")
    .option("-j, --json", "Output as JSON")
    .option("--query <value>", "Refresh or seed a query-based discovery scope")
    .option("--category <value>", "Refresh or seed a category-based discovery scope")
    .option("--ai", "Use AI search when supported by the source")
    .option("--refresh", "Force a refresh even if cache is still fresh")
    .option("--api-key <value>", "Override the SkillsMP API key for this command")
    .option("--path <value>", "Configuration root path")
    .option("-d, --dry-run", "Preview what would be synced without syncing", false)
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const command = new SyncSkillsCommand();

      if (options.dryRun) {
        LogService.intro("Syncing skills");
        LogService.log("Would sync skills from SkillsMP catalog");
        LogService.log("Note: Use without --dry-run to sync");
        return;
      }

      LogService.intro("Syncing skills");
      PromptService.startTask("Syncing skills");
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query: options.query as string | undefined,
        category: options.category as string | undefined,
        ai: Boolean(options.ai),
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
