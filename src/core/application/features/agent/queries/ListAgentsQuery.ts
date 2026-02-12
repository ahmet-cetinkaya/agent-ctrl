import type { Agent } from "../../../../../core/domain/shared/entities/Agent";
import { AgentScanner } from "../../../../../infrastructure/features/agent/scanners/AgentScanner";
import { Result, ok, err } from "../../../../../core/domain/shared/value-objects/Result";
import { UserError } from "../../../../../core/domain/shared/errors/UserError";

export interface ListAgentsQueryOptions {
  agentsPath: string;
}

export interface ListAgentsQueryResult {
  artifacts: Agent[];
  warnings: string[];
}

export class ListAgentsQuery {
  private scanner: AgentScanner;

  constructor() {
    this.scanner = new AgentScanner();
  }

  async execute(options: ListAgentsQueryOptions): Promise<Result<ListAgentsQueryResult, Error>> {
    try {
      const result = await this.scanner.scan(options.agentsPath);
      return ok({
        artifacts: result.artifacts,
        warnings: result.warnings,
      });
    } catch (error) {
      return err(new UserError(`Failed to list agents: ${error}`));
    }
  }
}
