import { Command } from "commander";
import { ListAgentsQuery } from "@/core/application/features/agent/queries/ListAgentsQuery";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { access, constants } from "node:fs/promises";

export function createAgentListCommand(): Command {
  return new Command("ls")
    .description("List all agents in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      const configRootPath = targetPath
        ? resolve(targetPath)
        : resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
      const agentsPath = resolve(configRootPath, "agents");

      try {
        await access(agentsPath, constants.R_OK);
      } catch {
        console.error(`✗ agents/ directory not found at ${agentsPath}. Run 'agent-ctrl init' first.`);
        process.exit(1);
      }

      const listAgentsQuery = new ListAgentsQuery(new AgentScanner());
      const result = await listAgentsQuery.execute({ agentsPath });

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
