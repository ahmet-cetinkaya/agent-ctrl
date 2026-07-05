/**
 * Result of security validation for filesystem operations.
 *
 * Purpose: Encapsulates the outcome of security checks on file paths and operations,
 * particularly for path traversal attempts and symbolic link handling.
 *
 * Security requirements (FR-009):
 * - Path traversal controls MUST immediately fail with error
 * - Symbolic links to locations outside project trigger warnings
 * - Validation must pass before any file operations execute
 */
export interface SecurityValidationResult {
  /** Whether the path/operation passes all security checks */
  isValid: boolean;

  /** Primary error message if validation failed (null if valid) */
  error: string | null;

  /** Warning messages for non-critical security issues (e.g., external symlinks) */
  warnings: string[];

  /** Detailed context about what was validated (for debugging) */
  validationContext: SecurityContext;
}

/**
 * Context information for security validation.
 *
 * Provides metadata about what was checked and how, aiding in
 * troubleshooting and security auditing.
 */
export interface SecurityContext {
  /** The original path being validated */
  originalPath: string;

  /** Normalized/resolved path after processing */
  resolvedPath: string;

  /** Whether path contains symbolic links */
  hasSymbolicLinks: boolean;

  /** Type of validation performed */
  validationType: SecurityValidationType;

  /** Timestamp of validation (ISO 8601 string) */
  validatedAt: string;
}

/** Types of security validation performed */
export type SecurityValidationType =
  | "path_traversal" // Check for .. components and escape attempts
  | "symbolic_link" // Check for symlink targets outside project
  | "permission_check" // Verify read/write permissions
  | "boundary_check"; // Ensure path stays within allowed directories

/**
 * Security failure behavior:
 *
 * When validation fails (isValid: false), the system MUST:
 * 1. Stop all processing immediately
 * 2. Report security violation to user with clear error message
 * 3. Not proceed with any file operations
 *
 * @see {@link ../../../../specs/006-platform-specific-settings/spec.md} FR-009
 */
