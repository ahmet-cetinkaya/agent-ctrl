import fs from "node:fs";
import path from "node:path";

/**
 * Symbolic link detection and validation utilities.
 *
 * Purpose: Detect symbolic links in platform-specific settings and validate
 * that they don't pose security risks by pointing outside project boundaries.
 *
 * Security: Symbolic links to locations outside the project trigger warnings
 * but are allowed to be copied (following the link with appropriate safety checks).
 */

/**
 * Result of symbolic link detection and validation.
 */
export interface SymlinkDetectionResult {
  /** Whether the path is a symbolic link */
  isSymlink: boolean;

  /** Target path the symlink points to (absolute resolved path) */
  targetPath: string | null;

  /** Whether the target is outside project boundaries */
  targetEscapesProject: boolean;

  /** Warning message if target escapes project (null otherwise) */
  warning: string | null;
}

/**
 * Detects if a given path is a symbolic link and validates its target.
 *
 * @param filePath - Path to check
 * @param projectRoot - Root directory of the project (for boundary checking)
 * @returns Detection result with symlink status and safety information
 *
 * @example
 * ```ts
 * const result = detectSymlink('/project/settings/claude/config.json', '/project');
 * // If config.json is a symlink to /etc/app-config.json:
 * // { isSymlink: true, targetPath: '/etc/app-config.json', targetEscapesProject: true, warning: '...' }
 * ```
 */
export function detectSymlink(filePath: string, projectRoot: string): SymlinkDetectionResult {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch {
    // Path does not exist or cannot be read
    return {
      isSymlink: false,
      targetPath: null,
      targetEscapesProject: false,
      warning: null,
    };
  }

  // Not a symbolic link
  if (!stats.isSymbolicLink()) {
    return {
      isSymlink: false,
      targetPath: null,
      targetEscapesProject: false,
      warning: null,
    };
  }

  // Resolve the symbolic link target. Broken links (missing target) still count
  // as symlinks; fall back to the raw link target when realpath fails.
  let resolvedTarget: string;
  try {
    resolvedTarget = path.resolve(fs.realpathSync(filePath));
  } catch {
    resolvedTarget = path.resolve(projectRoot, fs.readlinkSync(filePath));
  }

  // Check if target escapes project boundaries
  const relativePath = path.relative(projectRoot, resolvedTarget);
  const targetEscapesProject = relativePath.startsWith("..");

  const warning = targetEscapesProject
    ? `Symbolic link points outside project: ${filePath} → ${resolvedTarget}`
    : null;

  return {
    isSymlink: true,
    targetPath: resolvedTarget,
    targetEscapesProject,
    warning,
  };
}

/**
 * Result of a recursive symlink scan.
 */
export interface SymlinkScanResult {
  /** Symlinks found during the scan */
  symlinks: SymlinkDetectionResult[];

  /** Directories that could not be read (permission errors, races); scan may be incomplete. */
  scanErrors: string[];
}

/**
 * Scans a directory recursively for symbolic links.
 *
 * @param directoryPath - Directory path to scan
 * @param projectRoot - Root directory of the project
 * @returns Symlinks found plus any directories that could not be read
 *
 * @example
 * ```ts
 * const { symlinks, scanErrors } = findSymlinksInDirectory('/project/settings/claude', '/project');
 * // scanErrors is non-empty if any subdirectory could not be read (incomplete scan)
 * ```
 */
export function findSymlinksInDirectory(directoryPath: string, projectRoot: string): SymlinkScanResult {
  const symlinks: SymlinkDetectionResult[] = [];
  const scanErrors: string[] = [];

  function scanDirectory(currentPath: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      scanErrors.push(
        `Could not read directory during symlink scan: ${currentPath} (${error instanceof Error ? error.message : String(error)})`
      );
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isSymbolicLink()) {
        const result = detectSymlink(fullPath, projectRoot);
        symlinks.push(result);
      } else if (entry.isDirectory()) {
        scanDirectory(fullPath); // Recursive scan
      }
    }
  }

  scanDirectory(directoryPath);
  return { symlinks, scanErrors };
}

/**
 * Filters symlink detection results to only those with warnings.
 *
 * @param results - Array of symlink detection results
 * @returns Array of results that have warnings (external targets)
 */
export function filterExternalSymlinks(results: SymlinkDetectionResult[]): SymlinkDetectionResult[] {
  return results.filter((result) => result.warning !== null);
}
