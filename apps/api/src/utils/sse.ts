import type { Response } from 'express';

export type ServerSentEventName = 'tool_call' | 'tool_result' | 'token' | 'done' | 'error';

export interface ServerSentEventFrame {
  event: ServerSentEventName;
  data: unknown;
}

/**
 * Writes one `event:`/`data:` SSE frame. `JSON.stringify` always escapes embedded newlines
 * within the JSON string it produces, so this can never accidentally emit a bare `\n\n`
 * inside `data:` that would corrupt the client's frame-splitting.
 */
export function writeSseEvent(res: Response, frame: ServerSentEventFrame): void {
  res.write(`event: ${frame.event}\n`);
  res.write(`data: ${JSON.stringify(frame.data)}\n\n`);
}
