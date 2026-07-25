import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogEventPair, Outcome, ParsedLog } from '../log-parser/types.js';
import {
  buildLogSummary,
  buildPairIndex,
  computeLatencyStats,
  computeMaxConcurrency,
  getEventsNear,
  getOutcomeRateByBucket,
  getStatsForRange,
  listAnomaliesForTool,
  listOutliers,
  zeroOutcomeCounts,
} from './stats.js';

function pair(overrides: Partial<LogEventPair> & { id: string }): LogEventPair {
  return {
    requestElapsedSeconds: 0,
    requestTimestamp: null,
    terminalElapsedSeconds: null,
    terminalTimestamp: null,
    outcome: 'RESPONSE',
    latencySeconds: null,
    lineNumbers: [],
    anomalies: [],
    ...overrides,
  };
}

/** A completed pair with request/terminal times and an outcome; latency is derived. */
function completed(id: string, start: number, end: number, outcome: Outcome = 'RESPONSE'): LogEventPair {
  return pair({
    id,
    requestElapsedSeconds: start,
    terminalElapsedSeconds: end,
    outcome,
    latencySeconds: end - start,
  });
}

function pending(id: string, start: number): LogEventPair {
  return pair({ id, requestElapsedSeconds: start, terminalElapsedSeconds: null, outcome: 'PENDING', latencySeconds: null });
}

// ---- zeroOutcomeCounts ---------------------------------------------------------------------

test('zeroOutcomeCounts: all five outcomes present at zero', () => {
  const counts = zeroOutcomeCounts();
  assert.deepEqual(counts, { RESPONSE: 0, ERROR: 0, TIMEOUT: 0, PENDING: 0, UNKNOWN: 0 });
});

// ---- computeLatencyStats -------------------------------------------------------------------

test('computeLatencyStats: null for an empty array', () => {
  assert.equal(computeLatencyStats([]), null);
});

test('computeLatencyStats: count/min/max/mean/percentiles over a clean 1..10 sample', () => {
  const stats = computeLatencyStats([10, 3, 1, 7, 5, 6, 2, 9, 4, 8]); // shuffled 1..10
  assert.ok(stats);
  assert.equal(stats?.count, 10);
  assert.equal(stats?.minSeconds, 1);
  assert.equal(stats?.maxSeconds, 10);
  assert.equal(stats?.meanSeconds, 5.5);
  // sorted = [1..10] (0-indexed); p50 -> idx floor(0.5*9)=4 -> value 5
  assert.equal(stats?.p50Seconds, 5);
  // p95 -> idx floor(0.95*9)=floor(8.55)=8 -> value 9
  assert.equal(stats?.p95Seconds, 9);
  // p99 -> idx floor(0.99*9)=floor(8.91)=8 -> value 9
  assert.equal(stats?.p99Seconds, 9);
});

test('computeLatencyStats: single value collapses every percentile to that value', () => {
  const stats = computeLatencyStats([42]);
  assert.ok(stats);
  assert.equal(stats?.count, 1);
  assert.equal(stats?.minSeconds, 42);
  assert.equal(stats?.maxSeconds, 42);
  assert.equal(stats?.p50Seconds, 42);
  assert.equal(stats?.p95Seconds, 42);
  assert.equal(stats?.p99Seconds, 42);
});

// ---- computeMaxConcurrency -----------------------------------------------------------------

test('computeMaxConcurrency: 0 for no pairs', () => {
  assert.equal(computeMaxConcurrency([]), 0);
});

test('computeMaxConcurrency: counts true overlaps, treats a tie (close-then-open) as non-overlapping', () => {
  const pairs = [completed('a', 0, 5), completed('b', 5, 10)];
  // b opens exactly when a closes -- should never register concurrency 2.
  assert.equal(computeMaxConcurrency(pairs), 1);
});

test('computeMaxConcurrency: nested/overlapping intervals plus a PENDING pair extended to file-end', () => {
  const pairs = [
    completed('a', 0, 10),
    completed('b', 2, 5),
    completed('c', 4, 12),
    completed('d', 20, 25),
    pending('e', 4), // no terminal -- should be treated as open through the file's last known instant (25)
  ];
  // At t=4: a, b, c, e are all simultaneously open => 4.
  assert.equal(computeMaxConcurrency(pairs), 4);
});

// ---- buildPairIndex -------------------------------------------------------------------------

