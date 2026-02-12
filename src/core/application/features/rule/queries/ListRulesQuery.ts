import type { Rule } from "@/core/domain/shared/entities/Rule";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";

export interface ListRulesQueryOptions {
  rulesPath: string;
}

export interface ListRulesQueryResult {
  artifacts: Rule[];
  warnings: string[];
}

export class ListRulesQuery {
  private scanner: RuleScanner;

  constructor() {
    this.scanner = new RuleScanner();
  }

  async execute(options: ListRulesQueryOptions): Promise<Result<ListRulesQueryResult, Error>> {
    try {
      const result = await this.scanner.scan(options.rulesPath);
      return ok({
        artifacts: result.artifacts,
        warnings: result.warnings,
      });
    } catch (error) {
      return err(new UserError(`Failed to list rules: ${error}`));
    }
  }
}
