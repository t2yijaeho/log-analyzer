/**
 * Correlation: a single pass over every parsed event in the file, building a full
 * id -> {requests, terminals} map (events are interleaved across ids throughout a real file,
 * never adjacent line pairs -- correlation must see the whole file before it can pair
 * anything up), then converts that map into `LogEventPair[]` plus a flat list of structural
 * `LogAnomaly`s.
 */
import type { LogAnomaly, LogEventPair, Outcome, PairAnomaly, RawEvent } from './types.js';

const KNOWN_TERMINAL_OUTCOMES: ReadonlySet<string> = new Set(['RESPONSE', 'ERROR', 'TIMEOUT']);

interface IdBucket {
  requests: RawEvent[];
  terminals: RawEvent[];
}

export interface CorrelationResult {
  pairs: LogEventPair[];
  anomalies: LogAnomaly[];
}

export function correlate(events: RawEvent[]): CorrelationResult {
  const byId = new Map<string, IdBucket>();

  for (const event of events) {
    let bucket = byId.get(event.id);
    if (!bucket) {
      bucket = { requests: [], terminals: [] };
      byId.set(event.id, bucket);
    }
    if (event.status === 'REQUEST') {
      bucket.requests.push(event);
    } else {
      bucket.terminals.push(event);
    }
  }

  const pairs: LogEventPair[] = [];
  const anomalies: LogAnomaly[] = [];

  for (const [id, bucket] of byId) {
    // Sort defensively by elapsed time -- events should already be in file order, but
    // correlation must not assume that (a lenient-parsed file could have any line order).
    const requests = [...bucket.requests].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
    const terminals = [...bucket.terminals].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

    if (requests.length === 0) {
      // Terminal event(s) with no matching REQUEST anywhere in the file. Not a pair -- there
      // is no start time to anchor a lifespan bar to -- recorded as an anomaly instead.
      for (const terminal of terminals) {
        anomalies.push({
          type: 'missing_request',
          id,
          detail: `${terminal.status} at t=${terminal.elapsedSeconds.toFixed(3)}s (line ${terminal.lineNumber}) has no matching REQUEST anywhere in the file`,
        });
      }
      continue;
    }

    const canonicalRequest = requests[0] as RawEvent;
    for (let i = 1; i < requests.length; i++) {
      const extra = requests[i] as RawEvent;
      anomalies.push({
        type: 'duplicate_request',
        id,
        detail: `extra REQUEST at t=${extra.elapsedSeconds.toFixed(3)}s (line ${extra.lineNumber}); using the earliest REQUEST as canonical`,
      });
    }

    const lineNumbers = [canonicalRequest.lineNumber];
    const pairAnomalies: PairAnomaly[] = [];

    let outcome: Outcome = 'PENDING';
    let terminalElapsedSeconds: number | null = null;
    let terminalTimestamp: string | null = null;
    let latencySeconds: number | null = null;

    if (terminals.length > 0) {
      const canonicalTerminal = terminals[0] as RawEvent;
      lineNumbers.push(canonicalTerminal.lineNumber);
      outcome = KNOWN_TERMINAL_OUTCOMES.has(canonicalTerminal.status)
        ? (canonicalTerminal.status as Outcome)
        : 'UNKNOWN';
      terminalElapsedSeconds = canonicalTerminal.elapsedSeconds;
      terminalTimestamp = canonicalTerminal.timestamp;
      latencySeconds = terminalElapsedSeconds - canonicalRequest.elapsedSeconds;

      if (latencySeconds < 0) {
        const detail = `terminal at t=${terminalElapsedSeconds.toFixed(3)}s precedes its own request at t=${canonicalRequest.elapsedSeconds.toFixed(3)}s (latency ${latencySeconds.toFixed(3)}s)`;
        pairAnomalies.push({ type: 'negative_latency', detail });
        anomalies.push({ type: 'negative_latency', id, detail });
      }

      for (let i = 1; i < terminals.length; i++) {
        const extra = terminals[i] as RawEvent;
        lineNumbers.push(extra.lineNumber);
        const detail = `extra ${extra.status} at t=${extra.elapsedSeconds.toFixed(3)}s (line ${extra.lineNumber}); using the earliest terminal as canonical`;
        pairAnomalies.push({ type: 'duplicate_terminal', detail });
        anomalies.push({ type: 'duplicate_terminal', id, detail });
      }
    }

    pairs.push({
      id,
      requestElapsedSeconds: canonicalRequest.elapsedSeconds,
      requestTimestamp: canonicalRequest.timestamp,
      terminalElapsedSeconds,
      terminalTimestamp,
      outcome,
      latencySeconds,
      lineNumbers,
      anomalies: pairAnomalies,
    });
  }

  // Stable, deterministic ordering for API responses / tests / the frontend's viz: by request time.
  pairs.sort((a, b) => a.requestElapsedSeconds - b.requestElapsedSeconds);

  return { pairs, anomalies };
}
