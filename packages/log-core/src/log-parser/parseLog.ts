/**
 * Orchestrates the full parse pipeline: split into lines -> per-line parse (parseLine.ts,
 * two-tier) -> resolve a wall-clock-to-elapsed-seconds anchor for any lenient lines that
 * found a timestamp but no `[elapsed]` bracket of their own -> correlate.ts -> aggregate
 * stats (analytics/stats.ts). Runs once per `POST /api/logs`; the result is cached in
 * `SessionState` and the agent's tools (`agent/tools.ts`) only ever read it -- they never
 * re-parse or re-fetch.
 */
import { computeLatencyStats, computeMaxConcurrency, zeroOutcomeCounts } from '../analytics/stats.js';
import { LogParseError } from '../errors.js';
import { correlate } from './correlate.js';
import { parseLine } from './parseLine.js';
import type { LatencyStats, Outcome, ParsedLog, ParseWarning, RawEvent } from './types.js';

const MAX_PARSE_WARNINGS = 50;
const MAX_ANOMALIES = 200;
const EXCERPT_MAX_LENGTH = 200;

interface Candidate {
  lineNumber: number;
  tier: 'strict' | 'lenient';
  id: string;
  status: string;
  elapsedSecondsRaw: number | null;
  timestampRaw: string | null;
}

function sanitizeExcerpt(line: string): string {
  // Strip control characters (keep the line human-readable in a UI); cap length.
  // eslint-disable-next-line no-control-regex
  const stripped = line.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '');
  return stripped.length > EXCERPT_MAX_LENGTH ? `${stripped.slice(0, EXCERPT_MAX_LENGTH)}…` : stripped;
}

/**
 * Resolves a wall-clock epoch-ms instant that corresponds to elapsedSeconds === 0, so that
 * lenient-tier lines carrying a `timestamp=` but no bracket can be placed on the *same* time
 * axis as strict-tier lines. Preferred anchor: derived from lines that have both a bracket
 * and a timestamp (their bracket value is authoritative). Fallback (only reachable if the
 * file has no bracket-bearing lines at all): the earliest timestamp seen, anywhere.
 */
function resolveAnchorEpochMs(candidates: Candidate[]): number | null {
  let anchor: number | null = null;
  for (const candidate of candidates) {
    if (candidate.elapsedSecondsRaw !== null && candidate.timestampRaw !== null) {
      const epochMs = Date.parse(candidate.timestampRaw) - candidate.elapsedSecondsRaw * 1000;
      if (anchor === null || epochMs < anchor) anchor = epochMs;
    }
  }
  if (anchor !== null) return anchor;

  for (const candidate of candidates) {
    if (candidate.timestampRaw !== null) {
      const epochMs = Date.parse(candidate.timestampRaw);
      if (anchor === null || epochMs < anchor) anchor = epochMs;
    }
  }
  return anchor;
}

