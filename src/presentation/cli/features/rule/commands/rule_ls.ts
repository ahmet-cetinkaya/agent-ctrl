import { Command } from "commander";
import { ListRulesQuery } from "@/core/application/features/rule/queries/ListRulesQuery";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";

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
          LogService.error(pathError);
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
        LogService.error(accessResult.error ?? "Directory access failed");
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
        LogService.raw(JSON.stringify({ artifacts, warnings }, null, 2));
        return;
      }

      LogService.intro("Listing rules");

      if (artifacts.length === 0) {
        LogService.info("No rules found in rules/ directory");
      } else {
        const list = artifacts.map((a) => a.id).join("\n");
        LogService.note(list, `Rules (${artifacts.length}):`);
      }

      if (warnings.length > 0 && !options.json) {
        LogService.note(warnings.join("\n"), "Warnings:");
      }
    });
}
