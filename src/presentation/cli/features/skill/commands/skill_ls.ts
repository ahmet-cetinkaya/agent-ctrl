import { Command } from "commander";
import { ListSkillsQuery } from "@/core/application/features/skill/queries/ListSkillsQuery";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

/**
 * Creates the 'skill ls' CLI subcommand for listing all skills in the project.
 *
 * The skill ls subcommand lists all skill artifacts found in the skills/ directory.
 * Supports both project-scoped and global user configuration via the AGENT_CTRL_HOME
 * environment variable or --path option.
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # List skills in default location
 * agent-ctrl skill ls
 *
 * # List skills in JSON format
 * agent-ctrl skill ls --json
 *
 * # List skills from custom config root
 * agent-ctrl skill ls /custom/path
 * ```
 */
export function createSkillListCommand(): Command {
  return new Command("ls")
    .description("List all skills in the project")
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
      const skillsPath = resolve(configRootPath, "skills");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(skillsPath, "skills/");
      if (!accessResult.success) {
        console.error(`✗ ${accessResult.error}`);
        process.exit(1);
      }

      const listSkillsQuery = new ListSkillsQuery();
      const result = await listSkillsQuery.execute({ skillsPath });

      handleQueryResult(result);

      const { artifacts, warnings } = result.data;

      if (options.json) {
        console.log(JSON.stringify({ artifacts, warnings }, null, 2));
        return;
      }

      if (artifacts.length === 0) {
        console.log("No skills found in skills/ directory");
      } else {
        console.log(`Skills (${artifacts.length}):`);
        for (const artifact of artifacts) {
          console.log(`  ${artifact.id}`);
        }
      }

      if (warnings.length > 0 && !options.json) {
        console.log("\nWarnings:");
        for (const warning of warnings) {
          console.log(`  - ${warning}`);
        }
      }
    });
}
