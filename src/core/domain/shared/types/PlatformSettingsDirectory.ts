import type { SupportedApplyPlatform } from "./SupportedApplyPlatform";

/**
 * Represents a platform-specific settings directory in the project configuration.
 *
 * Purpose: Encapsulates the metadata and state of a platform-specific settings directory
 * that contains configuration artifacts to be copied to the target platform's config directory.
 *
 * @see {@link ../platform-paths.md} for platform config destination resolution
 */
export interface PlatformSettingsDirectory {
  /** Canonical platform identifier (e.g., "claude", "cursor", "gemini") */
  platformName: SupportedApplyPlatform;

  /** Absolute path to the platform settings directory (e.g., /project/settings/claude) */
  path: string;

  /** Whether the directory exists on the filesystem */
  exists: boolean;

  /** Number of files/directories in the settings (for discoverability feedback) */
  fileCount: number;
}

/**
 * Validation state for a platform settings directory.
 *
 * State transitions:
 * ```
 * [discovered] → [validated] → [processed] → [applied]
 *      ↓            ↓            ↓            ↓
 *   (scan)      (security)   (copy)      (success/error)
 * ```
 */
export type PlatformSettingsState =
  | "discovered" // Directory found during scan
  | "validated" // Platform name and security checks passed
  | "processed" // File operations completed
  | "applied" // Settings successfully copied to platform config
  | "failed"; // Error occurred during processing
