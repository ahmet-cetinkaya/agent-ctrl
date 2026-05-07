import { Command, Option } from "commander";
import { resolve } from "node:path";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import {
  SUPPORTED_APPLY_PLATFORMS,
  getSupportedApplyPlatformsDisplay,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { validateUserPath } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import { getLegacyGlobalOptions } from "@/presentation/cli/shared/utils/globalOptions";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

type ApplyOptions = {
  dryRun?: boolean;
  override?: boolean;
  project?: boolean;
  user?: boolean;
  path?: string;
  prompt?: boolean;
  verbose?: boolean;
};

/**
 * Creates the 'apply' CLI command for syncing native platform configuration.
 *
 * The apply command supports:
 * - Multiple AI platforms (opencode, gemini, cursor, windsurf, codex, qwen, kilo, antigravity)
 * - Project-scoped and user-scoped configuration
 * - Dry-run mode for previewing changes
 * - Override mode for replacing conflicting configurations
 * - Custom platform user-configuration root path
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # Apply to global/user configuration
 * agent-ctrl apply codex
 *
 * # Apply to project configuration instead of the default global target
 * agent-ctrl apply cursor --project
 *
 * # Preview changes without writing
 * agent-ctl apply cursor --dry-run
 *
 * # Override existing configuration
 * agent-ctrl apply cursor --override
 *
 * # Use custom user config root
 * agent-ctrl apply codex --path /custom/path
 * ```
 */
export function createApplyCommand(): Command {
  const supportedPlatformsDisplay = getSupportedApplyPlatformsDisplay();

  return new Command("apply")
    .description("Sync .agent-ctrl artifacts into one selected platform's native configuration")
    .argument("[platform]", `Target platform. Supported platforms: ${supportedPlatformsDisplay}`)
    .option("-d, --dry-run", "Show selected-platform changes without writing files", false)
    .option("-o, --override", "Replace conflicting managed configuration with agent-ctrl state", false)
    .option("-v, --verbose", "Show detailed output including warnings", false)
    .addOption(
      new Option("-p, --project", "Apply to project-based configuration instead of the default global user scope")
        .default(false)
        .conflicts("user")
        .conflicts("path")
    )
    .option(
      "-u, --user",
      "Apply to global user configuration when the platform documents a file-backed user scope",
      false
    )
    .option("--path <path>", "Custom platform user configuration root path")
    .option("--no-prompt", "Skip confirmation prompt", false)
    .action(async (platform: string | undefined, options: ApplyOptions) => {
      if (!platform) {
        const selected = await PromptService.selectMany({
          message: "Select platforms to apply:",
          options: SUPPORTED_APPLY_PLATFORMS.map((p) => ({ value: p, label: p })),
          required: false,
        });

        if (selected === null || typeof selected === "symbol") {
          PromptService.cancel();
          process.exit(0);
        }

        if (!selected || (selected as string[]).length === 0) {
          LogService.info("No platform selected");
          return;
        }

        const platforms = selected as string[];
        for (let i = 0; i < platforms.length; i++) {
          await applyToPlatform(platforms[i], options);
        }
        LogService.info(`Applied to ${platforms.length} platform(s)`);
        return;
      }

      await applyToPlatform(platform, options);
    });
}

async function applyToPlatform(platform: string, options: ApplyOptions): Promise<void> {
  if (options.path) {
    const pathError = validateUserPath(options.path, "--path");
    if (pathError) {
      PromptService.cancel(pathError);
      process.exit(1);
    }
  }

  const globalConfigRoot = resolveConfigRoot();
  const isGlobalConfig = !options.path;
  const sourcePath = isGlobalConfig ? resolve(globalConfigRoot, "..") : resolve(options.path!);

  const applyCommand = new ApplyCommand();
  const userConfigRootPath = options.path ? resolve(options.path) : undefined;
  const targetScope = options.project ? "project" : options.user ? "user" : undefined;
  const usePrompt = options.prompt !== false;

  if (usePrompt) {
    LogService.intro(`Applying to ${platform}`);

    const confirmed = await PromptService.confirm({
      message: `Apply configuration to ${platform}?`,
      initial: true,
    });

    if (confirmed === false || confirmed === null) {
      PromptService.cancel("Apply cancelled by user");
      return;
    }

    if (typeof confirmed === "symbol") {
      PromptService.cancel();
      process.exit(0);
    }
  }

  try {
    if (usePrompt) {
      PromptService.startTask("Syncing configuration");
    }

    const result = await applyCommand.execute({
      projectPath: sourcePath,
      platform,
      dryRun: options.dryRun,
      override: options.override,
      targetScope,
      userConfigRootPath,
    });

    if (!result.success) {
      if (result.error instanceof UserError || result.error instanceof SystemError) {
        LogService.error(result.error.message);
        process.exit(result.error.exitCode);
      }
      LogService.error(`Unexpected error: ${result.error}`);
      process.exit(2);
    }

    const verbose = options.verbose ?? getLegacyGlobalOptions().verbose;
    const {
      platform: selectedPlatform,
      status,
      configPath,
      scope,
      surface,
      fileChanges,
      warnings,
      durationMs,
    } = result.data;

    if (options.dryRun) {
      if (usePrompt) {
        PromptService.stopTask("Dry run complete");
      }
      LogService.info(`Selected platform: ${selectedPlatform}`);
      LogService.info(`Result: ${status}`);
      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);
      LogService.info(`Target path: ${configPath}`);
      if (scope === "user" && userConfigRootPath) {
        LogService.info(`User configuration root: ${userConfigRootPath}`);
      }
      if (fileChanges.length > 0) {
        LogService.note(fileChanges.join("\n"), "Files:");
      }
      LogService.info(`Estimated duration: ${durationMs}ms`);
    } else {
      if (status === "unchanged") {
        LogService.info(`${selectedPlatform}: unchanged`);
      } else {
        LogService.info(`${selectedPlatform}: success`);
      }
      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);
      if (scope === "user" && userConfigRootPath) {
        LogService.info(`User configuration root: ${userConfigRootPath}`);
      }
      LogService.info(`Configuration path: ${configPath}`);
      if (fileChanges.length > 0) {
        LogService.note(fileChanges.join("\n"), "Files:");
      }
      LogService.info(`Duration: ${durationMs}ms`);
      if (usePrompt) {
        LogService.outro(`Applied to ${selectedPlatform}`);
      }
    }

    const criticalWarnings = warnings.filter((w) => w.includes("does not have a documented apply target for"));
    const noiseWarnings = warnings.filter((w) => !w.includes("does not have a documented apply target for"));

    if (criticalWarnings.length > 0) {
      LogService.note(criticalWarnings.join("\n"), "Warnings:");
    }

    if (verbose && noiseWarnings.length > 0) {
      const filteredNoiseWarnings = noiseWarnings.filter(
        (w) => !w.includes("Skipped .gitkeep") && !w.includes("invalid extension")
      );
      if (filteredNoiseWarnings.length > 0) {
        if (criticalWarnings.length === 0) {
          LogService.note(filteredNoiseWarnings.join("\n"), "Warnings:");
        }
      }
    }
  } catch (error) {
    PromptService.stopTask();
    const errorMessage = error instanceof Error ? error.message : String(error);
    PromptService.cancel(`Error: ${errorMessage}`);
    process.exit(2);
  }
}
