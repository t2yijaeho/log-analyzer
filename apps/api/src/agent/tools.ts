import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  buildLogSummary,
  buildPairIndex,
  getEventsNear,
  getOutcomeRateByBucket,
  getStatsForRange,
  listAnomaliesForTool,
  listOutliers,
  type ParsedLog,
} from '@log-analyzer/core';

/**
 * Builds the seven read-only tools for one specific already-parsed log. Each tool's
 * `execute` closes directly over `parsedLog` (and a couple of derived indexes) instead of
 * going through a generic `RunContext<T>` -- a fresh set of tools (and a fresh `Agent`) is
 * built for every `POST /api/logs` call (see `agentFactory.ts`), so there is no shared/
 * generic context object anywhere that could let one session's agent see another session's
 * data; the tools are simply built without access to it in the first place.
 *
 * Every tool catches its own domain errors and resolves to `{ error: string }` rather than
 * throwing, so the model sees actionable text instead of a raw stack trace. Every tool's
 * result is also intrinsically bounded in size (see analytics/stats.ts's MAX_* constants),
 * since `MemorySession` replays the full tool-output history on every subsequent turn.
 */
export function buildToolsForLog(parsedLog: ParsedLog) {
  const pairIndex = buildPairIndex(parsedLog.pairs);

  const getLogSummaryTool = tool({
    name: 'get_log_summary',
    description:
      'Get an overview of the whole loaded log: total/parsed/unparsed line counts, pair count, outcome counts, overall and per-outcome latency stats, the session time range, max observed concurrency, and parse-quality totals (warning/anomaly counts). Call this first for any general question about the log.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const { sourceUrl: _sourceUrl, ...safeSummary } = buildLogSummary(parsedLog);
        return safeSummary;
      } catch (error) {
        return { error: `failed to build log summary: ${(error as Error).message}` };
      }
    },
  });

  const getStatsForRangeTool = tool({
    name: 'get_stats_for_range',
    description:
      'Get outcome counts and latency stats for requests overlapping a [start, end] window of elapsed seconds (the same "seconds since the first event" unit used everywhere else). Use this for "what happened between t=X and t=Y" questions.',
    parameters: z.object({
      start: z.number().describe('Start of the window, in elapsed seconds since the first event in the log.'),
      end: z.number().describe('End of the window, in elapsed seconds since the first event in the log.'),
    }),
    execute: async ({ start, end }: { start: number; end: number }) => {
      try {
        return getStatsForRange(parsedLog.pairs, start, end);
      } catch (error) {
        return { error: `failed to compute range stats: ${(error as Error).message}` };
      }
    },
  });

  const getOutcomeRateByBucketTool = tool({
    name: 'get_outcome_rate_by_bucket',
    description:
      'Get outcome counts and error rate ((ERROR+TIMEOUT)/total) over time, bucketed into fixed-width windows of elapsed seconds. Use this to find *when* error/timeout rates changed -- e.g. to answer "why did errors spike around t=37s", look for the bucket where errorRate jumps.',
    parameters: z.object({
      bucketSeconds: z
        .number()
        .positive()
        .nullable()
        .optional()
        .describe(
          'Bucket width in seconds. Defaults to 5 if omitted/null. Very small values are automatically widened server-side to keep the result bounded (at most 200 buckets).',
        ),
    }),
    execute: async ({ bucketSeconds }: { bucketSeconds?: number | null }) => {
      try {
        return getOutcomeRateByBucket(parsedLog.pairs, bucketSeconds ?? undefined);
      } catch (error) {
        return { error: `failed to compute outcome-rate buckets: ${(error as Error).message}` };
      }
    },
  });

  const listOutliersTool = tool({
    name: 'list_outliers',
    description: 'List the slowest completed requests by latency, optionally filtered to a minimum latency.',
    parameters: z.object({
      limit: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .describe('Max results to return. Defaults to 10 if omitted/null; hard-capped at 100 regardless of what is requested.'),
      minLatencySeconds: z
        .number()
        .nonnegative()
        .nullable()
        .optional()
        .describe('Only include requests whose latency is at least this many seconds.'),
    }),
    execute: async ({ limit, minLatencySeconds }: { limit?: number | null; minLatencySeconds?: number | null }) => {
      try {
        return { outliers: listOutliers(parsedLog.pairs, limit ?? undefined, minLatencySeconds ?? undefined) };
      } catch (error) {
        return { error: `failed to list outliers: ${(error as Error).message}` };
      }
    },
  });

  const getEventsNearTool = tool({
    name: 'get_events_near',
    description:
      'Get every request whose REQUEST or terminal event falls within +/- windowSeconds of a given point in elapsed time. Use for fine-grained drill-down once get_outcome_rate_by_bucket has pointed at an interesting moment.',
    parameters: z.object({
      elapsedSeconds: z.number().describe('The point in time to look around, in elapsed seconds since the first event.'),
      windowSeconds: z
        .number()
        .positive()
        .nullable()
        .optional()
        .describe('Half-width of the window in seconds. Defaults to 5 if omitted/null; hard-capped at 60.'),
    }),
    execute: async ({ elapsedSeconds, windowSeconds }: { elapsedSeconds: number; windowSeconds?: number | null }) => {
      try {
        return getEventsNear(parsedLog.pairs, elapsedSeconds, windowSeconds ?? undefined);
      } catch (error) {
        return { error: `failed to get events near t=${elapsedSeconds}: ${(error as Error).message}` };
      }
    },
  });

  const getPairByIdTool = tool({
    name: 'get_pair_by_id',
    description: 'Get full detail on one specific request by its correlation id (e.g. "sig-0247").',
    parameters: z.object({
      id: z.string().min(1).describe('The correlation id, exactly as it appears elsewhere (e.g. in list_outliers or get_events_near output).'),
    }),
    execute: async ({ id }: { id: string }) => {
      const found = pairIndex.get(id);
      if (!found) {
        return { error: `no request with id "${id}" was found in this log` };
      }
      return found;
    },
  });

  const listAnomaliesTool = tool({
    name: 'list_anomalies',
    description:
      'List parsing problems (lines the parser could not fully read) and structural anomalies (a terminal event with no matching request, a request with more than one terminal event, or a negative latency). Use this if asked about data quality, or if other tools\' results seem inconsistent.',
    parameters: z.object({}),
    execute: async () => {
      try {
        return listAnomaliesForTool(parsedLog);
      } catch (error) {
        return { error: `failed to list anomalies: ${(error as Error).message}` };
      }
    },
  });

  return [
    getLogSummaryTool,
    getStatsForRangeTool,
    getOutcomeRateByBucketTool,
    listOutliersTool,
    getEventsNearTool,
    getPairByIdTool,
    listAnomaliesTool,
  ];
}