test('buildPairIndex: id -> pair, last-write-wins on duplicate ids (should not occur in practice)', () => {
  const pairs = [completed('a', 0, 1), completed('b', 0, 1)];
  const index = buildPairIndex(pairs);
  assert.equal(index.size, 2);
  assert.equal(index.get('a')?.id, 'a');
  assert.equal(index.get('missing'), undefined);
});

// ---- getStatsForRange -----------------------------------------------------------------------

test('getStatsForRange: only counts pairs overlapping the window, including a still-open PENDING pair', () => {
  const pairs = [
    completed('early', 0, 2), // ends before the window -- excluded
    completed('spanning', 8, 20), // starts before, ends inside -- included
    completed('inside', 12, 14, 'ERROR'), // fully inside -- included
    pending('open-ended', 25), // starts inside, never closes -- included (open interval reaches +Infinity)
    completed('late', 40, 42), // starts after the window -- excluded
  ];
  const result = getStatsForRange(pairs, 10, 30);
  assert.equal(result.rangeStart, 10);
  assert.equal(result.rangeEnd, 30);
  assert.equal(result.overlappingPairCount, 3);
  assert.deepEqual(result.outcomeCounts, { RESPONSE: 1, ERROR: 1, TIMEOUT: 0, PENDING: 1, UNKNOWN: 0 });
  assert.deepEqual(result.sampleIds.slice().sort(), ['inside', 'open-ended', 'spanning']);
  // Only 2 of the 3 overlapping pairs have a resolvable latency (the PENDING one does not).
  assert.equal(result.latencyStats?.count, 2);
});

test('getStatsForRange: normalizes a reversed (end < start) input', () => {
  const pairs = [completed('a', 5, 6)];
  const result = getStatsForRange(pairs, 100, 0);
  assert.equal(result.rangeStart, 0);
  assert.equal(result.rangeEnd, 100);
  assert.equal(result.overlappingPairCount, 1);
});

// ---- getOutcomeRateByBucket -----------------------------------------------------------------

test('getOutcomeRateByBucket: buckets by terminal time and computes an error rate per bucket', () => {
  const pairs = [
    completed('a', 0, 1, 'RESPONSE'),
    completed('b', 0, 2, 'RESPONSE'),
    completed('c', 0, 3, 'ERROR'),
    completed('d', 0, 11, 'ERROR'),
    completed('e', 0, 12, 'TIMEOUT'),
    pending('f', 0), // no terminal -- excluded from bucketing entirely
  ];
  const result = getOutcomeRateByBucket(pairs, 10);
  assert.equal(result.bucketSeconds, 10);
  assert.equal(result.buckets.length, 2);

  const bucket0 = result.buckets.find((b) => b.bucketStart === 0);
  assert.ok(bucket0);
  assert.equal(bucket0?.total, 3);
  assert.deepEqual(bucket0?.outcomeCounts, { RESPONSE: 2, ERROR: 1, TIMEOUT: 0, PENDING: 0, UNKNOWN: 0 });
  assert.ok(Math.abs((bucket0?.errorRate ?? -1) - 1 / 3) < 1e-9);

  const bucket1 = result.buckets.find((b) => b.bucketStart === 10);
  assert.ok(bucket1);
  assert.equal(bucket1?.total, 2);
  assert.deepEqual(bucket1?.outcomeCounts, { RESPONSE: 0, ERROR: 1, TIMEOUT: 1, PENDING: 0, UNKNOWN: 0 });
  assert.equal(bucket1?.errorRate, 1);
});

test('getOutcomeRateByBucket: auto-widens an unreasonably small bucket width to stay bounded', () => {
  const pairs = Array.from({ length: 50 }, (_, i) => completed(`p${i}`, 0, i * 10));
  // Requesting 0.001s buckets across a 0-490s span would naively need ~490,000 buckets.
  const result = getOutcomeRateByBucket(pairs, 0.001);
  assert.ok(result.bucketSeconds > 0.001, 'bucketSeconds should have been widened');
  assert.ok(result.buckets.length <= 200);
});

test('getOutcomeRateByBucket: empty input yields an empty (not throwing) result', () => {
  const result = getOutcomeRateByBucket([], 5);
  assert.deepEqual(result.buckets, []);
  assert.equal(result.bucketSeconds, 5);
});

// ---- listOutliers ---------------------------------------------------------------------------

