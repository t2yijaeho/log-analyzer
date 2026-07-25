import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parseLog } from './parseLog.js';

const FIXTURES_DIR = path.resolve(import.meta.dirname, '..', '..', 'fixtures');

function readFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

// ---- Real default log #1: api_signal1.log -- a "clean" run, only REQUEST/RESPONSE --------

test('parseLog: api_signal1.log (real fixture) parses cleanly with the expected shape', () => {
  const text = readFixture('api_signal1.log');
  const log = parseLog(text, 'https://raw.githubusercontent.com/uoio8090/api_log/main/api_signal1.log');

  assert.equal(log.totalLines, 1000);
  assert.equal(log.unparsedLines, 0);
  assert.equal(log.totalParseWarnings, 0);
  assert.equal(log.strictParsedLines, 1000);
  assert.equal(log.lenientParsedLines, 0);
  assert.equal(log.pairs.length, 500);
  assert.equal(log.totalAnomalies, 0);

  assert.deepEqual(log.outcomeCounts, {
    RESPONSE: 500,
    ERROR: 0,
    TIMEOUT: 0,
    PENDING: 0,
    UNKNOWN: 0,
  });

  // Every id appears exactly twice in this file (one REQUEST + one RESPONSE) and none are
  // orphaned/duplicated -- so every pair should be a plain, anomaly-free RESPONSE.
  for (const pair of log.pairs) {
    assert.equal(pair.outcome, 'RESPONSE');
    assert.equal(pair.anomalies.length, 0);
    assert.equal(typeof pair.latencySeconds, 'number');
    assert.ok((pair.latencySeconds as number) >= 0, `pair ${pair.id} should not have negative latency`);
  }

  assert.ok(log.timeRange.firstElapsedSeconds !== null);
  assert.ok(log.timeRange.lastElapsedSeconds !== null);
  // Verified directly against the fetched file during implementation: session spans ~64.5s.
  assert.ok(
    Math.abs((log.timeRange.durationSeconds as number) - 64.502) < 0.01,
    `expected duration ~64.502s, got ${log.timeRange.durationSeconds}`,
  );

  assert.ok(log.latencyStats.overall);
  assert.equal(log.latencyStats.overall?.count, 500);

  // Verified directly against the fetched file during implementation (~8-15 concurrent, peak 34).
  assert.equal(log.concurrency.maxConcurrent, 34);
});

// ---- Real default log #2: api_signal2.log -- a "degraded" run with ERROR/TIMEOUT mixed in ----

test('parseLog: api_signal2.log (real fixture) parses cleanly with the expected error/timeout mix', () => {
  const text = readFixture('api_signal2.log');
  const log = parseLog(text, 'https://raw.githubusercontent.com/uoio8090/api_log/main/api_signal2.log');

  assert.equal(log.totalLines, 1000);
  assert.equal(log.unparsedLines, 0);
  assert.equal(log.strictParsedLines, 1000);
  assert.equal(log.pairs.length, 500);
  assert.equal(log.totalAnomalies, 0);

  assert.deepEqual(log.outcomeCounts, {
    RESPONSE: 430,
    ERROR: 40,
    TIMEOUT: 30,
    PENDING: 0,
    UNKNOWN: 0,
  });

  assert.ok(
    Math.abs((log.timeRange.durationSeconds as number) - 77.432) < 0.01,
    `expected duration ~77.432s, got ${log.timeRange.durationSeconds}`,
  );

  assert.equal(log.concurrency.maxConcurrent, 23);

  assert.ok(log.latencyStats.byOutcome.RESPONSE);
  assert.ok(log.latencyStats.byOutcome.ERROR);
  assert.ok(log.latencyStats.byOutcome.TIMEOUT);
  assert.equal(log.latencyStats.byOutcome.RESPONSE?.count, 430);
  assert.equal(log.latencyStats.byOutcome.ERROR?.count, 40);
  assert.equal(log.latencyStats.byOutcome.TIMEOUT?.count, 30);
});

