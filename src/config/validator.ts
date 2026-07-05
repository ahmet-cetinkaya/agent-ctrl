import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { PlatformValidationResult } from "@/core/domain/shared/types/PlatformValidationResult";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export function validatePlatformName(directoryName: string): PlatformValidationResult {
	const hasLeadingWhitespace = /^\s/.test(directoryName);
	const hasTrailingWhitespace = /\s$/.test(directoryName);
	const normalized = directoryName.toLowerCase().trim();

	if (!normalized) {
		return {
			directoryName,
			isValid: false,
			normalizedPlatform: null,
			validationErrors: ["Platform name cannot be empty or whitespace only"],
		};
	}

	if (hasLeadingWhitespace || hasTrailingWhitespace) {
		return {
			directoryName,
			isValid: false,
			normalizedPlatform: null,
			validationErrors: ["Platform name cannot have leading or trailing whitespace"],
		};
	}

	if (!/^[a-z0-9]+$/.test(normalized)) {
		return {
			directoryName,
			isValid: false,
			normalizedPlatform: null,
			validationErrors: [
				`Platform '${directoryName}' contains invalid characters. Only alphanumeric characters are supported.`,
			],
		};
	}

	if (SUPPORTED_APPLY_PLATFORMS.includes(normalized as SupportedApplyPlatform)) {
		return {
			directoryName,
			isValid: true,
			normalizedPlatform: normalized as SupportedApplyPlatform,
			validationErrors: [],
		};
	}

	return {
		directoryName,
		isValid: false,
		normalizedPlatform: null,
		validationErrors: [`Platform '${directoryName}' is not supported. Valid platforms: ${SUPPORTED_APPLY_PLATFORMS.join(", ")}`],
	};
}
