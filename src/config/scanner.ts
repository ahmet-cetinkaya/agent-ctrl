import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { resolve } from "node:path";
import { validatePlatformName } from "./validator.js";
import { validateDirectory, DEFAULT_SECURITY_CONFIG } from "@/core/filestore/security-service.js";
import type { PlatformSettingsDirectory } from "@/core/domain/shared/types/PlatformSettingsDirectory";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export interface SettingsDiscoveryResult {
  platforms: SupportedApplyPlatform[];
  settingsDirectories: Record<SupportedApplyPlatform, PlatformSettingsDirectory>;
  hasSettingsDirectory: boolean;
  /** All validation problems (naming + security), for backward-compatible display. */
  validationErrors: string[];
  /** Subset of validationErrors that are security-relevant (path traversal, symlink escape, etc). */
  securityErrors: string[];
  /** True if any platform directory's file count may be incomplete due to an unreadable subdirectory. */
  hasIncompleteFileCounts: boolean;
}

export async function discoverPlatformSettings(projectPath: string): Promise<SettingsDiscoveryResult> {
  // settings/ lives inside the agent-ctrl configuration directory, alongside
  // rules/, skills/, agents/, commands/ (see ApplySourceLoader.load).
  const settingsPath = resolve(projectPath, ".agent-ctrl", "settings");
  const result: SettingsDiscoveryResult = {
    platforms: [],
    settingsDirectories: {} as Record<SupportedApplyPlatform, PlatformSettingsDirectory>,
    hasSettingsDirectory: false,
    validationErrors: [],
    securityErrors: [],
    hasIncompleteFileCounts: false,
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
      const securityCheck = validateDirectory(platformDirPath, {
        ...DEFAULT_SECURITY_CONFIG,
        projectRoot: projectPath,
        // Settings directories are copied verbatim into platform config dirs;
        // an external symlink here must block discovery, not just warn (FR-009).
        failOnExternalSymlinks: true,
      });

      if (!securityCheck.isValid) {
        const message = `Security check failed for ${entry.name}: ${securityCheck.error}`;
        result.validationErrors.push(message);
        result.securityErrors.push(message);
        continue;
      }

      const platform = validation.normalizedPlatform!;
      const countResult = await countFiles(platformDirPath);
      if (countResult.incomplete) {
        result.hasIncompleteFileCounts = true;
        result.validationErrors.push(
          `Could not fully scan '${entry.name}': some subdirectories were unreadable, file count may be incomplete`
        );
      }

      result.platforms.push(platform);
      result.settingsDirectories[platform] = {
        platformName: platform,
        path: platformDirPath,
        exists: true,
        fileCount: countResult.count,
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

interface FileCountResult {
  count: number;
  /** True if a subdirectory could not be read, meaning count is a lower bound, not exact. */
  incomplete: boolean;
}

async function countFiles(dirPath: string): Promise<FileCountResult> {
  let count = 0;
  let incomplete = false;
  let entries: Dirent[];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return { count, incomplete: true };
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nested = await countFiles(resolve(dirPath, entry.name));
      count += nested.count;
      incomplete = incomplete || nested.incomplete;
    } else {
      count++;
    }
  }
  return { count, incomplete };
}
