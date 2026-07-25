// Shared request/response and SSE contracts for the optional API mode.
import type { ParsedLog } from '@log-analyzer/core';

export interface LogPreset {
  id: string;
  label: string;
  url: string;
}

export interface PresetsResponse {
  presets: LogPreset[];
}

export type LoadLogRequestBody = { url: string } | { fixtureId: string };

export interface LoadLogResponse {
  sessionId: string;
  log: ParsedLog;
}

/** Known error codes from the shared { error: { code, message, detail? } } envelope. */
export type KnownApiErrorCode =
  | 'INVALID_URL'
  | 'FETCH_FAILED'
  | 'RESPONSE_TOO_LARGE'
  | 'UNRECOGNIZED_FORMAT'
  | 'SESSION_NOT_FOUND'
  | 'NO_LOG_LOADED'
  | 'CHAT_IN_PROGRESS'
  | 'UNAUTHORIZED'
  | 'SESSION_CAPACITY';

export interface ApiErrorBody {
  error: {
    code: KnownApiErrorCode | (string & {});
    message: string;
    detail?: unknown;
  };
}

export interface ChatRequestBody {
  message: string;
}

// ---- POST /api/chat SSE event payloads (event: <name>  data: <json>) ----

export interface ToolCallEventData {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ToolResultEventData {
  id: string;
  name: string;
  output: unknown;
}

export interface TokenEventData {
  delta: string;
}

export interface DoneEventData {
  message: string;
}

export interface ChatErrorEventData {
  code: string;
  message: string;
}
