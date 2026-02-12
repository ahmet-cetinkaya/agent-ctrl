export abstract class BaseError extends Error {
  abstract readonly exitCode: number;
  abstract readonly type: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
