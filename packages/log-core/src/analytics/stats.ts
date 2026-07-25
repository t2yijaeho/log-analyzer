/**
 * Pure functions over already-parsed/correlated log data. These back both the aggregate
 * fields on `ParsedLog` (computed once, in `log-parser/parseLog.ts`) and the seven agent
 * tools (`agent/tools.ts`), which call these same functions per-turn over the session's
 * cached `ParsedLog`. Every function here is a plain function of its arguments -- no I/O, no
 * session/agent knowledge -- which is what makes them independently unit-testable against
 * hand-built fixtures in `stats.test.ts`.
 */
import type { LogAnomaly, LogEventPair, Outcome, ParsedLog, ParseWarning } from '../log-parser/types.js';
import { OUTCOMES } from '../log-parser/types.js';
import type { LatencyStats } from '../log-parser/types.js';

export function zeroOutcomeCounts(): Record<Outcome, number> {
  return Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<Outcome, number>;
}

export function computeLatencyStats(latencies: number[]): LatencyStats | null {
  if (latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const percentile = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
    return sorted[idx] as number;
  };
  let sum = 0;
  for (const value of sorted) sum += value;
  return {
    count: sorted.length,
    minSeconds: sorted[0] as number,
    maxSeconds: sorted[sorted.length - 1] as number,
    meanSeconds: sum / sorted.length,
    p50Seconds: percentile(0.5),
    p95Seconds: percentile(0.95),
    p99Seconds: percentile(0.99),
  };
}

/**
 * Max concurrent in-flight requests, via a classic interval-sweep. A `PENDING` pair (request
 * with no terminal anywhere in the file) is treated as open through the last known instant
 * in the file (it genuinely was in flight for that whole span) rather than ignored.
 * At an exact tie (one interval's end == another's start), the close is applied first, so two
 * back-to-back-but-non-overlapping intervals don't register a phantom moment of concurrency 2.
 */
export function computeMaxConcurrency(pairs: LogEventPair[]): number {
  if (pairs.length === 0) return 0;

  let fileEnd = 0;
  for (const pair of pairs) {
    const end = pair.terminalElapsedSeconds ?? pair.requestElapsedSeconds;
    if (end > fileEnd) fileEnd = end;
  }

  const deltas: Array<[time: number, delta: number]> = [];
  for (const pair of pairs) {
    const end = pair.terminalElapsedSeconds ?? fileEnd;
    deltas.push([pair.requestElapsedSeconds, 1]);
    deltas.push([end, -1]);
  }
  deltas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let current = 0;
  let max = 0;
  for (const [, delta] of deltas) {
    current += delta;
    if (current > max) max = current;
  }
  return max;
}

export function buildPairIndex(pairs: LogEventPair[]): Map<string, LogEventPair> {
  return new Map(pairs.map((pair) => [pair.id, pair]));
}

// ---- get_log_summary -------------------------------------------------------------------

export interface LogSummary {
  sourceUrl: string;
  totalLines: number;
  parsedLines: number;
  unparsedLines: number;
  pairsCount: number;
  outcomeCounts: Record<Outcome, number>;
  timeRange: ParsedLog['timeRange'];
  latencyStats: ParsedLog['latencyStats'];
  maxConcurrent: number;
  parseQuality: {
    totalParseWarnings: number;
    totalAnomalies: number;
  };
}

export function buildLogSummary(parsedLog: ParsedLog): LogSummary {
  return {
    sourceUrl: parsedLog.sourceUrl,
    totalLines: parsedLog.totalLines,
    parsedLines: parsedLog.parsedLines,
    unparsedLines: parsedLog.unparsedLines,
    pairsCount: parsedLog.pairs.length,
    outcomeCounts: parsedLog.outcomeCounts,
    timeRange: parsedLog.timeRange,
    latencyStats: parsedLog.latencyStats,
    maxConcurrent: parsedLog.concurrency.maxConcurrent,
    parseQuality: {
      totalParseWarnings: parsedLog.totalParseWarnings,
      totalAnomalies: parsedLog.totalAnomalies,
    },
  };
}

// ---- get_stats_for_range ----------------------------------------------------------------

