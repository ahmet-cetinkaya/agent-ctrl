/**
 * Shared CLI result handler for consistent error handling across commands.
 */
import type { Result } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";

/**
 * Handles query result errors with consistent output formatting.
 * Returns true if the result was successful, false otherwise.
 * Handles process exit for error cases.
 */
export function handleQueryResult(result: Result<unknown, Error>): boolean {
  if (!result.success) {
    if (result.error instanceof UserError) {
      console.error(`✗ ${result.error.message}`);
      process.exit(result.error.exitCode);
    }
    console.error(`✗ Unexpected error: ${result.error}`);
    process.exit(2);
  }
  return true;
}

/**
 * Specific error handler for directory access with detailed error messages.
 * Distinguishes between "not found" and "permission denied" errors.
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
 * Validates a user-provided path for security issues.
 * Returns error message if validation fails, undefined if valid.
 */
export function validateUserPath(path: string, optionName: string): string | undefined {
  // Check for null bytes
  if (path.includes("\0")) {
    return `Invalid ${optionName}: path contains null bytes`;
  }

  // Check for obvious path traversal patterns
  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.includes("../") || normalizedPath.includes("..\\")) {
    return `Invalid ${optionName}: path traversal detected`;
  }

  // Check for absolute paths (may be allowed but should be explicit)
  if (path.startsWith("/") && !path.startsWith("/home/") && !path.startsWith("/users/")) {
    // Allow absolute paths but log a warning
    console.warn(`Warning: ${optionName} is an absolute path. Ensure this is intentional.`);
  }

  return undefined; // Valid
}
