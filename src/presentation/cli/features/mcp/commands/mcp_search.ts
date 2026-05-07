import { Command } from "commander";
import { SearchMcpCatalogQuery } from "@/core/application/features/mcp/queries/SearchMcpCatalogQuery";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import { renderCatalogSearchResults } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createMcpSearchCommand(): Command {
  return new Command("search")
    .description("Search synchronized Smithery MCP catalog entries")
    .argument("<query>", "Search query")
    .option("-j, --json", "Output as JSON")
    .option("--capability <value>", "Filter by capability")
    .option("--status <value>", "Filter by activation, compatibility, or availability status")
    .option("--refresh", "Refresh source data before searching")
    .option("--api-key <value>", "Override the Smithery API key for this command")
    .option("--path <value>", "Configuration root path")
    .option("--no-prompt", "Disable interactive selection", false)
    .action(async (query: string, options: Record<string, string | boolean | undefined>) => {
      PromptService.startTask("Searching MCP catalog");
      const command = new SearchMcpCatalogQuery();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query,
        capability: options.capability as string | undefined,
        status: options.status as string | undefined,
        refresh: Boolean(options.refresh),
        apiKey: options.apiKey as string | undefined,
      });

      if (!result.success) {
        PromptService.stopTask();
        handleQueryResult(result);
        return;
      }
      PromptService.stopTask("Search complete");

      const { items, registry, report } = result.data;
      if (options.json) {
        LogService.unstyled(JSON.stringify({ items, registry, report }, null, 2));
        return;
      }

      const interactive = options["prompt"] !== false;

      if (!interactive) {
        for (const line of renderCatalogSearchResults(items)) {
          LogService.log(line);
        }
        return;
      }

      LogService.intro("Select MCPs to activate");
      for (const line of renderCatalogSearchResults(items)) {
        LogService.log(line);
      }

      if (items.length === 0) {
        LogService.outro("No results");
        return;
      }

      const selected = await PromptService.selectMany({
        message: "Select MCPs to activate",
        options: items.map((item) => ({
          value: item.sourceItemId,
          label: item.displayName,
        })),
        required: false,
      });

      if (PromptService.isCancelled(selected)) {
        PromptService.cancel();
        process.exit(0);
      }

      LogService.log(`\nSelected: ${(selected as string[]).join(", ")}`);
      LogService.outro(`${(selected as string[]).length} MCP(s) selected`);
    });
}