export interface RangeStats {
  rangeStart: number;
  rangeEnd: number;
  overlappingPairCount: number;
  outcomeCounts: Record<Outcome, number>;
  latencyStats: LatencyStats | null;
  sampleIds: string[];
  truncatedSampleIds: boolean;
}

const MAX_RANGE_SAMPLE_IDS = 50;

export function getStatsForRange(pairs: LogEventPair[], start: number, end: number): RangeStats {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const overlapping = pairs.filter((pair) => {
    const pairEnd = pair.terminalElapsedSeconds ?? Infinity;
    return pair.requestElapsedSeconds <= hi && pairEnd >= lo;
  });
  const outcomeCounts = zeroOutcomeCounts();
  const latencies: number[] = [];
  for (const pair of overlapping) {
    outcomeCounts[pair.outcome]++;
    if (pair.latencySeconds !== null) latencies.push(pair.latencySeconds);
  }
  return {
    rangeStart: lo,
    rangeEnd: hi,
    overlappingPairCount: overlapping.length,
    outcomeCounts,
    latencyStats: computeLatencyStats(latencies),
    sampleIds: overlapping.slice(0, MAX_RANGE_SAMPLE_IDS).map((pair) => pair.id),
    truncatedSampleIds: overlapping.length > MAX_RANGE_SAMPLE_IDS,
  };
}

// ---- get_outcome_rate_by_bucket ----------------------------------------------------------

export interface OutcomeBucket {
  bucketStart: number;
  bucketEnd: number;
  outcomeCounts: Record<Outcome, number>;
  total: number;
  errorRate: number;
}

export interface OutcomeRateByBucketResult {
  bucketSeconds: number;
  buckets: OutcomeBucket[];
}

const MAX_BUCKETS = 200;
const MIN_BUCKET_SECONDS = 0.5;
const DEFAULT_BUCKET_SECONDS = 5;

/** Buckets by *terminal* time (when the outcome became known); PENDING pairs have none and are excluded. */
export function getOutcomeRateByBucket(
  pairs: LogEventPair[],
  requestedBucketSeconds?: number,
): OutcomeRateByBucketResult {
  const completed = pairs.filter(
    (pair): pair is LogEventPair & { terminalElapsedSeconds: number } => pair.terminalElapsedSeconds !== null,
  );

  let bucketSeconds = Math.max(MIN_BUCKET_SECONDS, requestedBucketSeconds ?? DEFAULT_BUCKET_SECONDS);

  if (completed.length > 0) {
    let minT = Infinity;
    let maxT = -Infinity;
    for (const pair of completed) {
      if (pair.terminalElapsedSeconds < minT) minT = pair.terminalElapsedSeconds;
      if (pair.terminalElapsedSeconds > maxT) maxT = pair.terminalElapsedSeconds;
    }
    const span = Math.max(maxT - minT, 0);
    const neededBuckets = Math.ceil(span / bucketSeconds) + 1;
    if (neededBuckets > MAX_BUCKETS && span > 0) {
      bucketSeconds = span / MAX_BUCKETS;
    }
  }

  const bucketsByIndex = new Map<number, { outcomeCounts: Record<Outcome, number>; total: number }>();
  for (const pair of completed) {
    const index = Math.floor(pair.terminalElapsedSeconds / bucketSeconds);
    let entry = bucketsByIndex.get(index);
    if (!entry) {
      entry = { outcomeCounts: zeroOutcomeCounts(), total: 0 };
      bucketsByIndex.set(index, entry);
    }
    entry.outcomeCounts[pair.outcome]++;
    entry.total++;
  }

  const sortedIndices = [...bucketsByIndex.keys()].sort((a, b) => a - b);
  const buckets: OutcomeBucket[] = sortedIndices.map((index) => {
    const entry = bucketsByIndex.get(index) as { outcomeCounts: Record<Outcome, number>; total: number };
    const errors = entry.outcomeCounts.ERROR + entry.outcomeCounts.TIMEOUT;
    return {
      bucketStart: index * bucketSeconds,
      bucketEnd: (index + 1) * bucketSeconds,
      outcomeCounts: entry.outcomeCounts,
      total: entry.total,
      errorRate: entry.total > 0 ? errors / entry.total : 0,
    };
  });

  return { bucketSeconds, buckets };
}

