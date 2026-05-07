import { Command } from "commander";
import { AddSkillCommand } from "@/core/application/features/skill/commands/AddSkillCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
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
    .option("-d, --dry-run", "Preview what would be activated without activating", false)
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      const command = new AddSkillCommand();

      if (options.dryRun) {
        LogService.intro("Activating skill");
        LogService.log(`Would activate skill: ${ref}`);
        LogService.log("Note: Use without --dry-run to activate");
        return;
      }

      LogService.intro("Activating skill");
      PromptService.startTask(`Activating skill ${ref}`);
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        refresh: Boolean(options.refresh),
        version: options.version as string | undefined,
        apiKey: options.apiKey as string | undefined,
      });

      if (!result.success) {
        PromptService.stopTask();
        handleQueryResult(result);
        return;
      }
      PromptService.stopTask("Skill activated");

      if (options.json) {
        LogService.unstyled(JSON.stringify(result.data, null, 2));
        return;
      }

      LogService.success(
        `Skill ${result.data.item.displayName} activated at ${result.data.managedIntegration.localPath}`
      );
      LogService.outro(`Activated ${result.data.item.displayName}`);
    });
}
