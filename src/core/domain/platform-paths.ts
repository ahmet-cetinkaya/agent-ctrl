import type { SupportedApplyPlatform } from "./shared/types/SupportedApplyPlatform.js";

/**
 * Platform configuration path resolution.
 *
 * Purpose: Resolve the destination configuration directory for each supported platform,
 * taking into account environment variable overrides and XDG Base Directory specification.
 *
 * @see {@link ../../../../specs/006-platform-specific-settings/platform-paths.md} for verified paths
 */

/**
 * Platform configuration path resolution result.
 */
export interface PlatformConfigPath {
  /** Platform identifier */
  platform: SupportedApplyPlatform;

  /** Resolved absolute path to platform's configuration directory */
  resolvedPath: string;

  /** How the path was resolved (priority order) */
  resolvedVia: "env_var" | "xdg" | "default";

  /** Environment variable used for resolution (null if not used) */
  envVarUsed: string | null;

  /** Whether global config copy is supported (cursor global rules live in SQLite) */
  supportsGlobalCopy: boolean;
}

/**
 * Resolves the configuration directory path for a given platform.
 *
 * Resolution priority:
 * 1. Platform-specific environment variable (if set)
 * 2. XDG Base Directory (for kilo, opencode only)
 * 3. Default home directory path
 *
 * @param platform - Platform identifier
 * @returns Platform configuration path resolution result
 *
 * @example
 * ```ts
 * const claudePath = resolvePlatformConfigPath('claude');
 * // { platform: 'claude', resolvedPath: '/home/user/.claude', resolvedVia: 'default', envVarUsed: null, supportsGlobalCopy: true }
 * ```
 */
export function resolvePlatformConfigPath(platform: SupportedApplyPlatform): PlatformConfigPath {
  const home = process.env.HOME || process.env.USERPROFILE || "";

  switch (platform) {
    case "claude": {
      const envVar = process.env.CLAUDE_CONFIG_DIR;
      if (envVar) {
        return {
          platform: "claude",
          resolvedPath: envVar,
          resolvedVia: "env_var",
          envVarUsed: "CLAUDE_CONFIG_DIR",
          supportsGlobalCopy: true,
        };
      }
      return {
        platform: "claude",
        resolvedPath: `${home}/.claude`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "codex": {
      const envVar = process.env.CODEX_HOME;
      if (envVar) {
        return {
          platform: "codex",
          resolvedPath: envVar,
          resolvedVia: "env_var",
          envVarUsed: "CODEX_HOME",
          supportsGlobalCopy: true,
        };
      }
      return {
        platform: "codex",
        resolvedPath: `${home}/.codex`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "gemini": {
      const envVar = process.env.GEMINI_CONFIG_DIR;
      if (envVar) {
        return {
          platform: "gemini",
          resolvedPath: envVar,
          resolvedVia: "env_var",
          envVarUsed: "GEMINI_CONFIG_DIR",
          supportsGlobalCopy: true,
        };
      }
      return {
        platform: "gemini",
        resolvedPath: `${home}/.gemini`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "antigravity": {
      // Antigravity shares Gemini's config root, isolated under antigravity/ subdirectory
      // Inherits GEMINI_CONFIG_DIR if set, otherwise uses default ~/.gemini
      const geminiEnvVar = process.env.GEMINI_CONFIG_DIR;
      const geminiRoot = geminiEnvVar || `${home}/.gemini`;

      return {
        platform: "antigravity",
        resolvedPath: `${geminiRoot}/antigravity`,
        resolvedVia: geminiEnvVar ? "env_var" : "default",
        envVarUsed: geminiEnvVar ? "GEMINI_CONFIG_DIR" : null,
        supportsGlobalCopy: true,
      };
    }

    case "opencode": {
      const envVar = process.env.OPENCODE_CONFIG_DIR;
      if (envVar) {
        return {
          platform: "opencode",
          resolvedPath: envVar,
          resolvedVia: "env_var",
          envVarUsed: "OPENCODE_CONFIG_DIR",
          supportsGlobalCopy: true,
        };
      }

      // Check XDG Base Directory
      const xdgConfig = process.env.XDG_CONFIG_HOME;
      if (xdgConfig) {
        return {
          platform: "opencode",
          resolvedPath: `${xdgConfig}/opencode`,
          resolvedVia: "xdg",
          envVarUsed: null,
          supportsGlobalCopy: true,
        };
      }

      return {
        platform: "opencode",
        resolvedPath: `${home}/.config/opencode`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "kilo": {
      // Check XDG Base Directory
      const xdgConfig = process.env.XDG_CONFIG_HOME;
      if (xdgConfig) {
        return {
          platform: "kilo",
          resolvedPath: `${xdgConfig}/kilo`,
          resolvedVia: "xdg",
          envVarUsed: null,
          supportsGlobalCopy: true,
        };
      }

      return {
        platform: "kilo",
        resolvedPath: `${home}/.config/kilo`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "qwen": {
      return {
        platform: "qwen",
        resolvedPath: `${home}/.qwen`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "windsurf": {
      return {
        platform: "windsurf",
        resolvedPath: `${home}/.codeium`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "forgecode": {
      const envVar = process.env.FORGE_CONFIG;
      if (envVar) {
        return {
          platform: "forgecode",
          resolvedPath: envVar,
          resolvedVia: "env_var",
          envVarUsed: "FORGE_CONFIG",
          supportsGlobalCopy: true,
        };
      }
      return {
        platform: "forgecode",
        resolvedPath: `${home}/forge`,
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: true,
      };
    }

    case "cursor": {
      // Cursor global rules live in SQLite DB, not filesystem
      // Only project-local .cursor/ directories are supported
      return {
        platform: "cursor",
        resolvedPath: ".cursor", // Project-local only
        resolvedVia: "default",
        envVarUsed: null,
        supportsGlobalCopy: false, // Global copy NOT supported
      };
    }

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Resolves configuration paths for multiple platforms.
 *
 * @param platforms - Array of platform identifiers
 * @returns Array of platform configuration path resolutions
 *
 * @example
 * ```ts
 * const paths = resolveMultiplePlatformPaths(['claude', 'gemini', 'cursor']);
 * // Returns array of 3 PlatformConfigPath objects
 * ```
 */
export function resolveMultiplePlatformPaths(platforms: SupportedApplyPlatform[]): PlatformConfigPath[] {
  return platforms.map((platform) => resolvePlatformConfigPath(platform));
}

/**
 * Gets the list of platforms that support global configuration copy.
 *
 * @returns Array of platform identifiers that support global copy
 */
export function getGlobalCopySupportedPlatforms(): SupportedApplyPlatform[] {
  const allPlatforms: SupportedApplyPlatform[] = [
    "antigravity",
    "claude",
    "codex",
    "cursor",
    "forgecode",
    "gemini",
    "kilo",
    "opencode",
    "qwen",
    "windsurf",
  ];

  const globalCopySupported = allPlatforms.filter((platform) => {
    const resolution = resolvePlatformConfigPath(platform);
    return resolution.supportsGlobalCopy;
  });

  return globalCopySupported;
}
