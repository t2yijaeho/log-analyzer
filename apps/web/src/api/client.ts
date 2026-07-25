import type { ApiErrorBody } from '../types/api';
import { accessTokenStorageKey, apiOrigin } from '../config';

/** Thrown for both transport failures and the server's { error: {...} } envelope. */
export class ApiError extends Error {
  code: string;
  status: number;
  detail?: unknown;

  constructor(code: string, message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

/** JSON fetch wrapper for the plain request/response endpoints (presets, load log). */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, signal } = options;

  let res: Response;
  try {
    const accessToken = sessionStorage.getItem(accessTokenStorageKey);
    res = await fetch(`${apiOrigin}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Is it running?', 0, err);
  }

  if (!res.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await res.json()) as ApiErrorBody;
    } catch {
      // Response body wasn't (valid) JSON -- fall through to a generic message below.
    }
    if (parsed?.error) {
      throw new ApiError(parsed.error.code, parsed.error.message, res.status, parsed.error.detail);
    }
    throw new ApiError('UNKNOWN', `Request failed with status ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}
