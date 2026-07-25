import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessTokenStorageKey } from '../config';
import { sendChatMessage } from './chat';

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('sendChatMessage', () => {
  it('uses the configured API request credentials for the SSE stream', async () => {
    sessionStorage.setItem(accessTokenStorageKey, 'test-browser-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('event: done\ndata: {"message":"Complete"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const events = [];
    for await (const event of sendChatMessage('session-123', 'Investigate')) events.push(event);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-browser-token',
          'X-Session-Id': 'session-123',
        }),
      }),
    );
    expect(events).toEqual([{ type: 'done', data: { message: 'Complete' } }]);
  });
});
