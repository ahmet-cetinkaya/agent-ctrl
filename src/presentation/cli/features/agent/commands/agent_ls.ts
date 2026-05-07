import { Command } from "commander";
import { ListAgentsQuery } from "@/core/application/features/agent/queries/ListAgentsQuery";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";

export function createAgentListCommand(): Command {
  return new Command("ls")
    .description("List all agents in the project")
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
      const agentsPath = resolve(configRootPath, "agents");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(agentsPath, "agents/");
      if (!accessResult.success) {
        LogService.error(accessResult.error ?? "Directory access failed");
        process.exit(1);
      }

      const listAgentsQuery = new ListAgentsQuery(new AgentScanner());
      const result = await listAgentsQuery.execute({ agentsPath });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }

      const { artifacts, warnings } = result.data;

      if (options.json) {
        LogService.unstyled(JSON.stringify({ artifacts, warnings }, null, 2));
        return;
      }

      LogService.intro("Listing agents");

      if (artifacts.length === 0) {
        LogService.info("No agents found in agents/ directory");
      } else {
        const list = artifacts.map((a) => a.id).join("\n");
        LogService.note(list, `Agents (${artifacts.length}):`);
      }

      if (warnings.length > 0 && !options.json) {
        LogService.note(warnings.join("\n"), "Warnings:");
      }
    });
}
