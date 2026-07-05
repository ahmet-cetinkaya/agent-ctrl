import { resolve, dirname } from "node:path";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import {
  getSupportedApplyPlatformsDisplay,
  parseSupportedApplyPlatform,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { discoverPlatformSettings } from "@/config/scanner.js";
import { copyPlatformSettings } from "@/core/filestore/copiers.js";

export interface ApplyCommandOptions {
  projectPath: string;
  platform: string;
  dryRun?: boolean;
  override?: boolean;
  targetScope?: ApplyPlatformScope;
  userConfigRootPath?: string;
}

export interface ApplyCommandResult {
  platform: string;
  status: ApplyPlatformStatus;
  configPath: string;
  scope: "project" | "user";
  surface: string;
  message: string;
  artifactCounts?: {
    rules?: number;
    commands?: number;
    skills?: number;
    agents?: number;
    mcpServers?: number;
  };
  durationMs: number;
  fileChanges: string[];
  warnings: string[];
  settingsDiscovery?: {
    discoveredPlatforms: string[];
    appliedPlatform: string | null;
    filesCopied: number;
  };
}

export class ApplyCommand {
  private readonly adapterRegistry: PlatformAdapterRegistry;

  constructor(adapterRegistry?: PlatformAdapterRegistry) {
    this.adapterRegistry = adapterRegistry ?? new PlatformAdapterRegistry();
  }

  async execute(options: ApplyCommandOptions): Promise<Result<ApplyCommandResult, Error>> {
    const { projectPath, platform, dryRun, override, targetScope, userConfigRootPath } = options;

    const selectedPlatform = parseSupportedApplyPlatform(platform);
    if (!selectedPlatform) {
      return err(
        new UserError(
          `Platform '${platform}' is not supported. Supported platforms: ${getSupportedApplyPlatformsDisplay()}. Check for typos or run 'agent-ctrl apply --help' for more information.`,
          ERROR_IDS.CLI_INVALID_ARGUMENT
        )
      );
    }

    const adapter = this.adapterRegistry.resolve(selectedPlatform);
    const startedAt = Date.now();

    const settingsResult = await discoverPlatformSettings(projectPath);
    const settingsWarning = settingsResult.validationErrors.length > 0
      ? [`Settings validation: ${settingsResult.validationErrors.join("; ")}`]
      : [];

    try {
      const applyResult = await adapter.applyApplyIntegration({
        projectPath,
        dryRun,
        override,
        targetScope,
        userConfigRootPath,
      });

      const durationMs = Date.now() - startedAt;
      const warnings: string[] = [...settingsWarning, ...(applyResult.warnings ?? [])];
      if (dryRun) {
        warnings.push("Dry run mode: no file system changes were written.");
      }

      let appliedPlatform: string | null = null;
      let settingsFilesCopied = 0;
      if (!dryRun && settingsResult.platforms.includes(selectedPlatform)) {
        const platformSettingsDir = settingsResult.settingsDirectories[selectedPlatform];
        if (platformSettingsDir?.path) {
          const target = await adapter.resolveTarget(projectPath, { projectPath, dryRun, override, targetScope, userConfigRootPath });
          const targetConfigDir = dirname(target.configPath);
          const copyResult = copyPlatformSettings(platformSettingsDir.path, targetConfigDir);
          if (copyResult.success) {
            appliedPlatform = selectedPlatform;
            settingsFilesCopied = copyResult.filesCopied;
            warnings.push(`Applied ${copyResult.filesCopied} platform-specific setting(s) for '${selectedPlatform}'`);
          } else if (copyResult.error) {
            warnings.push(`Platform settings copy failed: ${copyResult.error}`);
          }
        }
      }

      return ok({
        platform: applyResult.platform,
        status: applyResult.status,
        configPath: applyResult.configPath,
        scope: applyResult.scope,
        surface: applyResult.surface,
        message: applyResult.message,
        artifactCounts: applyResult.artifactCounts,
        durationMs,
        fileChanges: [...(applyResult.fileChanges ?? [])],
        warnings,
        settingsDiscovery: {
          discoveredPlatforms: settingsResult.platforms,
          appliedPlatform,
          filesCopied: settingsFilesCopied,
        },
      });
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = `Failed to apply '${selectedPlatform}' platform configuration`;

      if (nodeErr.code === "EACCES") {
        message += ": Permission denied writing platform configuration. Check file/directory permissions.";
      } else if (nodeErr.code === "ENOSPC") {
        message += ": No space left on device. Free up disk space and try again.";
      } else if (nodeErr.code === "EROFS") {
        message += ": Filesystem is read-only. Cannot write configuration.";
      } else if (error instanceof Error) {
        message += `: ${error.message}`;
      } else {
        message += `: ${String(error)}`;
      }

      return err(new SystemError(message, ERROR_IDS.PLATFORM_CONFIG_WRITE_FAILED));
    }
  }
}
