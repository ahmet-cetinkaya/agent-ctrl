import { Command } from "commander";
import { ListAgentsQuery } from "../../../../core/application/features/queries/ListAgentsQuery";
import { UserError } from "../../../../core/domain/shared/shared/errors/UserError";
import { resolve } from "node:path";
import { access, constants } from "node:fs/promises";

export function createAgentListCommand(): Command {
  return new Command("ls")
    .description("List all agents in the project")
    .option("-j, --json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const agentsPath = resolve(process.cwd(), "agents");

      try {
        await access(agentsPath, constants.R_OK);
      } catch {
        console.error("✗ agents/ directory not found. Run 'agent-ctrl init' first.");
        process.exit(1);
      }

      const listAgentsQuery = new ListAgentsQuery();
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
