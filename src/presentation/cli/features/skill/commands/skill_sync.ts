import { Command } from "commander";
import { SyncSkillsCommand } from "@/core/application/features/skill/commands/SyncSkillsCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
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
    .action(async (options: Record<string, string | boolean | undefined>) => {
      const command = new SyncSkillsCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query: options.query as string | undefined,
        category: options.category as string | undefined,
        ai: Boolean(options.ai),
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
