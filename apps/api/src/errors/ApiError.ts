/**
 * Machine-readable error codes used across the API. Every non-2xx JSON response uses the
 * shared envelope `{ error: { code, message, detail? } }` described in the plan's API
 * contract; SSE routes (`/api/chat`) translate these into `error` SSE frames instead once
 * the stream has opened (see `routes/chat.ts`).
 */
export type ApiErrorCode =
  | 'INVALID_URL'
  | 'FETCH_FAILED'
  | 'RESPONSE_TOO_LARGE'
  | 'UNRECOGNIZED_FORMAT'
  | 'SESSION_NOT_FOUND'
  | 'NO_LOG_LOADED'
  | 'CHAT_IN_PROGRESS'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'SESSION_CAPACITY';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly detail?: unknown;

  constructor(code: ApiErrorCode, status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }

  toJSON(): { error: { code: ApiErrorCode; message: string; detail?: unknown } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.detail !== undefined ? { detail: this.detail } : {}),
      },
    };
  }

  static invalidUrl(message: string, detail?: unknown): ApiError {
    return new ApiError('INVALID_URL', 400, message, detail);
  }
  static fetchFailed(message: string, detail?: unknown): ApiError {
    return new ApiError('FETCH_FAILED', 502, message, detail);
  }
  static responseTooLarge(message: string, detail?: unknown): ApiError {
    return new ApiError('RESPONSE_TOO_LARGE', 413, message, detail);
  }
  static unrecognizedFormat(message: string, detail?: unknown): ApiError {
    return new ApiError('UNRECOGNIZED_FORMAT', 422, message, detail);
  }
  static sessionNotFound(message = 'session not found'): ApiError {
    return new ApiError('SESSION_NOT_FOUND', 404, message);
  }
  static noLogLoaded(message = 'no log has been loaded for this session yet'): ApiError {
    return new ApiError('NO_LOG_LOADED', 400, message);
  }
  static chatInProgress(message = 'a chat turn is already in progress for this session'): ApiError {
    return new ApiError('CHAT_IN_PROGRESS', 409, message);
  }
  static validation(message: string, detail?: unknown): ApiError {
    return new ApiError('VALIDATION_ERROR', 400, message, detail);
  }
  static notFound(message: string): ApiError {
    return new ApiError('NOT_FOUND', 404, message);
  }
  static internal(message = 'internal server error'): ApiError {
    return new ApiError('INTERNAL_ERROR', 500, message);
  }
  static unauthorized(message = 'missing or invalid bearer token'): ApiError {
    return new ApiError('UNAUTHORIZED', 401, message);
  }
  static sessionCapacity(message = 'session capacity reached; try again later'): ApiError {
    return new ApiError('SESSION_CAPACITY', 503, message);
  }
}
