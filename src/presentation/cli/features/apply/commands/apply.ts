import { Command } from "commander";
import { ApplyCommand } from "../../../../core/application/features/commands/ApplyCommand";
import { UserError } from "../../../../core/domain/shared/shared/errors/UserError";
import { SystemError } from "../../../../core/domain/shared/shared/errors/SystemError";
import { resolve } from "node:path";

export function createApplyCommand(): Command {
  return new Command("apply")
    .description("Apply project artifacts to a target platform configuration")
    .argument("<platform>", 'Target platform (e.g., "claude")')
    .option("-d, --dry-run", "Show changes without applying", false)
    .option("-f, --force", "Overwrite existing configuration", false)
    .action(
      async (
        platform: string,
        options: { dryRun?: boolean; force?: boolean },
      ) => {
        const applyCommand = new ApplyCommand();

        try {
          const result = await applyCommand.execute({
            projectPath: resolve(process.cwd()),
            platform,
            dryRun: options.dryRun,
            force: options.force,
          });

          if (!result.success) {
            if (result.error instanceof UserError) {
              console.error(`✗ ${result.error.message}`);
              process.exit(result.error.exitCode);
            } else if (result.error instanceof SystemError) {
              console.error(`✗ ${result.error.message}`);
              process.exit(result.error.exitCode);
            } else {
              console.error(`✗ Unexpected error: ${result.error}`);
              process.exit(2);
            }
          }

          const { rulesApplied, skillsApplied, agentsApplied, configPath } =
            result.data;

          if (options.dryRun) {
            console.log(
              `[Dry run] Would apply ${rulesApplied} rules to Claude Code`,
            );
            console.log(
              `[Dry run] Would apply ${skillsApplied} skills to Claude Code`,
            );
            console.log(
              `[Dry run] Would apply ${agentsApplied} agents to Claude Code`,
            );
            console.log(`\nWould write to: ${configPath}`);
          } else {
            if (rulesApplied > 0)
              console.log(`✓ Applied ${rulesApplied} rules to Claude Code`);
            if (skillsApplied > 0)
              console.log(`✓ Applied ${skillsApplied} skills to Claude Code`);
            if (agentsApplied > 0)
              console.log(`✓ Applied ${agentsApplied} agents to Claude Code`);
            console.log(`\nConfiguration written to: ${configPath}`);
          }
        } catch (error) {
          console.error(`✗ Unexpected error: ${error}`);
          process.exit(2);
        }
      },
    );
}
