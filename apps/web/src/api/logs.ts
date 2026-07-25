import { apiFetch } from './client';
import type { LoadLogResponse, PresetsResponse } from '../types/api';

export function fetchPresets(signal?: AbortSignal): Promise<PresetsResponse> {
  return apiFetch<PresetsResponse>('/api/logs/presets', { signal });
}

/**
 * Loads a log by URL. `sessionId` is omitted from the request until the server has
 * handed one back at least once (the `X-Session-Id` header is optional per the
 * contract) -- after that, it's sent so the server can attach the reload to the same
 * session rather than minting a new one.
 */
export function loadLog(url: string, sessionId: string | null, signal?: AbortSignal): Promise<LoadLogResponse> {
  return apiFetch<LoadLogResponse>('/api/logs', {
    method: 'POST',
    body: { url },
    headers: sessionId ? { 'X-Session-Id': sessionId } : {},
    signal,
  });
}

export function loadBundledLog(
  fixtureId: string,
  sessionId: string | null,
  signal?: AbortSignal,
): Promise<LoadLogResponse> {
  return apiFetch<LoadLogResponse>('/api/logs', {
    method: 'POST',
    body: { fixtureId },
    headers: sessionId ? { 'X-Session-Id': sessionId } : {},
    signal,
  });
}
