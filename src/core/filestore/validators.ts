import path from "node:path";

/**
 * Path traversal security validator.
 *
 * Purpose: Prevent directory traversal attacks and unauthorized file access
 * by validating that file paths remain within allowed boundaries.
 *
 * Security requirement (FR-009): System MUST immediately fail with error
 * when path traversal violations are detected.
 */

/**
 * Result of path traversal validation.
 */
export interface PathValidationResult {
  /** Whether the path is safe (no traversal attempts) */
  isValid: boolean;

  /** Error message if validation failed */
  error: string | null;

  /** Normalized/resolved path for inspection */
  resolvedPath: string;
}

/**
 * Validates a path for traversal attempts and boundary violations.
 *
 * Checks for:
 * - Path traversal components (..)
 * - Absolute paths escaping project root
 * - Normalized path escaping allowed boundaries
 *
 * @param filePath - Path to validate
 * @param allowedRoot - Root directory that path must stay within
 * @returns Validation result with safety status and error details
 *
 * @example
 * ```ts
 * const result = validatePathTraversal('../etc/passwd', '/project');
 * // { isValid: false, error: 'Path traversal detected: .. component', resolvedPath: '/project/../etc/passwd' }
 * ```
 */
export function validatePathTraversal(filePath: string, allowedRoot: string): PathValidationResult {
  let decoded = filePath;
  try {
    decoded = decodeURIComponent(filePath);
  } catch {
    return {
      isValid: false,
      error: `Malformed percent-encoding in path: ${filePath}`,
      resolvedPath: filePath,
    };
  }

  const normalized = path.normalize(decoded);
  const resolved = path.resolve(allowedRoot, normalized);

  // Check for path traversal attempts (raw and percent-decoded forms)
  if (filePath.includes("..") || decoded.includes("..")) {
    return {
      isValid: false,
      error: `Path traversal detected: '..' component in path`,
      resolvedPath: normalized,
    };
  }

  // Reject home-directory references; they resolve outside the project boundary
  if (decoded.startsWith("~")) {
    return {
      isValid: false,
      error: `Home directory reference not allowed: ${decoded}`,
      resolvedPath: normalized,
    };
  }

  // Check if resolved path escapes allowed root
  const relativePath = path.relative(allowedRoot, resolved);
  if (relativePath.startsWith("..")) {
    return {
      isValid: false,
      error: `Path escapes allowed root: ${normalized} escapes ${allowedRoot}`,
      resolvedPath: resolved,
    };
  }

  return {
    isValid: true,
    error: null,
    resolvedPath: resolved,
  };
}

/**
 * Validates multiple paths for traversal attacks.
 *
 * @param filePaths - Paths to validate
 * @param allowedRoot - Root directory that paths must stay within
 * @returns Array of validation results in same order as input paths
 */
export function validateMultiplePaths(filePaths: string[], allowedRoot: string): PathValidationResult[] {
  return filePaths.map((path) => validatePathTraversal(path, allowedRoot));
}
