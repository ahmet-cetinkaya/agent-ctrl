import { BaseError } from "./BaseError";

export class SystemError extends BaseError {
  readonly exitCode = 2;
  readonly type = "SystemError";

  constructor(message: string) {
    super(message);
  }
}
