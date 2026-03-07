import { CommandScanner, type CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { Result, ok } from "@/core/domain/shared/value-objects/Result";

export interface ListCommandsQueryOptions {
  commandsPath: string;
}

export interface ListCommandsQueryResult {
  artifacts: CommandArtifact[];
  warnings: string[];
}

/**
 * Query to list commands in the project.
 * The scanner handles expected I/O errors and returns them as warnings.
 * If the scanner throws, it's a programming error that should propagate.
 */
export class ListCommandsQuery {
  private readonly scanner: CommandScanner;

  constructor() {
    this.scanner = new CommandScanner();
  }

  async execute(options: ListCommandsQueryOptions): Promise<Result<ListCommandsQueryResult, Error>> {
    // Scanner handles expected I/O errors and returns them as warnings
    // If scanner throws, it's a programming error that should propagate
    const result = await this.scanner.scan(options.commandsPath);
    return ok({
      artifacts: result.artifacts,
      warnings: result.warnings,
    });
  }
}
