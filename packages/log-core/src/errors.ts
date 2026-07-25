export class LogParseError extends Error {
  readonly code = 'UNRECOGNIZED_FORMAT';

  constructor(message: string) {
    super(message);
    this.name = 'LogParseError';
  }
}
