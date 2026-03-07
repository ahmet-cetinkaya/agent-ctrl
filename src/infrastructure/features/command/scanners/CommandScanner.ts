import { readdir, lstat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";
import { FileValidator } from "@/infrastructure/shared/validation/FileValidator";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

// Maximum directory depth to prevent DoS via deeply nested directories
const MAX_SCAN_DEPTH = 20;

export interface CommandArtifact {
  id: string;
  filename: string;
  path: string;
}

export interface CommandScanResult {
  artifacts: CommandArtifact[];
  warnings: string[];
}

export class CommandScanner {
  private readonly fileValidator: FileValidator;

  constructor() {
    this.fileValidator = new FileValidator();
  }

  async scan(commandsPath: string): Promise<CommandScanResult> {
    const artifacts: CommandArtifact[] = [];
    const warnings: string[] = [];

    try {
      await this.scanDirectory(commandsPath, commandsPath, artifacts, warnings, 0, new Set());
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;

      // Only catch expected I/O errors, re-throw programming errors
      if (nodeErr.code === "EACCES" || nodeErr.code === "ENOTDIR") {
        warnings.push(`Failed to scan commands directory at ${commandsPath}: ${nodeErr.message}`);
        return { artifacts, warnings };
      }

      // Re-throw unexpected errors (programming errors, resource exhaustion)
      throw new SystemError(
        `Failed to scan commands directory at ${commandsPath}: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_IDS.COMMAND_SCAN_FAILED
      );
    }

    return {
      artifacts,
      warnings,
    };
  }

  private async scanDirectory(
    rootPath: string,
    currentPath: string,
    artifacts: CommandArtifact[],
    warnings: string[],
    currentDepth: number,
    visitedInodes: Set<string>
  ): Promise<void> {
    // Prevent stack overflow from deeply nested directories
    if (currentDepth > MAX_SCAN_DEPTH) {
      warnings.push(`Skipped ${this.normalizeSeparators(relative(rootPath, currentPath))} (maximum depth exceeded)`);
      return;
    }

    // Get directory entry with inode information for symlink cycle detection
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = resolve(currentPath, entry.name);

      // Handle directories with symlink cycle detection
      if (entry.isDirectory()) {
        await this.scanDirectory(rootPath, entryPath, artifacts, warnings, currentDepth + 1, visitedInodes);
        continue;
      }

      // Handle symlinks - detect cycles
      if (entry.isSymbolicLink()) {
        try {
          const stats = await lstat(entryPath);
          const inodeKey = `${stats.dev}:${stats.ino}`;

          // Detect symlink cycles
          if (visitedInodes.has(inodeKey)) {
            warnings.push(
              `Skipped ${this.normalizeSeparators(relative(rootPath, entryPath))} (symlink cycle detected)`
            );
            continue;
          }

          // Skip symlinks that point outside the project
          if (stats.isDirectory()) {
            visitedInodes.add(inodeKey);
            await this.scanDirectory(rootPath, entryPath, artifacts, warnings, currentDepth + 1, visitedInodes);
            visitedInodes.delete(inodeKey); // Backtrack
            continue;
          }
        } catch (error) {
          warnings.push(`Skipped ${this.normalizeSeparators(relative(rootPath, entryPath))} (broken symlink)`);
          continue;
        }
      }

      const originalExt = extname(entry.name);
      const ext = originalExt.toLowerCase() as (typeof MARKDOWN_EXTENSIONS)[number];
      if (!MARKDOWN_EXTENSIONS.includes(ext)) {
        warnings.push(`Skipped ${this.normalizeSeparators(relative(rootPath, entryPath))} (invalid extension)`);
        continue;
      }

      const readableResult = await this.fileValidator.isReadable(entryPath);
      if (!readableResult.success) {
        warnings.push(
          `Could not read ${this.normalizeSeparators(relative(rootPath, entryPath))} (${readableResult.error.message})`
        );
        continue;
      }

      const relativeFilename = this.normalizeSeparators(relative(rootPath, entryPath));
      const id = this.normalizeSeparators(relative(rootPath, resolve(currentPath, basename(entry.name, originalExt))));
      artifacts.push({
        id,
        filename: relativeFilename,
        path: entryPath,
      });
    }
  }

  private normalizeSeparators(path: string): string {
    return path.split(sep).join("/");
  }
}
