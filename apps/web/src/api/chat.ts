import { parseSseStream } from '../utils/sse';
import { accessTokenStorageKey, apiOrigin } from '../config';
import type {
  ApiErrorBody,
  ChatErrorEventData,
  DoneEventData,
  TokenEventData,
  ToolCallEventData,
  ToolResultEventData,
} from '../types/api';

export class ChatApiError extends Error {
  code: string;
  detail?: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'ChatApiError';
    this.code = code;
    this.detail = detail;
  }
}

export type ChatStreamEvent =
  | { type: 'tool_call'; data: ToolCallEventData }
  | { type: 'tool_result'; data: ToolResultEventData }
  | { type: 'token'; data: TokenEventData }
  | { type: 'done'; data: DoneEventData }
  | { type: 'error'; data: ChatErrorEventData };

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * POST /api/chat returns `text/event-stream`, so it can't use the browser's
 * `EventSource` (GET-only, no body) -- consumed here via `fetch()` +
 * `response.body.getReader()` instead, translating raw SSE frames into typed events.
 *
 * Pre-stream failures (session/precondition errors -- SESSION_NOT_FOUND,
 * NO_LOG_LOADED, CHAT_IN_PROGRESS) arrive as a normal JSON error envelope with a
 * non-2xx status and are thrown as `ChatApiError`. Once the stream has actually
 * opened, every later failure (including a stream that just stops with no `done`/
 * `error` frame) surfaces as a `{ type: 'error' }` event instead, never a thrown
 * exception -- callers should treat both paths as "the turn failed."
 */
export async function* sendChatMessage(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const accessToken = sessionStorage.getItem(accessTokenStorageKey);
  const res = await fetch(`${apiOrigin}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  const contentType = res.headers.get('content-type') ?? '';

  if (!res.ok || !contentType.includes('text/event-stream')) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await res.json()) as ApiErrorBody;
    } catch {
      // fall through to the generic error below
    }
    if (parsed?.error) {
      throw new ChatApiError(parsed.error.code, parsed.error.message, parsed.error.detail);
    }
    throw new ChatApiError('UNKNOWN', `Chat request failed with status ${res.status}`);
  }

  if (!res.body) {
    throw new ChatApiError('UNKNOWN', 'Response had no body to stream.');
  }

  let sawTerminalEvent = false;

  for await (const frame of parseSseStream(res.body)) {
    switch (frame.event) {
      case 'tool_call': {
        const data = safeJsonParse(frame.data) as ToolCallEventData | undefined;
        if (data) yield { type: 'tool_call', data };
        break;
      }
      case 'tool_result': {
        const data = safeJsonParse(frame.data) as ToolResultEventData | undefined;
        if (data) yield { type: 'tool_result', data };
        break;
      }
      case 'token': {
        const data = safeJsonParse(frame.data) as TokenEventData | undefined;
        if (data) yield { type: 'token', data };
        break;
      }
      case 'done': {
        sawTerminalEvent = true;
        const data = safeJsonParse(frame.data) as DoneEventData | undefined;
        yield { type: 'done', data: data ?? { message: '' } };
        break;
      }
      case 'error': {
        sawTerminalEvent = true;
        const data = safeJsonParse(frame.data) as ChatErrorEventData | undefined;
        yield { type: 'error', data: data ?? { code: 'UNKNOWN', message: 'The agent reported an error.' } };
        break;
      }
      default:
        // Unknown/future event name -- ignore rather than crash the stream.
        break;
    }
  }

  if (!sawTerminalEvent) {
    yield {
      type: 'error',
      data: {
        code: 'STREAM_ENDED_EARLY',
        message: 'The response stream ended unexpectedly before completing.',
      },
    };
  }
}