test('listOutliers: sorts descending by latency and respects limit/minLatencySeconds', () => {
  const pairs = [
    completed('slow', 0, 100),
    completed('medium', 0, 50),
    completed('fast', 0, 1),
    pending('open', 0), // no latency -- must never appear in outliers
  ];
  const top2 = listOutliers(pairs, 2);
  assert.deepEqual(top2.map((o) => o.id), ['slow', 'medium']);

  const filtered = listOutliers(pairs, 10, 60);
  assert.deepEqual(filtered.map((o) => o.id), ['slow']);
});

test('listOutliers: hard-caps the limit regardless of what is requested', () => {
  const pairs = Array.from({ length: 150 }, (_, i) => completed(`p${i}`, 0, i + 1));
  const result = listOutliers(pairs, 10_000);
  assert.ok(result.length <= 100);
});

// ---- getEventsNear --------------------------------------------------------------------------

test('getEventsNear: matches on either request or terminal falling inside the window', () => {
  const pairs = [
    completed('request-in-window', 10, 999), // request at 10 is inside [8,12]
    completed('terminal-in-window', -500, 11), // terminal at 11 is inside [8,12]
    completed('far-away', 500, 600),
  ];
  const result = getEventsNear(pairs, 10, 2);
  assert.equal(result.windowSeconds, 2);
  assert.equal(result.matchCount, 2);
  assert.deepEqual(
    result.matches.map((m) => m.id).sort(),
    ['request-in-window', 'terminal-in-window'],
  );
});

test('getEventsNear: clamps an oversized window and truncates an oversized result set', () => {
  const pairs = Array.from({ length: 150 }, (_, i) => completed(`p${i}`, 0, 0));
  const result = getEventsNear(pairs, 0, 10_000);
  assert.ok(result.windowSeconds <= 60);
  assert.equal(result.truncated, true);
  assert.equal(result.matches.length, 100);
  assert.equal(result.matchCount, 150);
});

// ---- listAnomaliesForTool / buildLogSummary --------------------------------------------------

function makeParsedLogFixture(): ParsedLog {
  return {
    sourceUrl: 'https://example.invalid/x.log',
    fetchedAt: new Date(0).toISOString(),
    totalLines: 10,
    parsedLines: 8,
    strictParsedLines: 8,
    lenientParsedLines: 0,
    unparsedLines: 2,
    pairs: [completed('a', 0, 1)],
    outcomeCounts: { RESPONSE: 1, ERROR: 0, TIMEOUT: 0, PENDING: 0, UNKNOWN: 0 },
    timeRange: {
      firstElapsedSeconds: 0,
      lastElapsedSeconds: 1,
      durationSeconds: 1,
      firstTimestamp: null,
      lastTimestamp: null,
    },
    latencyStats: { overall: computeLatencyStats([1]), byOutcome: {} },
    concurrency: { maxConcurrent: 1 },
    parseWarnings: [
      { lineNumber: 3, reason: 'no recognizable id=/status= tokens found', excerpt: 'SENSITIVE RAW TEXT' },
    ],
    totalParseWarnings: 2,
    anomalies: [{ type: 'missing_request', id: 'orphan-1', detail: 'RESPONSE with no request' }],
    totalAnomalies: 1,
  };
}

test('listAnomaliesForTool: strips raw-line excerpts before the data reaches the model', () => {
  const output = listAnomaliesForTool(makeParsedLogFixture());
  assert.equal(output.parseWarnings.length, 1);
  assert.equal(output.parseWarnings[0]?.lineNumber, 3);
  assert.ok(!('excerpt' in (output.parseWarnings[0] as object)), 'excerpt must not leak into the tool output');
  assert.equal(output.totalParseWarnings, 2);
  // totalParseWarnings (2) > warnings actually returned (1) after the (fixture's contrived) cap.
  assert.equal(output.parseWarningsTruncated, true);
  assert.equal(output.anomalies.length, 1);
  assert.equal(output.anomaliesTruncated, false);
});

test('buildLogSummary: strips the heavy pairs array but keeps every summary field', () => {
  const summary = buildLogSummary(makeParsedLogFixture());
  assert.equal(summary.pairsCount, 1);
  assert.ok(!('pairs' in summary));
  assert.equal(summary.totalLines, 10);
  assert.equal(summary.parseQuality.totalParseWarnings, 2);
  assert.equal(summary.parseQuality.totalAnomalies, 1);
  assert.equal(summary.maxConcurrent, 1);
});
