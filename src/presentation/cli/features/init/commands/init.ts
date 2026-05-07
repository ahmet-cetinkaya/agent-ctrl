import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { InitCommand } from "@/core/application/features/init/commands/InitCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";
import { validateUserPath } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";

export function createInitCommand(): Command {
  const command = new Command("init")
    .description("Initialize the agent-ctrl global configuration structure")
    .argument("[path]", "Target configuration root path (default: ~/.agent-ctrl)")
    .option("-o, --override", "Initialize even when the target directory already contains files", false)
    .option("-d, --dry-run", "Preview what would be created without creating it", false)
    .action(async (targetPath: string | undefined, options: { override?: boolean; dryRun?: boolean }) => {
      LogService.intro("Initializing agent-ctrl");

      if (targetPath) {
        const pathError = validateUserPath(targetPath, "[path]");
        if (pathError) {
          PromptService.cancel(pathError);
          process.exit(1);
        }
      }

      const initCommand = new InitCommand(new NodeFileSystem());
      const resolvedTargetPath = targetPath ? resolve(targetPath) : resolve(homedir(), ".agent-ctrl");

      try {
        if (options.dryRun) {
          LogService.log(`Would create at: ${resolvedTargetPath}`);
          LogService.log("Directories: rules/, skills/, agents/, commands/, mcps/");
          LogService.log(
            "Files: rules/.gitkeep, skills/.gitkeep, agents/.gitkeep, commands/.gitkeep, mcps/.gitkeep, README.md"
          );
          LogService.outro("No changes made");
          return;
        }

        PromptService.startTask("Creating configuration structure");
        const result = await initCommand.execute({
          targetPath: resolvedTargetPath,
          override: options.override,
        });

        if (result.success) {
          PromptService.stopTask("Configuration created");
          for (const dir of result.data.createdDirectories) {
            LogService.log(`Created ${dir}/`);
          }
          for (const file of result.data.createdFiles) {
            LogService.log(`Created ${file}`);
          }
          LogService.log("");
          LogService.log(`Configuration root: ${resolvedTargetPath}`);
          LogService.log("");
          LogService.log("Next steps:");
          LogService.log("1. Add your files in the related folders: rules, skills, agents, commands and mcps.");
          LogService.log("   - You can add from remote registries:");
          LogService.log("        agent-ctrl skill add skillsmp:code-review");
          LogService.log("        agent-ctrl mcp add smithery:github");
          LogService.log("        (Add credentials to .agent-ctrl/.env if you plan to use SkillsMP or Smithery.)");
          LogService.log("2. Inspect your configuration:");
          LogService.log("     agent-ctrl rule ls");
          LogService.log("     agent-ctrl skill ls");
          LogService.log("     agent-ctrl agent ls");
          LogService.log("     agent-ctrl command ls");
          LogService.log("     agent-ctrl mcp ls");
          LogService.log("3. Apply the platforms:");
          LogService.log("     agent-ctrl apply claude");
          LogService.outro("Configuration initialized!");
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
  PromptService.stopTask();
  if (error instanceof UserError) {
    LogService.error(error.message);
    process.exit(error.exitCode);
  } else if (error instanceof SystemError) {
    LogService.error(error.message);
    process.exit(error.exitCode);
  } else if (error instanceof Error) {
    LogService.error(`Unexpected error: ${error.message}`);
    process.exit(2);
  } else {
    LogService.error("Unknown error occurred");
    process.exit(2);
  }
}
