import { Command } from "commander";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function createApplyCommand(): Command {
  return new Command("apply")
    .description("Apply project artifacts to a target platform configuration")
    .argument("<platform>", 'Target platform. Supported platforms: "claude"')
    .option("-d, --dry-run", "Show changes without applying", false)
    .option("-o, --override", "Clean existing managed artifacts before applying", false)
    .action(async (platform: string, options: { dryRun?: boolean; override?: boolean }) => {
      const applyCommand = new ApplyCommand();

      try {
        const result = await applyCommand.execute({
          projectPath: resolve(process.cwd()),
          platform,
          dryRun: options.dryRun,
          override: options.override,
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

        const {
          rulesApplied,
          skillsApplied,
          agentsApplied,
          mcpServersLoaded,
          mcpFilesDiscovered,
          mcpFilesFailed,
          mcpFilesSkipped,
          configPath,
          warnings,
        } = result.data;
        const claudeMcpPath = resolve(process.env.AGENT_CTRL_CLAUDE_HOME || homedir(), ".claude.json");

        if (options.dryRun) {
          console.log(`[Dry run] Would apply ${rulesApplied} rules to Claude Code`);
          console.log(`[Dry run] Would apply ${skillsApplied} skills to Claude Code`);
          console.log(`[Dry run] Would apply ${agentsApplied} agents to Claude Code`);
          console.log(
            `[Dry run] MCP servers loaded: ${mcpServersLoaded} (files discovered: ${mcpFilesDiscovered}, failed entries: ${mcpFilesFailed}, skipped files: ${mcpFilesSkipped})`
          );
          console.log(`\nWould write to: ${configPath}`);
          console.log(`[Dry run] Would write Claude MCP configuration to: ${claudeMcpPath}`);
        } else {
          if (rulesApplied > 0) console.log(`✓ Applied ${rulesApplied} rules to Claude Code`);
          if (skillsApplied > 0) console.log(`✓ Applied ${skillsApplied} skills to Claude Code`);
          if (agentsApplied > 0) console.log(`✓ Applied ${agentsApplied} agents to Claude Code`);
          console.log(
            `✓ MCP servers loaded: ${mcpServersLoaded} (files discovered: ${mcpFilesDiscovered}, failed entries: ${mcpFilesFailed}, skipped files: ${mcpFilesSkipped})`
          );
          console.log(`\nConfiguration written to: ${configPath}`);
          console.log(`MCP configuration written to: ${claudeMcpPath}`);
        }

        if (warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of warnings) {
            console.log(`  - ${warning}`);
          }
        }
      } catch (error) {
        console.error(`✗ Unexpected error: ${error}`);
        process.exit(2);
      }
    });
}
