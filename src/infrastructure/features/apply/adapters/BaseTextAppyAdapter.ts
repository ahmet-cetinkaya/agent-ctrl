import { dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { AppyMergePolicy } from "@/infrastructure/features/apply/adapters/AppyMergePolicy";
import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

/**
 * Base adapter for text-based appy platform configuration.
 * Handles common file I/O operations with proper error handling.
 * Provides shared scope resolver to eliminate duplication across platform adapters.
 */
export abstract class BaseTextAppyAdapter implements IAppyPlatformAdapter {
  abstract readonly platformName: SupportedApplyPlatform;

  /**
   * Shared scope resolver instance for all platform adapters.
   * This eliminates duplication and ensures consistent scope resolution behavior.
   */
  protected readonly scopeResolver = new CommandScopePrecedenceResolver();

  constructor() {}

  abstract resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget>;

  protected abstract buildDesiredContent(target: AppyConfigTarget): string;

  /**
   * Applies appy integration to the target platform configuration.
   *
   * This method:
   * 1. Resolves the target configuration path
   * 2. Builds the desired content for the platform
   * 3. Reads existing content (if any) with proper error handling
   * 4. Merges using AppyMergePolicy
   * 5. Writes to disk (unless dry-run) with comprehensive error handling
   *
   * @throws {SystemError} If file I/O fails due to permissions, disk space, or other system errors
   */
  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const desiredContent = this.buildDesiredContent(target);

    // Read existing content with proper error handling
    let existingContent: string | null = null;
    try {
      existingContent = await readFile(target.configPath, "utf-8");
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      // File doesn't exist is OK - we'll create it
      if (nodeErr.code !== "ENOENT") {
        throw new SystemError(
          `Failed to read existing ${this.platformName} config at ${target.configPath}: ${nodeErr.message}`,
          ERROR_IDS.FILE_READ_FAILED
        );
      }
    }

    const merged = AppyMergePolicy.mergeText(existingContent, desiredContent, Boolean(request.override));

    if (!request.dryRun && merged.status === "success") {
      try {
        await mkdir(dirname(target.configPath), { recursive: true });
        await writeFile(target.configPath, `${merged.content.trimEnd()}\n`, "utf-8");
      } catch (error) {
        const nodeErr = error as NodeJS.ErrnoException;
        let message = `Failed to write ${this.platformName} config to ${target.configPath}`;

        if (nodeErr.code === "EACCES") {
          message += ": Permission denied. Check file/directory permissions.";
        } else if (nodeErr.code === "ENOSPC") {
          message += ": No space left on device.";
        } else if (nodeErr.code === "EROFS") {
          message += ": Filesystem is read-only.";
        } else {
          message += `: ${nodeErr.message}`;
        }

        throw new SystemError(message, ERROR_IDS.FILE_WRITE_FAILED);
      }
    }

    return {
      platform: this.platformName,
      status: merged.status,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      message:
        merged.status === "unchanged"
          ? "Selected platform already contains the required appy integration."
          : "Applied appy integration for selected platform.",
    };
  }
}
