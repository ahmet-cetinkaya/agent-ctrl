import { Command, Option } from "commander";
import { resolve } from "node:path";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import {
  SUPPORTED_APPLY_PLATFORMS,
  SupportedApplyPlatform,
  getSupportedApplyPlatformsDisplay,
  getPlatformDisplayName,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { validateUserPath } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import { getLegacyGlobalOptions } from "@/presentation/cli/shared/utils/globalOptions";

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

  const applyCommand = new Command("apply").description(
    "Sync .agent-ctrl artifacts into one selected platform's native configuration"
  );

  applyCommand
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
    .action(async (platform: string | undefined, options: any) => {
      if (options.verbose) {
        process.env.DEBUG = "true";
      }

      if (!platform) {
        const selected = await PromptService.selectMany<SupportedApplyPlatform>({
          message: "Select platforms to apply configuration to",
          options: SUPPORTED_APPLY_PLATFORMS.map((p) => ({ value: p, label: getPlatformDisplayName(p) })),
          required: true,
        });

        if (selected === null || typeof selected === "symbol") {
          PromptService.handleCancellation();
        }

        const platforms = selected as SupportedApplyPlatform[];
        for (let i = 0; i < platforms.length; i++) {
          await applyToPlatform(platforms[i], options);
        }
        LogService.info(`Applied to ${platforms.length} platform(s)`);
        return;
      }

      await applyToPlatform(platform, options);
    });

  return applyCommand;
}

function displayArtifactCounts(counts: {
  rules?: number;
  commands?: number;
  skills?: number;
  agents?: number;
  mcpServers?: number;
}): void {
  const items: string[] = [];
  if (counts.rules !== undefined) items.push(`${counts.rules} rules`);
  if (counts.commands !== undefined) items.push(`${counts.commands} commands`);
  if (counts.skills !== undefined) items.push(`${counts.skills} skills`);
  if (counts.agents !== undefined) items.push(`${counts.agents} agents`);
  if (counts.mcpServers !== undefined) items.push(`${counts.mcpServers} MCP servers`);

  if (items.length > 0) {
    LogService.note(items.join(", "), "Artifacts:");
  }
}

async function applyToPlatform(platform: string, options: any): Promise<void> {
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

  const platformDisplay = getPlatformDisplayName(platform);
  if (usePrompt) {
    LogService.intro(`Applying to ${platformDisplay}`);

    const confirmed = await PromptService.confirm({
      message: `Apply configuration to ${platformDisplay}?`,
      initial: true,
    });

    if (confirmed === false || confirmed === null) {
      PromptService.handleCancellation("Apply cancelled by user");
    }

    if (typeof confirmed === "symbol") {
      PromptService.handleCancellation();
    }
  }

  try {
    const result = await PromptService.withCancellation(async () => {
      if (usePrompt) {
        PromptService.startTask("Syncing configuration");
      }

      return await applyCommand.execute({
        projectPath: sourcePath,
        platform: platform,
        dryRun: options.dryRun,
        override: options.override,
        targetScope,
        userConfigRootPath,
      });
    });

    if (!result) {
      return;
    }

    if (!result.success) {
      const platformDisplay = getPlatformDisplayName(platform);
      if (result.error instanceof UserError || result.error instanceof SystemError) {
        LogService.error(`[${platformDisplay}] ${result.error.message} (Path: ${sourcePath})`);
        process.exit(result.error.exitCode);
      }
      LogService.error(`[${platformDisplay}] Unexpected error: ${result.error} (Path: ${sourcePath})`);
      process.exit(2);
    }

    const verbose = options.verbose ?? getLegacyGlobalOptions().verbose;
    const {
      platform: selectedPlatform,
      status,
      configPath,
      scope,
      surface,
      artifactCounts,
      fileChanges,
      warnings,
      durationMs,
      settingsDiscovery,
    } = result.data;

    if (options.dryRun) {
      if (usePrompt) PromptService.stopTask("Dry run complete");

      LogService.info(`Selected platform: ${selectedPlatform}`);
      LogService.info(`Result: ${status}`);
      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);
      LogService.info(`Target path: ${configPath}`);
      if (scope === "user" && userConfigRootPath) LogService.info(`User configuration root: ${userConfigRootPath}`);
      if (artifactCounts) displayArtifactCounts(artifactCounts);
      if (verbose && fileChanges.length > 0) LogService.note(fileChanges.join("\n"), "Files:");
      LogService.info(`Estimated duration: ${durationMs}ms`);
    } else {
      if (status === "unchanged") LogService.info(`${selectedPlatform}: unchanged`);
      else LogService.info(`${selectedPlatform}: success`);

      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);
      if (scope === "user" && userConfigRootPath) LogService.info(`User configuration root: ${userConfigRootPath}`);

      LogService.info(`Configuration path: ${configPath}`);
      if (artifactCounts) displayArtifactCounts(artifactCounts);
      if (verbose && fileChanges.length > 0) LogService.note(fileChanges.join("\n"), "Files:");

      LogService.info(`Duration: ${durationMs}ms`);
      if (usePrompt) LogService.outro(`Applied to ${selectedPlatform}`);
    }

    if (verbose && settingsDiscovery) {
      const lines = [
        `Discovered platforms: ${settingsDiscovery.discoveredPlatforms.length > 0 ? settingsDiscovery.discoveredPlatforms.join(", ") : "none"}`,
      ];
      if (settingsDiscovery.appliedPlatform) {
        lines.push(
          `Applied settings for: ${settingsDiscovery.appliedPlatform} (${settingsDiscovery.filesCopied} file(s))`
        );
      }
      LogService.note(lines.join("\n"), "Settings discovery:");
    }

    if (warnings.length > 0) {
      LogService.note(warnings.join("\n"), "Warnings:");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LogService.error(`[${platformDisplay}] Unexpected error: ${errorMessage} (Path: ${sourcePath})`);
    process.exit(2);
  }
}
