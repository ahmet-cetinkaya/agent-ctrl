import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePlatformName } from "./validator.js";
import { validateDirectory } from "@/core/filestore/security-service.js";
import type { PlatformSettingsDirectory } from "@/core/domain/shared/types/PlatformSettingsDirectory";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { SecurityValidationResult } from "@/core/domain/shared/types/SecurityValidationResult";

export interface SettingsDiscoveryResult {
	platforms: SupportedApplyPlatform[];
	settingsDirectories: Record<SupportedApplyPlatform, PlatformSettingsDirectory>;
	hasSettingsDirectory: boolean;
	validationErrors: string[];
}

export async function discoverPlatformSettings(projectPath: string): Promise<SettingsDiscoveryResult> {
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
			const securityCheck = validateDirectory(platformDirPath, { projectRoot: projectPath });

			if (!securityCheck.isValid) {
				result.validationErrors.push(
					`Security check failed for ${entry.name}: ${securityCheck.error}`
				);
				continue;
			}

			const platform = validation.normalizedPlatform!;
			const fileCount = await countFiles(platformDirPath);

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

async function countFiles(dirPath: string): Promise<number> {
	let count = 0;
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				count += await countFiles(resolve(dirPath, entry.name));
			} else {
				count++;
			}
		}
	} catch {
		// Directory read failed - return current count
	}
	return count;
}
