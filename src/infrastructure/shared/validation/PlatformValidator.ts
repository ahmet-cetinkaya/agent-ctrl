import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { PlatformValidationResult } from "@/core/domain/shared/types/PlatformValidationResult";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export class PlatformValidator {
  validate(directoryName: string): PlatformValidationResult {
    const normalized = directoryName.toLowerCase().trim();

    if (!normalized) {
      return {
        directoryName,
        isValid: false,
        normalizedPlatform: null,
        validationErrors: ["Platform name cannot be empty"],
      };
    }

    const isValidPlatform = SUPPORTED_APPLY_PLATFORMS.includes(
      normalized as SupportedApplyPlatform
    );

    if (!isValidPlatform) {
      return {
        directoryName,
        isValid: false,
        normalizedPlatform: null,
        validationErrors: [
          `Platform '${directoryName}' is not supported. Valid platforms: ${SUPPORTED_APPLY_PLATFORMS.join(", ")}`,
        ],
      };
    }

    return {
      directoryName,
      isValid: true,
      normalizedPlatform: normalized as SupportedApplyPlatform,
      validationErrors: [],
    };
  }
}
