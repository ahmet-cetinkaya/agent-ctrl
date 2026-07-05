import { BaseError } from "./BaseError";
import type { ErrorId } from "../constants/errorIds";

export class SystemError extends BaseError {
  readonly exitCode = 2;
  readonly type = "SystemError";
  readonly errorId?: ErrorId;

  constructor(message: string, errorId?: ErrorId, options?: { cause?: unknown }) {
    super(message, options);
    this.errorId = errorId;
  }
}
