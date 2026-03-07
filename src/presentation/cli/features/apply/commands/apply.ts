import { Command } from "commander";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { getSupportedApplyPlatformsDisplay } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { validateUserPath } from "@/presentation/cli/shared/handlers/resultHandler";

/**
 * Creates the 'apply' CLI command for managing appy platform integration.
 *
 * The apply command supports:
 * - Multiple AI platforms (opencode, gemini, cursor, windsurf, codex, qwen, kilo, antigravity)
 * - Project-scoped and user-scoped configuration
 * - Dry-run mode for previewing changes
 * - Override mode for replacing conflicting configurations
 * - Custom user configuration root path
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # Apply to user configuration (default)
 * agent-ctrl apply cursor
 *
 * # Apply to project configuration
 * agent-ctrl apply cursor --project
 *
 * # Preview changes without writing
 * agent-ctl apply cursor --dry-run
 *
 * # Override existing configuration
 * agent-ctrl apply cursor --override
 *
 * # Use custom config root
 * agent-ctrl apply cursor --path /custom/path
 * ```
 */
export function createApplyCommand(): Command {
  const supportedPlatformsDisplay = getSupportedApplyPlatformsDisplay();

  return new Command("apply")
    .description("Apply managed appy integration to one selected platform")
    .argument("<platform>", `Target platform. Supported platforms: ${supportedPlatformsDisplay}`)
    .option("-d, --dry-run", "Show selected-platform changes without writing files", false)
    .option("-o, --override", "Replace conflicting appy configuration with managed state", false)
    .option(
      "-p, --project",
      "Apply to project-based configuration in the current folder (default is global user configuration)",
      false
    )
    .option(
      "--path <path>",
      "Custom agent-ctrl configuration root path used for global user configuration (default: ~/.agent-ctrl)"
    )
    .action(
      async (platform: string, options: { dryRun?: boolean; override?: boolean; project?: boolean; path?: string }) => {
        // Validate user-provided path for security
        if (options.path) {
          const pathError = validateUserPath(options.path, "--path");
          if (pathError) {
            console.error(`✗ ${pathError}`);
            process.exit(1);
          }
        }

        const applyCommand = new ApplyCommand();
        const userConfigRootPath = options.path ? resolve(options.path) : resolve(homedir(), ".agent-ctrl");
        const targetScope = options.project ? "project" : "user";

        try {
          const result = await applyCommand.execute({
            projectPath: resolve(process.cwd()),
            platform,
            dryRun: options.dryRun,
            override: options.override,
            targetScope,
            userConfigRootPath,
          });

          if (!result.success) {
            if (result.error instanceof UserError || result.error instanceof SystemError) {
              console.error(`✗ ${result.error.message}`);
              process.exit(result.error.exitCode);
            }
            console.error(`✗ Unexpected error: ${result.error}`);
            process.exit(2);
          }

          const { platform: selectedPlatform, status, configPath, scope, surface, warnings, durationMs } = result.data;

          if (options.dryRun) {
            console.log(`[Dry run] Selected platform: ${selectedPlatform}`);
            console.log(`[Dry run] Result: ${status}`);
            console.log(`[Dry run] Scope: ${scope}`);
            console.log(`[Dry run] Surface: ${surface}`);
            console.log(`[Dry run] User configuration root: ${userConfigRootPath}`);
            console.log(`[Dry run] Target path: ${configPath}`);
            console.log(`[Dry run] Estimated duration: ${durationMs}ms`);
          } else {
            if (status === "unchanged") {
              console.log(`✓ ${selectedPlatform}: unchanged`);
            } else {
              console.log(`✓ ${selectedPlatform}: success`);
            }
            console.log(`Scope: ${scope}`);
            console.log(`Surface: ${surface}`);
            if (scope === "user") {
              console.log(`User configuration root: ${userConfigRootPath}`);
            }
            console.log(`Configuration path: ${configPath}`);
            console.log(`Duration: ${durationMs}ms`);
          }

          if (warnings.length > 0) {
            console.log("\nWarnings:");
            for (const warning of warnings) {
              console.log(`  - ${warning}`);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`✗ Unexpected error applying to '${platform}': ${errorMessage}`);
          // TODO: Add Sentry logging when available
          // logError("Apply command unexpected error", {
          //   error,
          //   platform,
          //   projectPath: resolve(process.cwd()),
          //   targetScope,
          //   userConfigRootPath,
          //   errorId: ERROR_IDS.CLI_EXECUTION_FAILED,
          // });
          process.exit(2);
        }
      }
    );
}
