import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { InitCommand } from "@/core/application/features/init/commands/InitCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";
import { validateUserPath } from "@/presentation/cli/shared/handlers/resultHandler";

export function createInitCommand(): Command {
  const command = new Command("init")
    .description("Initialize the agent-ctrl global configuration structure")
    .argument("[path]", "Target configuration root path (default: ~/.agent-ctrl)")
    .action(async (targetPath?: string) => {
      // Validate user-provided path for security
      if (targetPath) {
        const pathError = validateUserPath(targetPath, "[path]");
        if (pathError) {
          console.error(`✗ ${pathError}`);
          process.exit(1);
        }
      }

      const initCommand = new InitCommand(new NodeFileSystem());
      const resolvedTargetPath = targetPath ? resolve(targetPath) : resolve(homedir(), ".agent-ctrl");

      try {
        const result = await initCommand.execute({
          targetPath: resolvedTargetPath,
        });

        if (result.success) {
          // Success messages (T029)
          for (const dir of result.data.createdDirectories) {
            console.log(`✓ Created ${dir}/`);
          }
          for (const file of result.data.createdFiles) {
            console.log(`✓ Created ${file}`);
          }
          console.log(`\nConfiguration root: ${resolvedTargetPath}`);
          console.log("Configuration initialized successfully! Add artifacts to your directories, then run:");
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
