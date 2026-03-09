import { Command } from "commander";
import { ListRulesQuery } from "@/core/application/features/rule/queries/ListRulesQuery";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

export function createRuleListCommand(): Command {
  return new Command("ls")
    .description("List all rules in the project")
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
      const rulesPath = resolve(configRootPath, "rules");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(rulesPath, "rules/");
      if (!accessResult.success) {
        console.error(`✗ ${accessResult.error}`);
        process.exit(1);
      }

      const listRulesQuery = new ListRulesQuery();
      const result = await listRulesQuery.execute({ rulesPath });

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
        console.log("No rules found in rules/ directory");
      } else {
        console.log(`Rules (${artifacts.length}):`);
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
