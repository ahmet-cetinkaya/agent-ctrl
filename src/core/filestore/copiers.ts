import fs from "node:fs";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { FileOperation } from "../domain/shared/types/FileOperation.js";

/**
 * File copying operations with override semantics.
 *
 * Purpose: Core file copying functionality that implements platform-specific
 * settings deployment with security validation and deterministic behavior.
 *
 * Override semantics (FR-005): Platform-specific files completely replace
 * standard files - no merging, no backups, deterministic replacement.
 */

/**
 * Configuration for file copy operations.
 */
export interface CopyConfig {
  /** Whether to follow symbolic links (true) or preserve them (false) */
  followSymbolicLinks: boolean;

  /** Whether to create parent directories if they don't exist */
  createParentDirectories: boolean;

  /** Environment variables for ${VAR} placeholder interpolation (optional) */
  envVariables?: Record<string, string>;
}

/**
 * Default copy configuration (secure defaults).
 *
 * Note: files are always overwritten deterministically (FR-005) - there is no
 * config flag for this since agent-ctrl-managed destinations never need partial merges.
 */
export const DEFAULT_COPY_CONFIG: CopyConfig = {
  followSymbolicLinks: true,
  createParentDirectories: true,
  envVariables: undefined,
};

/**
 * Checks if a buffer contains binary data (null bytes).
 * Text files typically don't contain null bytes, so this is a simple heuristic.
 */
function isBinaryFile(buffer: Buffer): boolean {
  return buffer.includes(0);
}

/**
 * Checks if content contains ${VAR} placeholders.
 */
function containsPlaceholders(content: string): boolean {
  return /\$\{[^}]+\}/.test(content);
}

/**
 * Resolves ${VAR} placeholders in content using provided variables.
 */
function resolvePlaceholders(content: string, variables: Record<string, string>): string {
  return content.replace(/\$\{([^}]+)\}/g, (_match, variableName: string) => {
    return Object.prototype.hasOwnProperty.call(variables, variableName)
      ? variables[variableName]
      : `\${${variableName}}`;
  });
}

/**
 * Result of a file copy operation.
 */
export interface CopyResult {
  /** Whether the copy operation succeeded */
  success: boolean;

  /** Number of files copied */
  filesCopied: number;

  /** Number of directories created */
  directoriesCreated: number;

  /** Error message if operation failed */
  error: string | null;

  /** Detailed operation results for tracking */
  operations: FileOperation[];
}

/**
 * Copies a single file from source to destination with optional env variable interpolation.
 *
 * @param sourcePath - Source file path
 * @param destinationPath - Destination file path
 * @param config - Copy configuration
 * @returns File operation result with status and error details
 *
 * @example
 * ```ts
 * const result = await copyFile('/project/settings/claude/config.json', '/home/user/.claude/config.json');
 * // { success: true, filesCopied: 1, directoriesCreated: 0, error: null, operations: [...] }
 * ```
 */
export async function copyFile(
  sourcePath: string,
  destinationPath: string,
  config: CopyConfig = DEFAULT_COPY_CONFIG
): Promise<FileOperation> {
  const operation: FileOperation = {
    sourcePath,
    destinationPath: destinationPath,
    operationType: "file",
    status: "pending",
    overrideAction: "replace",
    error: null,
  };

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(destinationPath);
    if (config.createParentDirectories && !fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Read source file for potential interpolation
    const content = await readFile(sourcePath);
    const isBinary = isBinaryFile(content);

    if (!isBinary && config.envVariables && Object.keys(config.envVariables).length > 0) {
      const textContent = content.toString("utf-8");
      if (containsPlaceholders(textContent)) {
        const interpolated = resolvePlaceholders(textContent, config.envVariables);
        await writeFile(destinationPath, interpolated, "utf-8");
      } else {
        await writeFile(destinationPath, content);
      }
    } else {
      // Binary file or no interpolation needed - use direct copy
      fs.copyFileSync(sourcePath, destinationPath);
    }

    operation.status = "completed";
    return operation;
  } catch (error) {
    operation.status = "failed";
    operation.error = error instanceof Error ? error.message : String(error);
    return operation;
  }
}

/**
 * Recursively copies a directory from source to destination.
 *
 * @param sourcePath - Source directory path
 * @param destinationPath - Destination directory path
 * @param config - Copy configuration
 * @returns Array of file operations performed
 *
 * @example
 * ```ts
 * const operations = await copyDirectory('/project/settings/claude', '/home/user/.claude');
 * // Returns array of FileOperation objects for each file/directory copied
 * ```
 */
