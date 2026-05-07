import { Command } from "commander";
import { UpdateSkillCommand } from "@/core/application/features/skill/commands/UpdateSkillCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { renderLifecycleSummary } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createSkillUpdateCommand(): Command {
  return new Command("update")
    .description("Update one or more managed skills")
    .argument("[ref]", "Managed skill identifier")
    .option("--all", "Update all managed skills")
    .option("--refresh", "Refresh source data before updating")
    .option("-j, --json", "Output as JSON")
    .option("--api-key <value>", "Override the SkillsMP API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string | undefined, options: Record<string, string | boolean | undefined>) => {
      LogService.intro("Updating skills");
      const command = new UpdateSkillCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        all: Boolean(options.all),
        refresh: Boolean(options.refresh),
        apiKey: options.apiKey as string | undefined,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        LogService.raw(JSON.stringify(result.data, null, 2));
      } else {
        for (const line of renderLifecycleSummary(result.data)) {
          LogService.log(line);
        }
      }
      LogService.outro("Update complete");
    });
}
