import { BaseError } from "./BaseError";
import type { ErrorId } from "../constants/errorIds";

export class UserError extends BaseError {
  readonly exitCode = 1;
  readonly type = "UserError";
  readonly errorId?: ErrorId;

  constructor(message: string, errorId?: ErrorId) {
    super(message);
    this.errorId = errorId;
  }
}