export function parseLog(rawText: string, sourceUrl: string): ParsedLog {
  const rawLines = rawText.split(/\r\n|\r|\n/);
  const nonBlankLines = rawLines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0);

  const candidates: Candidate[] = [];
  const parseWarnings: ParseWarning[] = [];
  let totalParseWarnings = 0;

  for (const { line, lineNumber } of nonBlankLines) {
    const result = parseLine(line);
    if (result.ok) {
      candidates.push({ lineNumber, ...result });
    } else {
      totalParseWarnings++;
      if (parseWarnings.length < MAX_PARSE_WARNINGS) {
        parseWarnings.push({ lineNumber, reason: result.reason, excerpt: sanitizeExcerpt(line) });
      }
    }
  }

  const anchorEpochMs = resolveAnchorEpochMs(candidates);

  const events: RawEvent[] = [];
  for (const candidate of candidates) {
    let elapsedSeconds = candidate.elapsedSecondsRaw;
    if (elapsedSeconds === null && candidate.timestampRaw !== null && anchorEpochMs !== null) {
      elapsedSeconds = (Date.parse(candidate.timestampRaw) - anchorEpochMs) / 1000;
    }
    if (elapsedSeconds === null) {
      // No time information could be derived at all -- demote to a warning rather than
      // fabricate a time. Every downstream tool/visualization is fundamentally time-based.
      totalParseWarnings++;
      if (parseWarnings.length < MAX_PARSE_WARNINGS) {
        parseWarnings.push({
          lineNumber: candidate.lineNumber,
          reason: 'no [elapsed] bracket and no usable timestamp= -- cannot place this event in time',
          excerpt: sanitizeExcerpt(rawLines[candidate.lineNumber - 1] ?? ''),
        });
      }
      continue;
    }
    events.push({
      id: candidate.id,
      elapsedSeconds,
      timestamp: candidate.timestampRaw,
      status: candidate.status,
      lineNumber: candidate.lineNumber,
      tier: candidate.tier,
    });
  }

  if (events.length === 0) {
    throw new LogParseError(
      `found no recognizable log lines among ${nonBlankLines.length} non-blank line(s) fetched from the source`,
    );
  }

  // Invariant (exercised in parseLog.test.ts): every non-blank line ends up either as an
  // event or as exactly one counted parse warning.
  const strictParsedLines = events.reduce((count, event) => (event.tier === 'strict' ? count + 1 : count), 0);
  const lenientParsedLines = events.length - strictParsedLines;

  const { pairs, anomalies: allAnomalies } = correlate(events);
  const totalAnomalies = allAnomalies.length;
  const anomalies = allAnomalies.slice(0, MAX_ANOMALIES);

  const outcomeCounts = zeroOutcomeCounts();
  for (const pair of pairs) outcomeCounts[pair.outcome]++;

  // Single pass for first/last event -- deliberately not `Math.min/max(...spread)`, which
  // can blow the call stack on very large (multi-hundred-thousand-line) files.
  let firstEvent = events[0] as RawEvent;
  let lastEvent = events[0] as RawEvent;
  for (const event of events) {
    if (event.elapsedSeconds < firstEvent.elapsedSeconds) firstEvent = event;
    if (event.elapsedSeconds > lastEvent.elapsedSeconds) lastEvent = event;
  }

  const latenciesByOutcome = new Map<Outcome, number[]>();
  const allLatencies: number[] = [];
  for (const pair of pairs) {
    if (pair.latencySeconds === null) continue;
    allLatencies.push(pair.latencySeconds);
    const list = latenciesByOutcome.get(pair.outcome);
    if (list) list.push(pair.latencySeconds);
    else latenciesByOutcome.set(pair.outcome, [pair.latencySeconds]);
  }

  const byOutcome: Partial<Record<Outcome, LatencyStats>> = {};
  for (const [outcome, latencies] of latenciesByOutcome) {
    const stats = computeLatencyStats(latencies);
    if (stats) byOutcome[outcome] = stats;
  }

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    totalLines: nonBlankLines.length,
    parsedLines: strictParsedLines + lenientParsedLines,
    strictParsedLines,
    lenientParsedLines,
    unparsedLines: totalParseWarnings,
    pairs,
    outcomeCounts,
    timeRange: {
      firstElapsedSeconds: firstEvent.elapsedSeconds,
      lastElapsedSeconds: lastEvent.elapsedSeconds,
      durationSeconds: lastEvent.elapsedSeconds - firstEvent.elapsedSeconds,
      firstTimestamp: firstEvent.timestamp,
      lastTimestamp: lastEvent.timestamp,
    },
    latencyStats: {
      overall: computeLatencyStats(allLatencies),
      byOutcome,
    },
    concurrency: {
      maxConcurrent: computeMaxConcurrency(pairs),
    },
    parseWarnings,
    totalParseWarnings,
    anomalies,
    totalAnomalies,
  };
}
