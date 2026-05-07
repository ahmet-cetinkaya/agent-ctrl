import { BaseError } from "@/core/domain/shared/errors/BaseError";
import { LogService } from "@/presentation/cli/shared/utils/LogService";

export interface ErrorHandlerOptions {
  verbose?: boolean;
  quiet?: boolean;
}

export class ErrorHandler {
  private options: ErrorHandlerOptions;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = options;
  }

  handle(error: unknown): never {
    if (error instanceof BaseError) {
      this.handleBaseError(error);
    } else if (error instanceof Error) {
      this.handleGenericError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  private handleBaseError(error: BaseError): never {
    if (!this.options.quiet) {
      LogService.error(error.message);

      if (this.options.verbose && error.stack) {
        LogService.error(error.stack);
      }
    }

    process.exit(error.exitCode);
  }

  private handleGenericError(error: Error): never {
    if (!this.options.quiet) {
      LogService.error(`Unexpected error: ${error.message}`);

      if (this.options.verbose && error.stack) {
        LogService.error(error.stack);
      }
    }

    process.exit(2);
  }

  private handleUnknownError(error: unknown): never {
    if (!this.options.quiet) {
      LogService.error("Unknown error occurred");

      if (this.options.verbose) {
        LogService.error(String(error));
      }
    }

    process.exit(2);
  }
}
