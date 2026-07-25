/**
 * Two-tier per-line parsing.
 *
 * Tier 1 (strict) matches the exact known `api_signal` line shape:
 *   [   37.767000] api_signal: id=sig-0247 timestamp=2026-06-08T23:10:37.767 status=ERROR
 * It is deliberately tolerant of incidental whitespace-width/decimal-digit-count variation
 * (the bracket padding, and the number of fractional digits) since that's formatting, not
 * structure -- but strict about the field order, the `api_signal:` literal, and the
 * `id=`/`timestamp=`/`status=` keys all being present.
 *
 * Tier 2 (lenient) is only attempted when tier 1 fails. It scans whitespace-delimited
 * `key=value` tokens anywhere on the line (ignoring order and any other literal text) and
 * separately looks for a `[<number>]` bracket anywhere in the line. It succeeds if at least
 * `id` and `status` are found; `timestamp`/the bracket are opportunistic. Resolving a final
 * `elapsedSeconds` for a lenient line that found a timestamp but no bracket requires
 * cross-line context (an anchor derived from strict-tier lines), which this function
 * deliberately does not have -- that resolution happens once, file-wide, in `parseLog.ts`.
 */
const STRICT_LINE_RE =
  /^\[\s*(\d+(?:\.\d+)?)\s*\]\s*api_signal:\s*id=(\S+)\s+timestamp=(\S+)\s+status=(\S+)\s*$/;

const KEY_VALUE_TOKEN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/;
const LEADING_BRACKET_RE = /\[\s*(\d+(?:\.\d+)?)\s*\]/;

export interface LineParseSuccess {
  ok: true;
  tier: 'strict' | 'lenient';
  id: string;
  status: string;
  /** Present when the line itself carried a `[elapsed]` bracket (tier 1 always; tier 2 sometimes). */
  elapsedSecondsRaw: number | null;
  /** Present when a `timestamp=` token was found and it parses as a valid date. */
  timestampRaw: string | null;
}

export interface LineParseFailure {
  ok: false;
  reason: string;
}

export type LineParseResult = LineParseSuccess | LineParseFailure;

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function parseStrict(line: string): LineParseSuccess | null {
  const match = STRICT_LINE_RE.exec(line);
  if (!match) return null;
  const elapsedStr = match[1] as string;
  const id = match[2] as string;
  const timestamp = match[3] as string;
  const status = match[4] as string;
  const elapsedSeconds = Number(elapsedStr);
  if (!Number.isFinite(elapsedSeconds)) return null;
  return {
    ok: true,
    tier: 'strict',
    id,
    status: status.toUpperCase(),
    elapsedSecondsRaw: elapsedSeconds,
    timestampRaw: isValidTimestamp(timestamp) ? timestamp : null,
  };
}

function parseLenient(line: string): LineParseResult {
  const tokens = line.trim().split(/\s+/);
  const kv = new Map<string, string>();
  for (const token of tokens) {
    const m = KEY_VALUE_TOKEN_RE.exec(token);
    if (m) {
      const key = (m[1] as string).toLowerCase();
      const value = m[2] as string;
      if (!kv.has(key)) kv.set(key, value);
    }
  }
  const id = kv.get('id');
  const status = kv.get('status');
  if (!id || !status) {
    return { ok: false, reason: 'no recognizable id= / status= tokens found' };
  }
  const timestamp = kv.get('timestamp');
  const bracketMatch = LEADING_BRACKET_RE.exec(line);
  return {
    ok: true,
    tier: 'lenient',
    id,
    status: status.toUpperCase(),
    elapsedSecondsRaw: bracketMatch ? Number(bracketMatch[1]) : null,
    timestampRaw: timestamp && isValidTimestamp(timestamp) ? timestamp : null,
  };
}

/** Parses one non-blank log line. Never throws. */
export function parseLine(line: string): LineParseResult {
  const strict = parseStrict(line);
  if (strict) return strict;
  return parseLenient(line);
}
