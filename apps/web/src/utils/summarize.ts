import type { LogEventPair, Outcome, ParsedLog } from '@log-analyzer/core';
import { formatDuration, formatLatency, percentile } from './format';

export interface SessionTimeRange {
  start: number;
  end: number;
}

/** Session start/end (elapsed seconds), derived straight from `pairs` -- never trusts
 *  a possibly-absent top-level `timeRange` convenience field. */
export function getSessionTimeRange(pairs: readonly LogEventPair[]): SessionTimeRange | null {
  let start = Infinity;
  let end = -Infinity;
  for (const pair of pairs) {
    start = Math.min(start, pair.requestElapsedSeconds);
    // A PENDING pair's request time still counts toward the session bounds even
    // with no terminal event.
    end = Math.max(end, pair.terminalElapsedSeconds ?? pair.requestElapsedSeconds);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(end, start) };
}

export function countByOutcome(pairs: readonly LogEventPair[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { RESPONSE: 0, ERROR: 0, TIMEOUT: 0, PENDING: 0, UNKNOWN: 0 };
  for (const pair of pairs) {
    counts[pair.outcome] = (counts[pair.outcome] ?? 0) + 1;
  }
  return counts;
}

export function collectLatencies(pairs: readonly LogEventPair[]): number[] {
  const latencies: number[] = [];
  for (const pair of pairs) {
    if (typeof pair.latencySeconds === 'number' && Number.isFinite(pair.latencySeconds)) {
      latencies.push(pair.latencySeconds);
    }
  }
  latencies.sort((a, b) => a - b);
  return latencies;
}

/**
 * A deterministic, client-side-computed orientation message -- no agent/LLM call.
 * Formats fields already present on the just-returned ParsedLog, shown as the first
 * chat turn right after a successful load (see state/useChatStore.ts `addSystemSummary`).
 */
export function summarizeParsedLog(log: ParsedLog): string {
  const pairs = log.pairs ?? [];
  const total = pairs.length;

  if (total === 0) {
    return `Loaded ${log.sourceUrl} but found no recognizable request/response pairs. Try "list anomalies" once you're ready, or load a different URL.`;
  }

  const counts = countByOutcome(pairs);
  const latencies = collectLatencies(pairs);
  const range = getSessionTimeRange(pairs);

  let anomalyCount = 0;
  for (const pair of pairs) anomalyCount += pair.anomalies?.length ?? 0;
  const warningCount = log.totalParseWarnings ?? 0;

  const lines: string[] = [];
  lines.push(`Loaded ${total} request${total === 1 ? '' : 's'} from ${log.sourceUrl}.`);

  const outcomeParts = (Object.keys(counts) as Outcome[])
    .filter((outcome) => counts[outcome] > 0)
    .map((outcome) => `${counts[outcome]} ${outcome.toLowerCase()}`);
  if (outcomeParts.length) {
    lines.push(`Outcomes: ${outcomeParts.join(', ')}.`);
  }

  if (range) {
    lines.push(`Session spans ${formatDuration(range.end - range.start)}.`);
  }

  if (latencies.length) {
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    lines.push(`Latency: p50 ${formatLatency(p50)}, p95 ${formatLatency(p95)}.`);
  }

  if (anomalyCount > 0 || warningCount > 0) {
    lines.push(
      `${anomalyCount} pair-level anomal${anomalyCount === 1 ? 'y' : 'ies'} and ${warningCount} unparsed line${
        warningCount === 1 ? '' : 's'
      } flagged -- ask "list anomalies" for details.`,
    );
  }

  lines.push('Ask me anything about this log -- e.g. "what happened around t=30s" or "show me the slowest requests."');

  return lines.join(' ');
}
