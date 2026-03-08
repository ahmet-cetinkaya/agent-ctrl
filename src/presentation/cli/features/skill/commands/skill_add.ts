import { Command } from "commander";
import { AddSkillCommand } from "@/core/application/features/skill/commands/AddSkillCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createSkillAddCommand(): Command {
  return new Command("add")
    .description("Activate a skill from the synchronized catalog")
    .argument("<ref>", "Skill reference such as skillsmp:code-review")
    .option("-j, --json", "Output as JSON")
    .option("--refresh", "Refresh source data before activation")
    .option("--version <value>", "Request a specific version when supported")
    .option("--api-key <value>", "Override the SkillsMP API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      const command = new AddSkillCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        refresh: Boolean(options.refresh),
        version: options.version as string | undefined,
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

      console.log(`Activated skill ${result.data.item.displayName} at ${result.data.managedIntegration.localPath}`);
    });
}
