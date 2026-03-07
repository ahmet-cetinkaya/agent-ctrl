import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListCommandsQuery } from "@/core/application/features/command/queries/ListCommandsQuery";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

export function createCommandListCommand(): Command {
  return new Command("ls")
    .description("List all commands in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      // Validate user-provided path
      if (targetPath) {
        const pathError = validateUserPath(targetPath, "--path");
        if (pathError) {
          console.error(`✗ ${pathError}`);
          process.exit(1);
        }
      }

      const configRootPath = targetPath
        ? resolve(targetPath)
        : resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
      const commandsPath = resolve(configRootPath, "commands");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(commandsPath, "commands/");
      if (!accessResult.success) {
        console.error(`✗ ${accessResult.error}`);
        process.exit(1);
      }

      const listCommandsQuery = new ListCommandsQuery();
      const result = await listCommandsQuery.execute({ commandsPath });

      handleQueryResult(result);

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