// ---- list_outliers -----------------------------------------------------------------------

export interface Outlier {
  id: string;
  requestElapsedSeconds: number;
  terminalElapsedSeconds: number | null;
  latencySeconds: number;
  outcome: Outcome;
}

const MAX_OUTLIERS = 100;
const DEFAULT_OUTLIERS_LIMIT = 10;

export function listOutliers(pairs: LogEventPair[], limit?: number, minLatencySeconds?: number): Outlier[] {
  const cappedLimit = Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_OUTLIERS_LIMIT)), MAX_OUTLIERS);
  const withLatency = pairs.filter(
    (pair): pair is LogEventPair & { latencySeconds: number } =>
      pair.latencySeconds !== null && (minLatencySeconds === undefined || pair.latencySeconds >= minLatencySeconds),
  );
  return withLatency
    .slice()
    .sort((a, b) => b.latencySeconds - a.latencySeconds)
    .slice(0, cappedLimit)
    .map((pair) => ({
      id: pair.id,
      requestElapsedSeconds: pair.requestElapsedSeconds,
      terminalElapsedSeconds: pair.terminalElapsedSeconds,
      latencySeconds: pair.latencySeconds,
      outcome: pair.outcome,
    }));
}

// ---- get_events_near ----------------------------------------------------------------------

const MAX_WINDOW_SECONDS = 60;
const DEFAULT_WINDOW_SECONDS = 5;
const MAX_EVENTS_NEAR_RESULTS = 100;

export interface EventsNearResult {
  center: number;
  windowSeconds: number;
  matchCount: number;
  truncated: boolean;
  matches: LogEventPair[];
}

export function getEventsNear(pairs: LogEventPair[], elapsedSeconds: number, windowSeconds?: number): EventsNearResult {
  const clampedWindow = Math.min(Math.max(0, windowSeconds ?? DEFAULT_WINDOW_SECONDS), MAX_WINDOW_SECONDS);
  const lo = elapsedSeconds - clampedWindow;
  const hi = elapsedSeconds + clampedWindow;
  const matches = pairs.filter((pair) => {
    const inRequestWindow = pair.requestElapsedSeconds >= lo && pair.requestElapsedSeconds <= hi;
    const inTerminalWindow =
      pair.terminalElapsedSeconds !== null && pair.terminalElapsedSeconds >= lo && pair.terminalElapsedSeconds <= hi;
    return inRequestWindow || inTerminalWindow;
  });
  return {
    center: elapsedSeconds,
    windowSeconds: clampedWindow,
    matchCount: matches.length,
    truncated: matches.length > MAX_EVENTS_NEAR_RESULTS,
    matches: matches.slice(0, MAX_EVENTS_NEAR_RESULTS),
  };
}

// ---- list_anomalies -----------------------------------------------------------------------

export interface AnomaliesToolOutput {
  parseWarnings: Array<{ lineNumber: number; reason: string }>;
  totalParseWarnings: number;
  parseWarningsTruncated: boolean;
  anomalies: LogAnomaly[];
  totalAnomalies: number;
  anomaliesTruncated: boolean;
}

const MAX_TOOL_PARSE_WARNINGS = 50;
const MAX_TOOL_ANOMALIES = 100;

/** Strips `ParseWarning.excerpt` (raw log text) before this ever reaches the model -- see types.ts doc comment. */
export function listAnomaliesForTool(parsedLog: ParsedLog): AnomaliesToolOutput {
  const warnings: ParseWarning[] = parsedLog.parseWarnings.slice(0, MAX_TOOL_PARSE_WARNINGS);
  const anomalies = parsedLog.anomalies.slice(0, MAX_TOOL_ANOMALIES);
  return {
    parseWarnings: warnings.map((warning) => ({ lineNumber: warning.lineNumber, reason: warning.reason })),
    totalParseWarnings: parsedLog.totalParseWarnings,
    parseWarningsTruncated: parsedLog.totalParseWarnings > warnings.length,
    anomalies,
    totalAnomalies: parsedLog.totalAnomalies,
    anomaliesTruncated: parsedLog.totalAnomalies > anomalies.length,
  };
}
