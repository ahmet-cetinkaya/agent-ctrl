import { BaseError } from "./BaseError";

export class UserError extends BaseError {
  readonly exitCode = 1;
  readonly type = "UserError";

  constructor(message: string) {
    super(message);
  }
}
