import { Router } from 'express';
import { z } from 'zod';
import { streamChatTurn } from '../agent/streamChat.js';
import { ApiError } from '../errors/ApiError.js';
import { requireAccessToken } from '../middleware/auth.js';
import { getSession } from '../session/sessionStore.js';
import { redactSecrets } from '../utils/redact.js';
import { writeSseEvent } from '../utils/sse.js';
import type { SessionState } from '../session/types.js';

export const chatRouter = Router();

const ChatBody = z.object({
  message: z.string().min(1, 'message is required').max(4_000, 'message is too long'),
});

chatRouter.post('/', requireAccessToken, async (req, res, next) => {
  let session: SessionState | undefined;
  try {
    // ---- Pre-stream validation: normal JSON error responses, correct HTTP status codes ----
    const parsedBody = ChatBody.safeParse(req.body);
    if (!parsedBody.success) throw ApiError.validation('invalid request body', parsedBody.error.flatten());

    const sessionId = req.header('X-Session-Id');
    if (!sessionId) throw ApiError.sessionNotFound('missing X-Session-Id header');
    session = getSession(sessionId);
    if (!session) throw ApiError.sessionNotFound();
    if (!session.parsedLog || !session.agentBundle) throw ApiError.noLogLoaded();
    if (session.chatInProgress) throw ApiError.chatInProgress();

    session.chatInProgress = true;

    // ---- Stream is now committed: from here on, failures are `error` SSE events only, ----
    // ---- never a changed HTTP status (contract: HTTP 200 already sent). ----
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    await streamChatTurn({
      agentBundle: session.agentBundle,
      message: parsedBody.data.message,
      onEvent: (event) => writeSseEvent(res, event),
    });
  } catch (error) {
    if (res.headersSent) {
      // Defensive backstop -- `streamChatTurn` is contracted to never throw and to always
      // emit its own `error` SSE event, but if something upstream of it still slips through
      // after headers were sent, surface it the same way rather than leaving the client hung.
      const message = error instanceof Error ? error.message : 'unknown error';
      writeSseEvent(res, { event: 'error', data: { code: 'AGENT_ERROR', message: redactSecrets(message) } });
    } else {
      next(error);
      return;
    }
  } finally {
    if (session) session.chatInProgress = false;
    if (res.headersSent && !res.writableEnded) res.end();
  }
});
