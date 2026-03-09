import { Command } from "commander";
import { RemoveSkillCommand } from "@/core/application/features/skill/commands/RemoveSkillCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createSkillRemoveCommand(): Command {
  return new Command("rm")
    .description("Deactivate a managed skill")
    .argument("<ref>", "Managed skill identifier")
    .option("-j, --json", "Output as JSON")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      const command = new RemoveSkillCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }
      console.log(`Deactivated skill ${result.data.managedIntegration.managedId}`);
    });
}
