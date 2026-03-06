import { CommandScanner, type CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { Result, err, ok } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";

export interface ListCommandsQueryOptions {
  commandsPath: string;
}

export interface ListCommandsQueryResult {
  artifacts: CommandArtifact[];
  warnings: string[];
}

export class ListCommandsQuery {
  private readonly scanner: CommandScanner;

  constructor() {
    this.scanner = new CommandScanner();
  }

  async execute(options: ListCommandsQueryOptions): Promise<Result<ListCommandsQueryResult, Error>> {
    try {
      const result = await this.scanner.scan(options.commandsPath);
      return ok({
        artifacts: result.artifacts,
        warnings: result.warnings,
      });
    } catch (error) {
      return err(new UserError(`Failed to list commands: ${error}`));
    }
  }
}
