import { Command } from "commander";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListCommandsQuery } from "@/core/application/features/command/queries/ListCommandsQuery";
import { UserError } from "@/core/domain/shared/errors/UserError";

export function createCommandListCommand(): Command {
  return new Command("ls")
    .description("List all commands in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      const configRootPath = targetPath
        ? resolve(targetPath)
        : resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
      const commandsPath = resolve(configRootPath, "commands");

      try {
        await access(commandsPath, constants.R_OK);
      } catch {
        console.error(`✗ commands/ directory not found at ${commandsPath}. Run 'agent-ctrl init' first.`);
        process.exit(1);
      }

      const listCommandsQuery = new ListCommandsQuery();
      const result = await listCommandsQuery.execute({ commandsPath });

      if (!result.success) {
        if (result.error instanceof UserError) {
          console.error(`✗ ${result.error.message}`);
          process.exit(result.error.exitCode);
        }
        console.error(`✗ Unexpected error: ${result.error}`);
        process.exit(2);
      }

      const { artifacts, warnings } = result.data;

      if (options.json) {
        console.log(JSON.stringify({ artifacts, warnings }, null, 2));
        return;
      }

      if (artifacts.length === 0) {
        console.log("No commands found in commands/ directory");
      } else {
        console.log(`Commands (${artifacts.length}):`);
        for (const artifact of artifacts) {
          console.log(`  ${artifact.id}`);
        }
      }

      if (warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of warnings) {
          console.log(`  - ${warning}`);
        }
      }
    });
}
