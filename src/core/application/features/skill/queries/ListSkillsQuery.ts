import type { Skill } from "@/core/domain/shared/entities/Skill";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";

export interface ListSkillsQueryOptions {
  skillsPath: string;
}

export interface ListSkillsQueryResult {
  artifacts: Skill[];
  warnings: string[];
}

export class ListSkillsQuery {
  private scanner: SkillScanner;

  constructor() {
    this.scanner = new SkillScanner();
  }

  async execute(options: ListSkillsQueryOptions): Promise<Result<ListSkillsQueryResult, Error>> {
    try {
      const result = await this.scanner.scan(options.skillsPath);
      return ok({
        artifacts: result.artifacts,
        warnings: result.warnings,
      });
    } catch (error) {
      return err(new UserError(`Failed to list skills: ${error}`));
    }
  }
}
