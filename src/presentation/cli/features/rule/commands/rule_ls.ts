import { Command } from "commander";
import { ListRulesQuery } from "../../../../core/application/features/queries/ListRulesQuery";
import { UserError } from "../../../../core/domain/shared/shared/errors/UserError";
import { resolve } from "node:path";
import { access, constants } from "node:fs/promises";

export function createRuleListCommand(): Command {
  return new Command("ls")
    .description("List all rules in the project")
    .option("-j, --json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const rulesPath = resolve(process.cwd(), "rules");

      try {
        await access(rulesPath, constants.R_OK);
      } catch {
        console.error(
          "✗ rules/ directory not found. Run 'agent-ctrl init' first.",
        );
        process.exit(1);
      }

      const listRulesQuery = new ListRulesQuery();
      const result = await listRulesQuery.execute({ rulesPath });

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
