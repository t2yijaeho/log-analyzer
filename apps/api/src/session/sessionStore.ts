/**
 * In-memory `Map<sessionId, SessionState>` -- no database. Protected routes require
 * bearer authentication in production. `X-Session-Id` is used instead of a cookie
 * specifically to sidestep SameSite/CORS complications if the frontend and backend
 * ever end up cross-origin.
 */
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../errors/ApiError.js';
import type { SessionState } from './types.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours idle
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const sessions = new Map<string, SessionState>();

export function createSession(): SessionState {
  sweepExpiredSessions();
  if (sessions.size >= config.maxSessions) throw ApiError.sessionCapacity();
  const now = Date.now();
  const state: SessionState = {
    sessionId: randomUUID(),
    createdAt: now,
    lastAccessedAt: now,
    parsedLog: null,
    agentBundle: null,
    chatInProgress: false,
  };
  sessions.set(state.sessionId, state);
  return state;
}

export function getSession(sessionId: string): SessionState | undefined {
  const state = sessions.get(sessionId);
  if (state) state.lastAccessedAt = Date.now();
  return state;
}

/** Reuses `sessionId` if it names a live session; otherwise (missing/unknown id) creates a new one. */
export function getOrCreateSession(sessionId?: string): SessionState {
  if (sessionId) {
    const existing = getSession(sessionId);
    if (existing) return existing;
  }
  return createSession();
}

export function sweepExpiredSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, state] of sessions) {
    if (state.lastAccessedAt < cutoff) sessions.delete(id);
  }
}

let sweepTimer: NodeJS.Timeout | undefined;

export function startSessionSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpiredSessions, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}

export function stopSessionSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}

/** Test/diagnostic helper. */
export function sessionCount(): number {
  return sessions.size;
}

export function clearSessionsForTests(): void {
  if (config.nodeEnv !== 'test') throw new Error('clearSessionsForTests is only available in test mode');
  sessions.clear();
}
