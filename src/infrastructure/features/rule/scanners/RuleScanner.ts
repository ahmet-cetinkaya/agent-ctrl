import { readdir } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";
import { FileValidator } from "../../../shared/validation/FileValidator";
import { createRule, type Rule } from "../../../../core/domain/shared/entities/Rule";

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

  async scan(rulesPath: string): Promise<RuleScanResult> {
    const artifacts: Rule[] = [];
    const warnings: string[] = [];

    try {
      const entries = await readdir(rulesPath);

      for (const entry of entries) {
        const filePath = resolve(rulesPath, entry);
        const originalExt = extname(entry);
        const ext = originalExt.toLowerCase() as (typeof MARKDOWN_EXTENSIONS)[number];

        if (!MARKDOWN_EXTENSIONS.includes(ext)) {
          warnings.push(`Skipped ${entry} (invalid extension)`);
          continue;
        }

        const readableResult = await this.fileValidator.isReadable(filePath);
        if (!readableResult.success) {
          warnings.push(`Could not read ${entry} (${readableResult.error.message})`);
          continue;
        }

        const id = basename(entry, originalExt);
        artifacts.push(createRule(id, entry, filePath));
      }
    } catch (error) {
      warnings.push(`Failed to scan rules directory: ${error}`);
    }

    return { files: [], warnings, artifacts };
  }
}
