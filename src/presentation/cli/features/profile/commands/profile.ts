import { Command } from "commander";
import { resolve } from "node:path";
import { ApplyProfileCommand } from "@/core/application/features/apply/commands/ApplyProfileCommand";
import { ProfileListCommand } from "@/core/application/features/apply/commands/ProfileListCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import {
  SUPPORTED_APPLY_PLATFORMS,
  SupportedApplyPlatform,
  getSupportedApplyPlatformsDisplay,
  getPlatformDisplayName,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import { getLegacyGlobalOptions } from "@/presentation/cli/shared/utils/globalOptions";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

function resolveConfigParent(): string {
  return resolve(resolveConfigRoot(), "..");
}

export function createProfileCommand(): Command {
  const supportedPlatformsDisplay = getSupportedApplyPlatformsDisplay();

  const profileCommand = new Command("profile").description("Manage and apply configuration profiles");

  const profileApplyCommand = new Command("apply")
    .description("Apply profile(s) to a target platform")
    .argument("[platform]", `Target platform. Supported platforms: ${supportedPlatformsDisplay}`)
    .argument("[profile_name...]", "Name(s) of the profile(s) under .agent-ctrl/profiles/")
    .option("-d, --dry-run", "Show selected-platform changes without writing files", false)
    .option("-o, --override", "Replace conflicting managed configuration with agent-ctrl state", false)
    .option("-v, --verbose", "Show detailed output including warnings", false)
    .option("--no-prompt", "Skip confirmation prompt", false)
    .action(async (platform: string | undefined, profileNames: string[], options: any) => {
      if (options.verbose) {
        process.env.DEBUG = "true";
      }

      let resolvedProfiles: string[] = profileNames.length > 0 ? profileNames : [];
      let resolvedPlatforms: string[] = platform ? [platform] : [];

      const configRoot = resolveConfigRoot();
      const configParent = resolveConfigParent();

      if (resolvedProfiles.length === 0 || resolvedPlatforms.length === 0) {
        const listCommand = new ProfileListCommand();
        const listResult = await listCommand.execute(configParent);

        if (!listResult.success) {
          LogService.error(listResult.error.message);
          const exitCode = listResult.error instanceof UserError ? listResult.error.exitCode : 1;
          process.exit(exitCode);
        }

        if (listResult.data.profiles.length === 0) {
          LogService.error("No profiles found in .agent-ctrl/profiles/. Create a profile first.");
          process.exit(1);
        }

        if (resolvedProfiles.length === 0) {
          const selected = await PromptService.selectMany<string>({
            message: "Select profiles to apply",
            options: listResult.data.profiles.map((p) => ({ value: p, label: p })),
            required: true,
          });

          if (selected === null || typeof selected === "symbol") {
            PromptService.handleCancellation();
          }

          resolvedProfiles = selected as string[];
        }

        if (resolvedPlatforms.length === 0) {
          const selected = await PromptService.selectMany<SupportedApplyPlatform>({
            message: "Select target platforms",
            options: SUPPORTED_APPLY_PLATFORMS.map((p) => ({ value: p, label: getPlatformDisplayName(p) })),
            required: true,
          });

          if (selected === null || typeof selected === "symbol") {
            PromptService.handleCancellation();
          }

          resolvedPlatforms = selected as string[];
        }
      }

      for (const profile of resolvedProfiles) {
        for (const plat of resolvedPlatforms) {
          await applyProfileToPlatform(profile, plat, options, configRoot, process.cwd());
        }
      }
    });

  const profileListCommand = new Command("list").description("List available profiles").action(async () => {
    const configParent = resolveConfigParent();
    const listCommand = new ProfileListCommand();
    const result = await listCommand.execute(configParent);

    if (!result.success) {
      LogService.error(result.error.message);
      const exitCode = result.error instanceof UserError ? result.error.exitCode : 1;
      process.exit(exitCode);
    }

    if (result.data.profiles.length === 0) {
      LogService.note("No profiles configured.", "Profiles:");
      return;
    }

    LogService.note(result.data.profiles.join("\n"), "Profiles:");
  });

  profileCommand.addCommand(profileApplyCommand);
  profileCommand.addCommand(profileListCommand);

  return profileCommand;
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

async function applyProfileToPlatform(
  profileName: string,
  platform: string,
  options: any,
  configRoot: string,
  projectPath: string
): Promise<void> {
  const applyProfileCommand = new ApplyProfileCommand();
  const targetScope = "project";
  const usePrompt = options.prompt !== false;

  const platformDisplay = getPlatformDisplayName(platform);
  if (usePrompt) {
    LogService.intro(`Applying profile '${profileName}' to ${platformDisplay}`);

    const confirmed = await PromptService.confirm({
      message: `Apply profile '${profileName}' to ${platformDisplay}?`,
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
        PromptService.startTask("Syncing profile configuration");
      }

      return await applyProfileCommand.execute({
        projectPath,
        profileName,
        platform,
        dryRun: options.dryRun,
        override: options.override,
        targetScope,
        configRoot,
      });
    });

    if (!result) {
      return;
    }

    if (!result.success) {
      const platformDisplay = getPlatformDisplayName(platform);
      if (result.error instanceof ProfileError) {
        LogService.error(`[${platformDisplay}] ${result.error.message}`);
        process.exit(1);
      }
      if (result.error instanceof UserError || result.error instanceof SystemError) {
        LogService.error(`[${platformDisplay}] ${result.error.message} (Path: ${configRoot})`);
        process.exit(1);
      }
      LogService.error(`[${platformDisplay}] Unexpected error: ${result.error} (Path: ${configRoot})`);
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
      isEmpty,
    } = result.data;

    if (options.dryRun) {
      if (usePrompt) PromptService.stopTask("Dry run complete");

      LogService.info(`Selected platform: ${selectedPlatform}`);
      LogService.info(`Result: ${status}`);
      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);
      LogService.info(`Target path: ${configPath}`);
      if (artifactCounts) displayArtifactCounts(artifactCounts);
      if (verbose && fileChanges.length > 0) LogService.note(fileChanges.join("\n"), "Files:");
      LogService.info(`Estimated duration: ${durationMs}ms`);
    } else {
      if (status === "unchanged") LogService.info(`${selectedPlatform}: unchanged`);
      else LogService.info(`${selectedPlatform}: success`);

      if (isEmpty) {
        LogService.note(`Profile '${profileName}' contained no artifacts. Base configuration applied.`, "Note:");
      }

      LogService.info(`Scope: ${scope}`);
      LogService.info(`Surface: ${surface}`);

      LogService.info(`Configuration path: ${configPath}`);
      if (artifactCounts) displayArtifactCounts(artifactCounts);
      if (verbose && fileChanges.length > 0) LogService.note(fileChanges.join("\n"), "Files:");

      LogService.info(`Duration: ${durationMs}ms`);
      if (usePrompt) LogService.outro(`Applied profile '${profileName}' to ${selectedPlatform}`);
    }

    const criticalWarnings = warnings.filter((w) => w.includes("does not have a documented apply target for"));
    const noiseWarnings = warnings.filter((w) => !w.includes("does not have a documented apply target for"));

    if (criticalWarnings.length > 0) LogService.note(criticalWarnings.join("\n"), "Warnings:");

    if (verbose && noiseWarnings.length > 0) {
      const filteredNoiseWarnings = noiseWarnings.filter(
        (w) => !w.includes("Skipped .gitkeep") && !w.includes("invalid extension")
      );
      if (filteredNoiseWarnings.length > 0 && criticalWarnings.length === 0)
        LogService.note(filteredNoiseWarnings.join("\n"), "Warnings:");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LogService.error(`Error: ${errorMessage}`);
    process.exit(2);
  }
}