test('parseLog: api_signal3.log exposes the expected long latency tail', () => {
  const text = readFixture('api_signal3.log');
  const log = parseLog(text, 'https://raw.githubusercontent.com/uoio8090/api_log/main/api_signal3.log');

  assert.equal(log.totalLines, 1000);
  assert.equal(log.pairs.length, 500);
  assert.deepEqual(log.outcomeCounts, {
    RESPONSE: 500,
    ERROR: 0,
    TIMEOUT: 0,
    PENDING: 0,
    UNKNOWN: 0,
  });
  assert.equal(log.totalParseWarnings, 0);
  assert.equal(log.totalAnomalies, 0);
  assert.equal(log.concurrency.maxConcurrent, 37);
  assert.ok(Math.abs((log.latencyStats.overall?.p99Seconds ?? 0) - 14.5) < 1e-9);
});

// ---- Malformed / lenient-fallback synthetic fixture ---------------------------------------
//
// Every numeric literal below is an exact-in-binary-floating-point value (whole numbers and
// halves) specifically so every assertion below can use strict equality with zero float
// fuzz. See the design notes in the implementation: this single fixture exercises strict
// parsing, lenient key=value parsing (both the "timestamp anchors to a derived elapsed time"
// and the "no time info at all -> demoted to a warning" sub-cases), a wholly unparseable
// line, an out-of-file-order terminal, a negative-latency pair, an orphaned terminal with no
// request (missing_request, including one for a TIMEOUT), and a duplicate terminal.
const MALFORMED_LOG = [
  '[    0.000000] api_signal: id=req-0001 timestamp=2026-01-01T00:00:00.000 status=REQUEST',
  '[    0.500000] api_signal: id=req-0002 timestamp=2026-01-01T00:00:00.500 status=REQUEST',
  'this line is complete garbage and matches nothing at all',
  '[    1.500000] api_signal: id=req-0001 timestamp=2026-01-01T00:00:01.500 status=RESPONSE',
  'weird_format id=req-0003 status=ERROR timestamp=2026-01-01T00:00:02.500 extra=ignored',
  '[    4.000000] api_signal: id=req-0004 timestamp=2026-01-01T00:00:04.000 status=REQUEST',
  '[    3.500000] api_signal: id=req-0004 timestamp=2026-01-01T00:00:03.500 status=RESPONSE',
  '[    6.000000] api_signal: id=req-0005 timestamp=2026-01-01T00:00:06.000 status=TIMEOUT',
  'id=req-0006 status=REQUEST',
  '[   10.000000] api_signal: id=req-0002 timestamp=2026-01-01T00:00:10.000 status=RESPONSE',
  '[   10.500000] api_signal: id=req-0002 timestamp=2026-01-01T00:00:10.500 status=RESPONSE',
].join('\n');

