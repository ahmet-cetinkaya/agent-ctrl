import { Command } from "commander";
import { SearchSkillsQuery } from "@/core/application/features/skill/queries/SearchSkillsQuery";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { renderCatalogSearchResults } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createSkillSearchCommand(): Command {
  return new Command("search")
    .description("Search synchronized SkillsMP catalog entries")
    .argument("<query>", "Search query")
    .option("-j, --json", "Output as JSON")
    .option("--capability <value>", "Filter by capability")
    .option("--status <value>", "Filter by activation, compatibility, or availability status")
    .option("--refresh", "Refresh source data before searching")
    .option("--ai", "Use AI search when supported by the source")
    .option("--api-key <value>", "Override the SkillsMP API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (query: string, options: Record<string, string | boolean | undefined>) => {
      const command = new SearchSkillsQuery();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        query,
        capability: options.capability as string | undefined,
        status: options.status as string | undefined,
        refresh: Boolean(options.refresh),
        ai: Boolean(options.ai),
        apiKey: options.apiKey as string | undefined,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      const { items, registry, report } = result.data;
      if (options.json) {
        console.log(JSON.stringify({ items, registry, report }, null, 2));
        return;
      }

      for (const line of renderCatalogSearchResults(items)) {
        console.log(line);
      }
    });
}
