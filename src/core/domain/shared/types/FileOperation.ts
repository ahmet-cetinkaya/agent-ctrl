/**
 * Represents a file copy operation from source to destination.
 *
 * Purpose: Encapsulates metadata and state for copying configuration artifacts
 * from platform-specific settings directories to target platform config directories.
 *
 * Security: Each operation undergoes path traversal validation and symbolic link checks
 * before execution to ensure safety and prevent unauthorized file access.
 */
export interface FileOperation {
  /** Absolute path to source file (platform-specific setting) */
  sourcePath: string;

  /** Absolute path to target destination (platform config directory) */
  destinationPath: string;

  /** Type of filesystem entity being copied */
  operationType: FileSystemEntityType;

  /** Current status of the operation */
  status: FileOperationStatus;

  /** Action to take when target exists (always follows 'replace' semantics per requirements) */
  overrideAction: OverrideAction;

  /** Error message if operation failed (null otherwise) */
  error?: string | null;
}

/** Types of filesystem entities that can be copied */
export type FileSystemEntityType = "file" | "directory" | "symlink";

/** Status states for file operations */
export type FileOperationStatus =
  | "pending" // Operation queued but not started
  | "completed" // Successfully copied
  | "failed" // Error occurred during copy
  | "skipped"; // Not executed (e.g., due to validation failure)

/** Override behavior when target file exists */
export type OverrideAction =
  | "replace" // Platform-specific file completely replaces standard file
  | "preserve" // Keep existing file (not used in current implementation)
  | "error"; // Fail if target exists (not used in current implementation)
