import { BaseError } from "../../../../core/domain/shared/errors/BaseError";
import { UserError } from "../../../../core/domain/shared/errors/UserError";
import { SystemError } from "../../../../core/domain/shared/errors/SystemError";

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
      console.error(`✗ ${error.message}`);

      if (this.options.verbose && error.stack) {
        console.error(error.stack);
      }
    }

    process.exit(error.exitCode);
  }

  private handleGenericError(error: Error): never {
    if (!this.options.quiet) {
      console.error(`✗ Unexpected error: ${error.message}`);

      if (this.options.verbose && error.stack) {
        console.error(error.stack);
      }
    }

    process.exit(2);
  }

  private handleUnknownError(error: unknown): never {
    if (!this.options.quiet) {
      console.error(`✗ Unknown error occurred`);

      if (this.options.verbose) {
        console.error(error);
      }
    }

    process.exit(2);
  }
}
