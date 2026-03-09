import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListCommandsQuery } from "@/core/application/features/command/queries/ListCommandsQuery";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

/**
 * Creates the 'command ls' CLI subcommand for listing all commands in the project.
 *
 * The command ls subcommand lists all command artifacts found in the commands/ directory.
 * Supports both project-scoped and global user configuration via the AGENT_CTRL_HOME
 * environment variable or --path option.
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # List commands in default location
 * agent-ctrl command ls
 *
 * # List commands in JSON format
 * agent-ctrl command ls --json
 *
 * # List commands from custom config root
 * agent-ctrl command ls /custom/path
 * ```
 */
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
      if (!result.success) {
        return;
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
