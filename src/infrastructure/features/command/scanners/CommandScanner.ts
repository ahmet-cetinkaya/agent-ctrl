import { readdir } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";
import { FileValidator } from "@/infrastructure/shared/validation/FileValidator";

const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

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
      await this.scanDirectory(commandsPath, commandsPath, artifacts, warnings);
    } catch (error) {
      warnings.push(`Failed to scan commands directory: ${error}`);
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
    warnings: string[]
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = resolve(currentPath, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(rootPath, entryPath, artifacts, warnings);
        continue;
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
