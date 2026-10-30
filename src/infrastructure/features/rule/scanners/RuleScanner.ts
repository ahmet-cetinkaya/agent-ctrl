import { readdir } from "node:fs/promises";
import { resolve, extname, relative, sep } from "node:path";
import { FileValidator } from "@/infrastructure/shared/validation/FileValidator";
import { createRule, type Rule } from "@/core/domain/shared/entities/Rule";

const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

export interface RuleScanResult {
  files: { name: string; path: string; isDirectory: boolean; extension: string }[];
  artifacts: Rule[];
  warnings: string[];
}

export class RuleScanner {
  private fileValidator: FileValidator;

  constructor() {
    this.fileValidator = new FileValidator();
  }

  /**
   * Scans a rules directory. Rules may sit in subfolders (profiles group them as `rules/<language>/*.md`);
   * the rule id and filename are then the path relative to `rulesPath`, so equally named files in
   * different subfolders stay distinct.
   */
  async scan(rulesPath: string): Promise<RuleScanResult> {
    const artifacts: Rule[] = [];
    const warnings: string[] = [];

    try {
      await this.scanDirectory(rulesPath, rulesPath, artifacts, warnings);
    } catch (error) {
      warnings.push(`Failed to scan rules directory: ${error}`);
    }

    return { files: [], warnings, artifacts };
  }

  private async scanDirectory(
    rootPath: string,
    currentPath: string,
    artifacts: Rule[],
    warnings: string[]
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = resolve(currentPath, entry.name);
      const relativeName = relative(rootPath, entryPath).split(sep).join("/");

      if (entry.isDirectory()) {
        await this.scanDirectory(rootPath, entryPath, artifacts, warnings);
        continue;
      }

      const originalExt = extname(entry.name);
      const ext = originalExt.toLowerCase() as (typeof MARKDOWN_EXTENSIONS)[number];

      if (!MARKDOWN_EXTENSIONS.includes(ext)) {
        warnings.push(`Skipped ${relativeName} (invalid extension)`);
        continue;
      }

      const readableResult = await this.fileValidator.isReadable(entryPath);
      if (!readableResult.success) {
        warnings.push(`Could not read ${relativeName} (${readableResult.error.message})`);
        continue;
      }

      const id = relativeName.slice(0, relativeName.length - originalExt.length);
      artifacts.push(createRule(id, relativeName, entryPath));
    }
  }
}
