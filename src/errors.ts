import type { TravelsErrorCode } from './type.js';

export class TravelsError extends Error {
  public readonly code: TravelsErrorCode;
  public readonly cause?: unknown;

  constructor(
    code: TravelsErrorCode,
    message: string,
    options: { cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'TravelsError';
    this.code = code;
    this.cause = options.cause;
  }
}


export class TravelsTypeError extends TypeError {
  public readonly code: TravelsErrorCode;
  public readonly cause?: unknown;

  constructor(
    code: TravelsErrorCode,
    message: string,
    options: { cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'TravelsTypeError';
    this.code = code;
    this.cause = options.cause;
  }
}
