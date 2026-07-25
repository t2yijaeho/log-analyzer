import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { RATE_LIMITS, createApp } from './app.js';
import { config } from './config.js';
import { ApiError } from './errors/ApiError.js';
import { fetchLog, validateLogUrl } from './log-parser/fetchLog.js';
import { clearSessionsForTests, createSession, sessionCount } from './session/sessionStore.js';

const AUTH = { Authorization: 'Bearer test-access-token' };

test('public endpoints stay public while mutation endpoints require a bearer token', async () => {
  const app = createApp();
  assert.equal((await request(app).get('/api/health')).status, 200);
  const presets = await request(app).get('/api/logs/presets');
  assert.equal(presets.status, 200);
  assert.equal(presets.body.presets.length, 3);
  assert.equal((await request(app).post('/api/logs').send({ url: 'https://example.com/a.log' })).status, 401);
  assert.equal((await request(app).post('/api/chat').send({ message: 'hello' })).status, 401);
});

test('bundled samples load from committed fixtures without a remote fetch', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network fetch should not run for bundled fixtures');
  };
  try {
    const response = await request(createApp()).post('/api/logs').set(AUTH).send({ fixtureId: 'signal3' });
    assert.equal(response.status, 200);
    assert.equal(response.body.log.pairs.length, 500);
    assert.equal(response.body.log.latencyStats.overall.p99Seconds, 14.5);
  } finally {
    globalThis.fetch = originalFetch;
    clearSessionsForTests();
  }
});

test('input limits are enforced before network or agent work', async () => {
  const app = createApp();
  const longUrl = `https://raw.githubusercontent.com/${'x'.repeat(2_100)}`;
  const logResponse = await request(app).post('/api/logs').set(AUTH).send({ url: longUrl });
  assert.equal(logResponse.status, 400);
  assert.equal(logResponse.body.error.code, 'VALIDATION_ERROR');

  const chatResponse = await request(app)
    .post('/api/chat')
    .set(AUTH)
    .set('X-Session-Id', 'missing')
    .send({ message: 'x'.repeat(4_001) });
  assert.equal(chatResponse.status, 400);
  assert.equal(chatResponse.body.error.code, 'VALIDATION_ERROR');
});

test('URL policy rejects credentials, IP literals, and non-allowlisted hosts', () => {
  assert.equal(validateLogUrl('https://raw.githubusercontent.com/example/a.log').hostname, 'raw.githubusercontent.com');
  for (const url of [
    'https://user:pass@raw.githubusercontent.com/a.log',
    'https://127.0.0.1/a.log',
    'https://example.com/a.log',
  ]) {
    assert.throws(() => validateLogUrl(url), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_URL');
  }
});

test('redirect targets are revalidated before the next request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } });
  try {
    await assert.rejects(
      fetchLog('https://raw.githubusercontent.com/example/a.log'),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_URL',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('session storage is bounded', () => {
  clearSessionsForTests();
  const previous = config.maxSessions;
  config.maxSessions = 1;
  try {
    createSession();
    assert.equal(sessionCount(), 1);
    assert.throws(() => createSession(), (error: unknown) => error instanceof ApiError && error.code === 'SESSION_CAPACITY');
  } finally {
    config.maxSessions = previous;
    clearSessionsForTests();
  }
});

test('rate-limit policy keeps chat stricter than general API traffic', async () => {
  assert.ok(RATE_LIMITS.chat.limit < RATE_LIMITS.general.limit);
  assert.ok(RATE_LIMITS.chat.windowMs < RATE_LIMITS.general.windowMs);

  const app = createApp({ skipRateLimit: false, generalLimit: 2 });
  assert.equal((await request(app).get('/api/health')).status, 200);
  assert.equal((await request(app).get('/api/health')).status, 200);
  assert.equal((await request(app).get('/api/health')).status, 429);
});
