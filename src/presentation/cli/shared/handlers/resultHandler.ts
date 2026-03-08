/**
 * Shared CLI result handler for consistent error handling across commands.
 *
 * @module resultHandler
 */

import type { Result } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { isAbsolute } from "node:path";
import { homedir } from "node:os";

/**
 * Result of error analysis for query failures.
 *
 * @interface QueryErrorAnalysis
 * @property success - Whether the query succeeded
 * @property exitCode - The exit code that should be used (if failed)
 * @property message - The error message to display (if failed)
 * @property errorId - The error ID for tracking (if failed)
 */
export interface QueryErrorAnalysis {
  success: boolean;
  exitCode?: number;
  message?: string;
  errorId?: string;
}

/**
 * Analyzes a query result and returns error information without side effects.
 *
 * This function is testable and can be used when you need to inspect the error
 * before deciding on an action. For most CLI commands, use {@link handleQueryResult}
 * which handles the process exit automatically.
 *
 * @param result - The Result object to analyze
 * @returns QueryErrorAnalysis with success status and error details if failed
 *
 * @example
 * ```typescript
 * const result = await query.execute(params);
 * const analysis = analyzeQueryResult(result);
 * if (!analysis.success) {
 *   // Custom handling
 *   logError(analysis.message, { errorId: analysis.errorId });
 *   process.exit(analysis.exitCode);
 * }
 * ```
 */
export function analyzeQueryResult(result: Result<unknown, unknown>): QueryErrorAnalysis {
  if (!result.success) {
    if (result.error instanceof UserError) {
      return {
        success: false,
        exitCode: result.error.exitCode,
        message: result.error.message,
        errorId: result.error.errorId,
      };
    }
    // For SystemError or any other error, use the error's errorId if available
    const systemError = result.error instanceof SystemError ? result.error : null;
    return {
      success: false,
      exitCode: 2,
      message: `Unexpected error: ${result.error}`,
      errorId: systemError?.errorId ?? ERROR_IDS.SYSTEM_ERROR,
    };
  }
  return { success: true };
}

/**
 * Handles query result errors with consistent output formatting and process exit.
 *
 * This function is designed for CLI command entry points. It outputs error messages
 * to stderr and exits the process with the appropriate exit code.
 *
 * **Note:** This function calls `process.exit()` and is not suitable for unit testing.
 * Use {@link analyzeQueryResult} for testable error analysis.
 *
 * TODO: Integrate Sentry/error tracking service for production monitoring.
 * When available, call logging service before process.exit() with errorId correlation.
 *
 * @param result - The Result object to evaluate
 * @returns true if the result was successful (does not exit), otherwise exits the process
 *
 * @example
 * ```typescript
 * const result = await query.execute({ commandsPath });
 * if (handleQueryResult(result)) {
 *   // Process successful result
 *   console.log(result.data.artifacts);
 * }
 * // Process exits before here if result was failure
 * ```
 */
export function handleQueryResult(result: Result<unknown, Error>): boolean {
  const analysis = analyzeQueryResult(result);

  if (!analysis.success) {
    console.error(`✗ ${analysis.message}`);
    // TODO: Add Sentry logging when available
    // logError("CLI query failed", { errorId: analysis.errorId, message: analysis.message });
    process.exit(analysis.exitCode!);
  }

  return true;
}

/**
 * Handles directory access verification with detailed, actionable error messages.
 *
 * This function distinguishes between different failure modes and provides
 * user-friendly guidance for resolving each type of issue.
 *
 * @param dirPath - The absolute path to the directory to check
 * @param dirType - A descriptive name for the directory type (e.g., "commands/", "skills/")
 * @returns A result object with success status and optional error message
 *
 * @example
 * ```typescript
 * const accessResult = await handleDirectoryAccess(commandsPath, "commands/");
 * if (!accessResult.success) {
 *   console.error(`✗ ${accessResult.error}`);
 *   process.exit(1);
 * }
 * ```
 */
export async function handleDirectoryAccess(
  dirPath: string,
  dirType: string
): Promise<{ success: boolean; error?: string }> {
  const { access, constants } = await import("node:fs/promises");

  try {
    await access(dirPath, constants.R_OK);
    return { success: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === "EACCES") {
      return {
        success: false,
        error: `Permission denied accessing ${dirType} directory at ${dirPath}. Check directory permissions and try again.`,
      };
    } else if (err.code === "ENOENT") {
      return {
        success: false,
        error: `${dirType} directory not found at ${dirPath}. Run 'agent-ctrl init' first.`,
      };
    } else if (err.code === "ELOOP") {
      return {
        success: false,
        error: `Too many symbolic links detected when accessing ${dirType} directory at ${dirPath}.`,
      };
    }

    return {
      success: false,
      error: `Failed to access ${dirType} directory at ${dirPath}: ${err.message}`,
    };
  }
}

/**
 * Validates a user-provided path for security issues and potential problems.
 *
 * This function performs security validation to prevent:
 * - Null byte injection attacks
 * - Path traversal attacks (../ ..\ patterns)
 *
 * Also warns about absolute paths that may not be intentional.
 *
 * @param path - The user-provided path to validate
 * @param optionName - The CLI option name for error messages (e.g., "--path")
 * @returns undefined if valid, error message string if validation fails
 *
 * @example
 * ```typescript
 * const pathError = validateUserPath(userPath, "--path");
 * if (pathError) {
 *   console.error(`✗ ${pathError}`);
 *   process.exit(1);
 * }
 * ```
 */
export function validateUserPath(path: string, optionName: string): string | undefined {
  // Check for null bytes
  if (path.includes("\0")) {
    return `Invalid ${optionName}: path contains null bytes`;
  }

  // Check for path traversal patterns - handle both ../ and ..\
  // Also check for paths ending with .. (e.g., "some/path/..")
  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.includes("../") || normalizedPath.includes("..\\")) {
    return `Invalid ${optionName}: path traversal detected`;
  }
  if (normalizedPath.endsWith("..") || normalizedPath.endsWith("/..") || normalizedPath.endsWith("\\..")) {
    return `Invalid ${optionName}: path traversal detected`;
  }

  // Platform-agnostic check for absolute paths outside home directory
  if (isAbsolute(path)) {
    const homeDir = homedir();
    // Normalize paths for comparison
    const normalizedHome = homeDir.replace(/\\/g, "/");
    const normalizedPathWithoutDrive = normalizedPath.replace(/^[A-Za-z]:/, ""); // Remove Windows drive letter

    // Check if path is within home directory
    let isInHome = false;
    if (process.platform === "win32") {
      isInHome = normalizedPathWithoutDrive.toLowerCase().startsWith(normalizedHome.toLowerCase());
    } else {
      isInHome = normalizedPath.startsWith(normalizedHome);
    }

    if (!isInHome) {
      console.warn(
        `Warning: ${optionName} is an absolute path outside the home directory. Ensure this is intentional.`
      );
    }
  }

  return undefined; // Valid
}
