import path from "node:path";
import type {
  SecurityValidationResult,
  SecurityContext,
  SecurityValidationType,
} from "../domain/shared/types/SecurityValidationResult.js";
import { validatePathTraversal } from "./validators.js";
import { detectSymlink, findSymlinksInDirectory, filterExternalSymlinks } from "./symlink-handler.js";

/**
 * Security validation service for platform-specific settings operations.
 *
 * Purpose: Centralize all security validations for file operations,
 * providing comprehensive safety checks before executing file copies.
 *
 * Security requirements (FR-009): System MUST immediately fail with error
 * when path traversal violations are detected in platform-specific settings.
 */

/**
 * Configuration for security validation operations.
 */
export interface SecurityValidationConfig {
  /** Root directory that all operations must stay within */
  projectRoot: string;

  /** Whether to allow symbolic links (with warnings for external targets) */
  allowSymbolicLinks: boolean;

  /** Whether to fail on external symbolic links */
  failOnExternalSymlinks: boolean;
}

/**
 * Default security configuration (strict mode).
 */
export const DEFAULT_SECURITY_CONFIG: SecurityValidationConfig = {
  projectRoot: process.cwd(),
  allowSymbolicLinks: true,
  failOnExternalSymlinks: false, // Warning mode by default
};

/**
 * Validates a single file path for security compliance.
 *
 * @param filePath - Path to validate
 * @param config - Security validation configuration
 * @returns Security validation result
 *
 * @example
 * ```ts
 * const result = validateFilePath('/project/settings/claude/config.json', config);
 * // { isValid: true, error: null, warnings: [], validationContext: {...} }
 * ```
 */
export function validateFilePath(
  filePath: string,
  config: SecurityValidationConfig = DEFAULT_SECURITY_CONFIG
): SecurityValidationResult {
  const timestamp = new Date().toISOString();

  // Check path traversal
  const pathValidation = validatePathTraversal(filePath, config.projectRoot);
  if (!pathValidation.isValid) {
    return {
      isValid: false,
      error: pathValidation.error,
      warnings: [],
      validationContext: {
        originalPath: filePath,
        resolvedPath: pathValidation.resolvedPath,
        hasSymbolicLinks: false,
        validationType: "path_traversal",
        validatedAt: timestamp,
      },
    };
  }

  // Check symbolic links
  const symlinkResult = detectSymlink(filePath, config.projectRoot);
  const warnings: string[] = [];

  if (symlinkResult.isSymlink) {
    if (symlinkResult.targetEscapesProject && symlinkResult.warning) {
      warnings.push(symlinkResult.warning);

      if (config.failOnExternalSymlinks) {
        return {
          isValid: false,
          error: `External symbolic link detected: ${filePath} → ${symlinkResult.targetPath}`,
          warnings,
          validationContext: {
            originalPath: filePath,
            resolvedPath: symlinkResult.targetPath || filePath,
            hasSymbolicLinks: true,
            validationType: "symbolic_link",
            validatedAt: timestamp,
          },
        };
      }
    }
  }

  return {
    isValid: true,
    error: null,
    warnings,
    validationContext: {
      originalPath: filePath,
      resolvedPath: pathValidation.resolvedPath,
      hasSymbolicLinks: symlinkResult.isSymlink,
      validationType: "boundary_check",
      validatedAt: timestamp,
    },
  };
}

/**
 * Validates multiple file paths for security compliance.
 *
 * @param filePaths - Paths to validate
 * @param config - Security validation configuration
 * @returns Array of security validation results
 *
 * @example
 * ```ts
 * const results = validateMultiplePaths(
 *   ['/project/settings/claude/config.json', '/project/settings/cursor/rules.json'],
 *   config
 * );
 * ```
 */
export function validateMultiplePaths(
  filePaths: string[],
  config: SecurityValidationConfig = DEFAULT_SECURITY_CONFIG
): SecurityValidationResult[] {
  return filePaths.map((path) => validateFilePath(path, config));
}

/**
 * Validates a directory recursively for security compliance.
 *
 * @param directoryPath - Directory path to validate
 * @param config - Security validation configuration
 * @returns Security validation result with aggregated warnings
 *
 * @example
 * ```ts
 * const result = validateDirectory('/project/settings/claude', config);
 * // { isValid: true, error: null, warnings: ['...'], validationContext: {...} }
 * ```
 */
export function validateDirectory(
  directoryPath: string,
  config: SecurityValidationConfig = DEFAULT_SECURITY_CONFIG
): SecurityValidationResult {
  const timestamp = new Date().toISOString();

  // Validate directory path itself
  const pathValidation = validatePathTraversal(directoryPath, config.projectRoot);
  if (!pathValidation.isValid) {
    return {
      isValid: false,
      error: pathValidation.error,
      warnings: [],
      validationContext: {
        originalPath: directoryPath,
        resolvedPath: pathValidation.resolvedPath,
        hasSymbolicLinks: false,
        validationType: "path_traversal",
        validatedAt: timestamp,
      },
    };
  }

  // Scan for symbolic links recursively
  const symlinks = findSymlinksInDirectory(directoryPath, config.projectRoot);
  const externalSymlinks = filterExternalSymlinks(symlinks);
  const warnings = externalSymlinks.map((s) => s.warning || "External symbolic link detected");

  // Check if we should fail on external symlinks
  if (externalSymlinks.length > 0 && config.failOnExternalSymlinks) {
    return {
      isValid: false,
      error: `Found ${externalSymlinks.length} external symbolic link(s)`,
      warnings,
      validationContext: {
        originalPath: directoryPath,
        resolvedPath: pathValidation.resolvedPath,
        hasSymbolicLinks: symlinks.length > 0,
        validationType: "symbolic_link",
        validatedAt: timestamp,
      },
    };
  }

  return {
    isValid: true,
    error: null,
    warnings,
    validationContext: {
      originalPath: directoryPath,
      resolvedPath: pathValidation.resolvedPath,
      hasSymbolicLinks: symlinks.length > 0,
      validationType: "boundary_check",
      validatedAt: timestamp,
    },
  };
}

/**
 * Combines multiple security validation results into one aggregated result.
 *
 * @param results - Array of security validation results
 * @returns Aggregated validation result
 *
 * @example
 * ```ts
 * const combined = combineValidationResults([
 *   { isValid: true, error: null, warnings: ['Warning 1'], ... },
 *   { isValid: false, error: 'Critical error', warnings: ['Warning 2'], ... }
 * ]);
 * // { isValid: false, error: 'Critical error', warnings: ['Warning 1', 'Warning 2'], ... }
 * ```
 */
export function combineValidationResults(results: SecurityValidationResult[]): SecurityValidationResult {
  const timestamp = new Date().toISOString();

  // If any result is invalid, the combined result is invalid
  const firstInvalid = results.find((r) => !r.isValid);
  const isValid = !firstInvalid;

  // Collect all errors (only if invalid) and warnings
  const error = firstInvalid?.error || null;
  const warnings = results.flatMap((r) => r.warnings);

  // Combine validation context
  const validationContext: SecurityContext = {
    originalPath: results.map((r) => r.validationContext.originalPath).join(", "),
    resolvedPath: results.map((r) => r.validationContext.resolvedPath).join(", "),
    hasSymbolicLinks: results.some((r) => r.validationContext.hasSymbolicLinks),
    validationType: "boundary_check",
    validatedAt: timestamp,
  };

  return {
    isValid,
    error,
    warnings,
    validationContext,
  };
}
