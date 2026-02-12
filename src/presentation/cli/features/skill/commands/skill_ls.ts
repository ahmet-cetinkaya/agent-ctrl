import { Command } from "commander";
import { ListSkillsQuery } from "../../../../core/application/features/queries/ListSkillsQuery";
import { UserError } from "../../../../core/domain/shared/shared/errors/UserError";
import { resolve } from "node:path";
import { access, constants } from "node:fs/promises";

export function createSkillListCommand(): Command {
  return new Command("ls")
    .description("List all skills in the project")
    .option("-j, --json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const skillsPath = resolve(process.cwd(), "skills");

      try {
        await access(skillsPath, constants.R_OK);
      } catch {
        console.error("✗ skills/ directory not found. Run 'agent-ctrl init' first.");
        process.exit(1);
      }

      const listSkillsQuery = new ListSkillsQuery();
      const result = await listSkillsQuery.execute({ skillsPath });

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
