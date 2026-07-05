import type { SupportedApplyPlatform } from "./SupportedApplyPlatform";

/**
 * Result of platform directory name validation.
 *
 * Purpose: Encapsulates the outcome of validating a directory name against
 * the list of supported platforms, providing canonical form and error messages.
 */
export interface PlatformValidationResult {
  /** The directory name being validated (as found in filesystem) */
  directoryName: string;

  /** Whether the name is a valid platform identifier (case-insensitive match) */
  isValid: boolean;

  /** Canonical platform name (case-normalized) or null if invalid */
  normalizedPlatform: SupportedApplyPlatform | null;

  /** Validation error messages (empty if valid) */
  validationErrors: string[];
}

/**
 * Validation rules for platform directory names:
 *
 * 1. Case-insensitive matching against supported platforms
 * 2. Must be exact match (no partial matches)
 * 3. Empty strings are rejected
 * 4. Special characters are rejected (only alphanumeric and hyphens allowed)
 *
 * @see {@link SupportedApplyPlatform} for list of valid platform names
 */
