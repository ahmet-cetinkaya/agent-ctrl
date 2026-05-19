import { directoryExists } from "@/core/domain/shared/utils/fsUtils";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import {
  getSupportedApplyPlatformsDisplay,
  parseSupportedApplyPlatform,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { resolve } from "node:path";

export interface ApplyProfileCommandOptions {
  projectPath: string;
  profileName: string;
  platform: string;
  dryRun?: boolean;
  override?: boolean;
  targetScope?: ApplyPlatformScope;
  userConfigRootPath?: string;
  configRoot?: string;
}

export interface ApplyProfileCommandResult {
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
  isEmpty: boolean;
}

export class ApplyProfileCommand {
  private readonly adapterRegistry: PlatformAdapterRegistry;
  private readonly sourceLoader: ApplySourceLoader;

  constructor(adapterRegistry?: PlatformAdapterRegistry, sourceLoader?: ApplySourceLoader) {
    this.adapterRegistry = adapterRegistry ?? new PlatformAdapterRegistry();
    this.sourceLoader = sourceLoader ?? new ApplySourceLoader();
  }

  async execute(options: ApplyProfileCommandOptions): Promise<Result<ApplyProfileCommandResult, Error>> {
    const {
      projectPath,
      profileName,
      platform,
      dryRun,
      override,
      targetScope,
      userConfigRootPath,
      configRoot: providedConfigRoot,
    } = options;

    const selectedPlatform = parseSupportedApplyPlatform(platform);
    if (!selectedPlatform) {
      return err(
        new UserError(
          `Platform '${platform}' is not supported. Supported platforms: ${getSupportedApplyPlatformsDisplay()}. Check for typos or run 'agent-ctrl apply --help' for more information.`,
          ERROR_IDS.CLI_INVALID_ARGUMENT
        )
      );
    }

    const configRoot = providedConfigRoot ?? resolve(projectPath, ".agent-ctrl");
    const profilePath = resolve(configRoot, "profiles", profileName);

    if (!(await directoryExists(configRoot))) {
      return err(
        new UserError(
          `No .agent-ctrl directory found at ${configRoot}. Initialize the project first.`,
          ERROR_IDS.NO_SUCH_FILE_OR_DIRECTORY
        )
      );
    }

    if (!(await directoryExists(profilePath))) {
      return err(
        new ProfileError(
          `Profile '${profileName}' not found in .agent-ctrl/profiles/`,
          profileName,
          ERROR_IDS.PROFILE_NOT_FOUND
        )
      );
    }

    const adapter = this.adapterRegistry.resolve(selectedPlatform);
    const startedAt = Date.now();

    try {
      const profileSnapshot = await this.sourceLoader.loadProfile(profilePath);

      const applyResult = await adapter.applyApplyIntegration({
        projectPath,
        dryRun,
        override,
        targetScope,
        userConfigRootPath,
        mergedSnapshot: {
          rules: profileSnapshot.rules,
          skills: profileSnapshot.skills,
          agents: profileSnapshot.agents,
          commands: profileSnapshot.commands,
          mcpServers: profileSnapshot.mcpServers,
          warnings: profileSnapshot.warnings,
        },
      });

      const durationMs = Date.now() - startedAt;
      const warnings: string[] = [...(applyResult.warnings ?? [])];
      if (dryRun) {
        warnings.push("Dry run mode: no file system changes are written.");
      }

      const isEmpty =
        profileSnapshot.rules.length === 0 &&
        profileSnapshot.skills.length === 0 &&
        profileSnapshot.agents.length === 0 &&
        profileSnapshot.commands.length === 0 &&
        profileSnapshot.mcpServers.length === 0;

      return ok({
        platform: applyResult.platform,
        status: applyResult.status,
        configPath: applyResult.configPath,
        scope: applyResult.scope,
        surface: applyResult.surface,
        message: applyResult.message,
        artifactCounts: applyResult.artifactCounts ?? {
          rules: profileSnapshot.rules.length,
          skills: profileSnapshot.skills.length,
          agents: profileSnapshot.agents.length,
          commands: profileSnapshot.commands.length,
          mcpServers: profileSnapshot.mcpServers.length,
        },
        durationMs,
        fileChanges: [...(applyResult.fileChanges ?? [])],
        warnings,
        isEmpty,
      });
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = `Failed to apply profile '${profileName}' to '${selectedPlatform}' platform`;

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
