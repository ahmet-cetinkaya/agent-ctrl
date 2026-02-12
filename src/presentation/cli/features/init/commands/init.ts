import { Command } from "commander";
import { resolve } from "node:path";
import { InitCommand } from "../../../../core/application/features/commands/InitCommand";
import { UserError } from "../../../../core/domain/shared/shared/errors/UserError";
import { SystemError } from "../../../../core/domain/shared/shared/errors/SystemError";

export function createInitCommand(): Command {
  const command = new Command("init")
    .description("Initialize a new agent-ctrl project with standard directory structure")
    .argument("[path]", "Target directory path (default: current directory)", ".")
    .action(async (targetPath: string) => {
      const initCommand = new InitCommand();

      try {
        const result = await initCommand.execute({
          targetPath: resolve(targetPath),
        });

        if (result.success) {
          // Success messages (T029)
          for (const dir of result.data.createdDirectories) {
            console.log(`✓ Created ${dir}/`);
          }
          for (const file of result.data.createdFiles) {
            console.log(`✓ Created ${file}`);
          }
          console.log("\nProject initialized successfully! Add artifacts to your directories, then run:");
          console.log("  agent-ctrl rule ls");
          console.log("  agent-ctrl skill ls");
          console.log("  agent-ctrl agent ls");
        } else {
          // Error handling (T031, T032)
          handleInitError(result.error);
        }
      } catch (error) {
        handleInitError(error);
      }
    });

  return command;
}

function handleInitError(error: unknown): never {
  if (error instanceof UserError) {
    console.error(`✗ ${error.message}`);
    process.exit(error.exitCode);
  } else if (error instanceof SystemError) {
    console.error(`✗ ${error.message}`);
    process.exit(error.exitCode);
  } else if (error instanceof Error) {
    console.error(`✗ Unexpected error: ${error.message}`);
    process.exit(2);
  } else {
    console.error("✗ Unknown error occurred");
    process.exit(2);
  }
}
