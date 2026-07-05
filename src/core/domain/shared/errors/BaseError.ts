export abstract class BaseError extends Error {
  abstract readonly exitCode: number;
  abstract readonly type: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
  }
}
