import { readdir } from "node:fs/promises";
import { resolve, extname, basename } from "node:path";
import { FileValidator } from "../../../shared/validation/FileValidator";
import { createAgent, type Agent } from "../../../../core/domain/shared/entities/Agent";
import type { ScanResult } from "./DirectoryScanner";

const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

export interface AgentScanResult extends ScanResult {
  artifacts: Agent[];
}

export class AgentScanner {
  private fileValidator: FileValidator;

  constructor() {
    this.fileValidator = new FileValidator();
  }

  async scan(agentsPath: string): Promise<AgentScanResult> {
    const artifacts: Agent[] = [];
    const warnings: string[] = [];

    try {
      const entries = await readdir(agentsPath);

      for (const entry of entries) {
        const filePath = resolve(agentsPath, entry);
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
        artifacts.push(createAgent(id, entry, filePath));
      }
    } catch (error) {
      warnings.push(`Failed to scan agents directory: ${error}`);
    }

    return { files: [], warnings, artifacts };
  }
}
