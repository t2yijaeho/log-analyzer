/**
 * Hand-rolled Server-Sent-Events parser for a POST-initiated stream.
 *
 * The browser's built-in `EventSource` can only issue GET requests, but
 * `POST /api/chat` needs a JSON body -- so the response is consumed manually via
 * `fetch()` + `response.body.getReader()`, decoded, split into frames on a blank
 * line, and parsed into `{ event, data }` pairs.
 */

export interface SseFrame {
  event: string;
  data: string;
}

function parseFrame(raw: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
    // Comment lines (starting ":") and `id:`/`retry:` fields are ignored --
    // this contract doesn't use them.
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/**
 * Reads a ReadableStream<Uint8Array> of `text/event-stream` bytes and yields
 * parsed `{event, data}` frames as they complete. Frames are separated by a
 * blank line (`\n\n`); a trailing partial frame with no closing blank line is
 * still flushed once the stream ends, in case the server didn't send one.
 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex = buffer.indexOf('\n\n');
      while (sepIndex !== -1) {
        const rawFrame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
        sepIndex = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const frame = parseFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}