export async function copyDirectory(
  sourcePath: string,
  destinationPath: string,
  config: CopyConfig = DEFAULT_COPY_CONFIG,
  sourceRoot: string = sourcePath
): Promise<FileOperation[]> {
  const operations: FileOperation[] = [];

  try {
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
      operations.push({
        sourcePath: destinationPath,
        destinationPath: destinationPath,
        operationType: "directory",
        status: "completed",
        overrideAction: "replace",
        error: null,
      });
    }
  } catch (error) {
    operations.push({
      sourcePath,
      destinationPath,
      operationType: "directory",
      status: "failed",
      overrideAction: "replace",
      error: error instanceof Error ? error.message : String(error),
    });
    return operations;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(sourcePath, { withFileTypes: true });
  } catch (error) {
    operations.push({
      sourcePath,
      destinationPath,
      operationType: "directory",
      status: "failed",
      overrideAction: "replace",
      error: error instanceof Error ? error.message : String(error),
    });
    return operations;
  }

  // Each entry is processed independently: one bad file/symlink must not
  // prevent the remaining entries from being copied or reported.
  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const destEntry = path.join(destinationPath, entry.name);

    try {
      if (entry.isDirectory()) {
        const subOps = await copyDirectory(sourceEntry, destEntry, config, sourceRoot);
        operations.push(...subOps);
      } else if (entry.isSymbolicLink() && config.followSymbolicLinks) {
        const targetPath = fs.realpathSync(sourceEntry);
        const relativeToRoot = path.relative(sourceRoot, targetPath);
        if (relativeToRoot.startsWith("..")) {
          operations.push({
            sourcePath: sourceEntry,
            destinationPath: destEntry,
            operationType: "symlink",
            status: "failed",
            overrideAction: "replace",
            error: `Symbolic link escapes settings root: ${sourceEntry} → ${targetPath}`,
          });
          continue;
        }
        operations.push(await copyFile(targetPath, destEntry, config));
      } else if (entry.isFile()) {
        operations.push(await copyFile(sourceEntry, destEntry, config));
      }
      // Symbolic links when followSymbolicLinks is false are skipped
    } catch (error) {
      operations.push({
        sourcePath: sourceEntry,
        destinationPath: destEntry,
        operationType: entry.isDirectory() ? "directory" : "file",
        status: "failed",
        overrideAction: "replace",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return operations;
}

/**
 * Copies platform-specific settings to a target configuration directory.
 *
 * @param sourceSettingsPath - Source platform-specific settings directory
 * @param targetConfigPath - Target platform configuration directory
 * @param config - Copy configuration
 * @returns Copy result with summary statistics
 *
 * @example
 * ```ts
 * const result = await copyPlatformSettings(
 *   '/project/settings/claude',
 *   '/home/user/.claude'
 * );
 * // { success: true, filesCopied: 5, directoriesCreated: 2, error: null, operations: [...] }
 * ```
 */
export async function copyPlatformSettings(
  sourceSettingsPath: string,
  targetConfigPath: string,
  config: CopyConfig = DEFAULT_COPY_CONFIG
): Promise<CopyResult> {
  try {
    // Validate source exists
    if (!fs.existsSync(sourceSettingsPath)) {
      return {
        success: false,
        filesCopied: 0,
        directoriesCreated: 0,
        error: `Source settings directory does not exist: ${sourceSettingsPath}`,
        operations: [],
      };
    }

    // Perform directory copy
    const operations = await copyDirectory(sourceSettingsPath, targetConfigPath, config);

    // Calculate statistics
    const filesCopied = operations.filter((op) => op.operationType === "file" && op.status === "completed").length;
    const directoriesCreated = operations.filter(
      (op) => op.operationType === "directory" && op.status === "completed"
    ).length;
    const hasFailures = operations.some((op) => op.status === "failed");

    return {
      success: !hasFailures,
      filesCopied,
      directoriesCreated,
      error: hasFailures ? "Some operations failed" : null,
      operations,
    };
  } catch (error) {
    return {
      success: false,
      filesCopied: 0,
      directoriesCreated: 0,
      error: error instanceof Error ? error.message : String(error),
      operations: [],
    };
  }
}
