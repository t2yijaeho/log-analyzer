/**
 * Core data model for the log parser. This is the shared contract between:
 *  - `POST /api/logs` (server -> frontend): the full `ParsedLog` is returned as JSON.
 *  - the agent tool layer (server -> LLM): tools in `agent/tools.ts` operate over
 *    `ParsedLog`/`LogEventPair[]` and return their own (smaller, capped) shapes derived from
 *    it -- the model itself never receives raw log text.
 *
 * Design note on "the agent never sees raw log text": `ParseWarning.excerpt` below *does*
 * carry a capped, sanitized raw-line excerpt, because that's useful for a human looking at
 * the frontend's anomaly panel to see *why* a line failed to parse. The `list_anomalies`
 * agent tool (see `agent/tools.ts` / `analytics/stats.ts#listAnomaliesForTool`) deliberately
 * drops the `excerpt` field before handing parse warnings to the model, so the model only
 * ever sees line numbers + reason strings, never raw log text -- keeping both the letter and
 * the spirit of that rule.
 */

/** The five outcomes a correlated request/terminal pair can resolve to. */
export type Outcome = 'RESPONSE' | 'ERROR' | 'TIMEOUT' | 'PENDING' | 'UNKNOWN';

export const OUTCOMES: readonly Outcome[] = ['RESPONSE', 'ERROR', 'TIMEOUT', 'PENDING', 'UNKNOWN'];

/** A single successfully-parsed line from the log, before correlation. */
export interface RawEvent {
  /** Correlation id, e.g. "sig-0247". Opaque string; no particular prefix/shape is assumed. */
  id: string;
  /** Seconds since the first event in the file (float). The x-axis unit for the whole system. */
  elapsedSeconds: number;
  /** ISO-8601 wall-clock timestamp as parsed from the line, if present and valid; else null. */
  timestamp: string | null;
  /**
   * Upper-cased status token as found on the line, e.g. "REQUEST", "RESPONSE", "ERROR",
   * "TIMEOUT" -- or something else entirely for a non-conforming line (kept verbatim;
   * normalized to an `Outcome` only at correlation time, see `correlate.ts`).
   */
  status: string;
  /** 1-based line number in the source text, for diagnostics. */
  lineNumber: number;
  /** Which parser tier produced this event. */
  tier: 'strict' | 'lenient';
}

export type PairAnomalyType = 'duplicate_request' | 'duplicate_terminal' | 'negative_latency';

export interface PairAnomaly {
  type: PairAnomalyType;
  detail: string;
}

/** A correlated request + terminal event -- the fundamental unit of the visualization. */
export interface LogEventPair {
  id: string;
  requestElapsedSeconds: number;
  requestTimestamp: string | null;
  /** null only when outcome === 'PENDING' (a REQUEST with no terminal event anywhere in the file). */
  terminalElapsedSeconds: number | null;
  terminalTimestamp: string | null;
  outcome: Outcome;
  /** terminalElapsedSeconds - requestElapsedSeconds; null iff PENDING. Can be negative -- see `negative_latency`. */
  latencySeconds: number | null;
  /** Line numbers this pair was built from (request first, then terminal(s) if any), for debugging. */
  lineNumbers: number[];
  anomalies: PairAnomaly[];
}

export type LogAnomalyType = PairAnomalyType | 'missing_request';

/** A file-level structural anomaly surfaced by correlation (as opposed to a line the parser couldn't read at all). */
export interface LogAnomaly {
  type: LogAnomalyType;
  id: string;
  detail: string;
}

/** A line the parser could not extract at least {id, status, a usable time} from. Parsing continues regardless. */
export interface ParseWarning {
  lineNumber: number;
  reason: string;
  /** Capped, control-character-stripped excerpt of the offending line. See file-level doc comment above. */
  excerpt: string;
}

export interface LatencyStats {
  count: number;
  minSeconds: number;
  maxSeconds: number;
  meanSeconds: number;
  p50Seconds: number;
  p95Seconds: number;
  p99Seconds: number;
}

export interface ParsedLog {
  sourceUrl: string;
  fetchedAt: string;
  totalLines: number;
  parsedLines: number;
  strictParsedLines: number;
  lenientParsedLines: number;
  unparsedLines: number;
  pairs: LogEventPair[];
  outcomeCounts: Record<Outcome, number>;
  timeRange: {
    firstElapsedSeconds: number | null;
    lastElapsedSeconds: number | null;
    durationSeconds: number | null;
    firstTimestamp: string | null;
    lastTimestamp: string | null;
  };
  latencyStats: {
    overall: LatencyStats | null;
    byOutcome: Partial<Record<Outcome, LatencyStats>>;
  };
  concurrency: {
    maxConcurrent: number;
  };
  /** Capped (see MAX_PARSE_WARNINGS in parseLog.ts); `totalParseWarnings` holds the true count. */
  parseWarnings: ParseWarning[];
  totalParseWarnings: number;
  /** Capped (see MAX_ANOMALIES in parseLog.ts); `totalAnomalies` holds the true count. */
  anomalies: LogAnomaly[];
  totalAnomalies: number;
}
