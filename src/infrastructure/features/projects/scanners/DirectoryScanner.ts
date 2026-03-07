import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import type { Result } from "@/core/domain/shared/value-objects/Result";
import { ok, err } from "@/core/domain/shared/value-objects/Result";

export interface ScannedFile {
  name: string;
  path: string;
  isDirectory: boolean;
  extension: string;
}

export interface ScanResult {
  files: ScannedFile[];
  warnings: string[];
}

export class DirectoryScanner {
  constructor() {}

  async scan(
    directoryPath: string,
    options: {
      recursive?: boolean;
      extensions?: string[];
    } = {}
  ): Promise<Result<ScanResult, Error>> {
    const { recursive = false, extensions } = options;
    const files: ScannedFile[] = [];
    const warnings: string[] = [];

    try {
      const entries = await readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            extension: "",
          });

          if (recursive) {
            const subResult = await this.scan(fullPath, options);
            if (subResult.success) {
              files.push(...subResult.data.files);
              warnings.push(...subResult.data.warnings);
            }
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();

          if (extensions && !extensions.includes(ext)) {
            warnings.push(`Skipped ${entry.name} (invalid extension)`);
            continue;
          }

          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            extension: ext,
          });
        }
      }

      return ok({ files, warnings });
    } catch (error) {
      return err(new Error(`Failed to scan directory: ${directoryPath}`));
    }
  }
}
