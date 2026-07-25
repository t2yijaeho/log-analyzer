import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors/ApiError.js';
import { redactSecrets } from '../utils/redact.js';

/**
 * Express 5 error-handling middleware (must take exactly 4 params to be recognized as such).
 * SSE routes (`routes/chat.ts`) commit HTTP 200 before any agent-run failure can occur, so by
 * contract those failures must surface only as an `error` SSE event, never a changed HTTP
 * status/body -- `routes/chat.ts` handles that itself and never calls `next(error)` once
 * streaming has started. The `res.headersSent` guard here is a defensive backstop only.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toJSON());
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error('[unhandled error]', redactSecrets(message));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'internal server error' } });
}
