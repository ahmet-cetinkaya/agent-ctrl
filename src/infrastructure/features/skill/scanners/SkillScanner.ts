import { readdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { constants } from "node:fs";
import { createSkill, type Skill } from "../../../../core/domain/shared/entities/Skill";
import type { ScanResult } from "./DirectoryScanner";

export interface SkillScanResult extends ScanResult {
  artifacts: Skill[];
}

export class SkillScanner {
  async scan(skillsPath: string): Promise<SkillScanResult> {
    const artifacts: Skill[] = [];
    const warnings: string[] = [];

    try {
      const entries = await readdir(skillsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const dirPath = resolve(skillsPath, entry.name);
        const skillMdPath = join(dirPath, "SKILL.md");

        try {
          await access(skillMdPath, constants.R_OK);
        } catch {
          warnings.push(`Directory ${entry.name}/ missing SKILL.md`);
          continue;
        }

        artifacts.push(createSkill(entry.name, entry.name, dirPath));
      }
    } catch (error) {
      warnings.push(`Failed to scan skills directory: ${error}`);
    }

    return { files: [], warnings, artifacts };
  }
}
