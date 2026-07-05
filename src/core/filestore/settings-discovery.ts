import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { validatePlatformName } from "@/config/validator";
import { validatePathSecurity } from "./security-service";
import type { PlatformSettingsDirectory } from "@/core/domain/shared/types/PlatformSettingsDirectory";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { SecurityValidationResult } from "@/core/domain/shared/types/SecurityValidationResult";

export interface SettingsDiscoveryResult {
  platforms: SupportedApplyPlatform[];
  settingsDirectories: Record<SupportedApplyPlatform, PlatformSettingsDirectory>;
  hasSettingsDirectory: boolean;
  validationErrors: string[];
}

export class SettingsDiscovery {
  async discover(projectPath: string): Promise<SettingsDiscoveryResult> {
    const settingsPath = resolve(projectPath, "settings");
    const result: SettingsDiscoveryResult = {
      platforms: [],
      settingsDirectories: {} as Record<SupportedApplyPlatform, PlatformSettingsDirectory>,
      hasSettingsDirectory: false,
      validationErrors: [],
    };

    try {
      const entries = await readdir(settingsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const validation = validatePlatformName(entry.name);
        if (!validation.isValid) {
          result.validationErrors.push(...validation.validationErrors);
          continue;
        }

        const platformDirPath = resolve(settingsPath, entry.name);
        const securityCheck = await validatePathSecurity(platformDirPath);

        if (!securityCheck.isValid) {
          result.validationErrors.push(
            `Security check failed for ${entry.name}: ${securityCheck.error}`
          );
          continue;
        }

        const platform = validation.normalizedPlatform!;
        const fileCount = await this.countFiles(platformDirPath);

        result.platforms.push(platform);
        result.settingsDirectories[platform] = {
          platformName: platform,
          path: platformDirPath,
          exists: true,
          fileCount,
        };
        result.hasSettingsDirectory = true;
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        result.validationErrors.push(`Failed to scan settings directory: ${nodeError.message}`);
      }
    }

    return result;
  }

  private async countFiles(dirPath: string): Promise<number> {
    let count = 0;
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += await this.countFiles(resolve(dirPath, entry.name));
        } else {
          count++;
        }
      }
    } catch {
      // Directory read failed - return current count
    }
    return count;
  }
}