test('parseLog: malformed/mixed-format fixture falls back to lenient parsing and flags anomalies defensively', () => {
  const log = parseLog(MALFORMED_LOG, 'https://example.invalid/malformed.log');

  assert.equal(log.totalLines, 11);
  // Line 3 (total garbage) and line 9 (id=/status= only, no time info at all) both fail to
  // become events; every other line succeeds (strict or lenient).
  assert.equal(log.totalParseWarnings, 2);
  assert.equal(log.unparsedLines, 2);
  assert.equal(log.parsedLines, 9);
  assert.equal(log.strictParsedLines, 8);
  assert.equal(log.lenientParsedLines, 1);
  assert.equal(log.parsedLines + log.unparsedLines, log.totalLines);

  const warningLines = log.parseWarnings.map((w) => w.lineNumber).sort((a, b) => a - b);
  assert.deepEqual(warningLines, [3, 9]);
  for (const warning of log.parseWarnings) {
    assert.ok(warning.reason.length > 0);
    assert.ok(warning.excerpt.length > 0);
  }

  // Only 3 ids ever get a REQUEST: req-0001, req-0002, req-0004.
  assert.equal(log.pairs.length, 3);
  assert.deepEqual(log.outcomeCounts, {
    RESPONSE: 3,
    ERROR: 0,
    TIMEOUT: 0,
    PENDING: 0,
    UNKNOWN: 0,
  });

  const byId = new Map(log.pairs.map((p) => [p.id, p]));

  const req1 = byId.get('req-0001');
  assert.ok(req1);
  assert.equal(req1?.outcome, 'RESPONSE');
  assert.equal(req1?.latencySeconds, 1.5);
  assert.equal(req1?.anomalies.length, 0);

  // req-0002 has two RESPONSE terminals (10.0 and 10.5); the earlier one is canonical, and
  // the extra one is flagged as a duplicate_terminal both on the pair and file-wide.
  const req2 = byId.get('req-0002');
  assert.ok(req2);
  assert.equal(req2?.outcome, 'RESPONSE');
  assert.equal(req2?.terminalElapsedSeconds, 10.0);
  assert.equal(req2?.latencySeconds, 9.5);
  assert.equal(req2?.anomalies.length, 1);
  assert.equal(req2?.anomalies[0]?.type, 'duplicate_terminal');

  // req-0004's terminal (3.5) precedes its own request (4.0) in elapsed time -- negative
  // latency, flagged rather than hidden, and the pair is still produced.
  const req4 = byId.get('req-0004');
  assert.ok(req4);
  assert.equal(req4?.latencySeconds, -0.5);
  assert.equal(req4?.anomalies.length, 1);
  assert.equal(req4?.anomalies[0]?.type, 'negative_latency');

  // req-0003 (lenient-parsed, no bracket, elapsed derived from its timestamp anchored against
  // the strict-tier lines) and req-0005 both have a terminal but were never REQUESTed --
  // each becomes a file-level missing_request anomaly, and neither produces a pair.
  assert.ok(!byId.has('req-0003'));
  assert.ok(!byId.has('req-0005'));
  // req-0006's only line had neither a bracket nor a timestamp, so it never became an event
  // at all (it is a parse warning, not a correlation-level anomaly).
  assert.ok(!byId.has('req-0006'));

  assert.equal(log.totalAnomalies, 4);
  const missingRequestIds = log.anomalies
    .filter((a) => a.type === 'missing_request')
    .map((a) => a.id)
    .sort();
  assert.deepEqual(missingRequestIds, ['req-0003', 'req-0005']);
  assert.equal(log.anomalies.filter((a) => a.type === 'negative_latency').length, 1);
  assert.equal(log.anomalies.filter((a) => a.type === 'duplicate_terminal').length, 1);
  assert.equal(log.anomalies.filter((a) => a.type === 'duplicate_request').length, 0);
  assert.ok(log.anomalies.every((a) => a.id !== 'req-0006'));

  // Sanity on the lenient timestamp-anchoring itself: req-0003's derived elapsed time should
  // land exactly at 2.5s (its timestamp is 2.5s after the file's t=0 instant, established by
  // the surrounding strict-tier lines), even though its own line had no [elapsed] bracket.
  // We can't see the RawEvent directly from ParsedLog, but get_events_near-style filtering
  // via the anomaly detail string confirms the derived time landed where expected.
  const req3Anomaly = log.anomalies.find((a) => a.id === 'req-0003');
  assert.ok(req3Anomaly?.detail.includes('2.500'));
});

test('parseLog: throws UNRECOGNIZED_FORMAT when nothing on the page looks like a log line', () => {
  const notALog = ['<html>', '<body>404 not found</body>', '</html>'].join('\n');
  assert.throws(
    () => parseLog(notALog, 'https://example.invalid/not-a-log.html'),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === 'UNRECOGNIZED_FORMAT',
  );
});

test('parseLog: blank lines are not counted as log lines at all', () => {
  const withBlanks = [
    '',
    '[    0.000000] api_signal: id=req-a timestamp=2026-01-01T00:00:00.000 status=REQUEST',
    '',
    '',
    '[    1.000000] api_signal: id=req-a timestamp=2026-01-01T00:00:01.000 status=RESPONSE',
    '',
  ].join('\n');
  const log = parseLog(withBlanks, 'https://example.invalid/blanks.log');
  assert.equal(log.totalLines, 2);
  assert.equal(log.pairs.length, 1);
  assert.equal(log.totalParseWarnings, 0);
});
