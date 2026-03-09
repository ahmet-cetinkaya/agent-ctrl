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
          console.error(`✗ ${pathError}`);
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
        console.error(`✗ ${accessResult.error}`);
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
        console.log(JSON.stringify({ artifacts, warnings }, null, 2));
        return;
      }

      if (artifacts.length === 0) {
        console.log("No agents found in agents/ directory");
      } else {
        console.log(`Agents (${artifacts.length}):`);
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
