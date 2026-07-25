import type { LogEventPair } from '@log-analyzer/core';

export interface LatencyPoint {
  x: number;
  y: number;
  id: string;
}

/** Points for the "latency over time" chart -- one per pair with a known latency
 *  (PENDING pairs have no terminal event yet, so no latency to plot). */
export function getLatencySeries(pairs: readonly LogEventPair[]): LatencyPoint[] {
  const points: LatencyPoint[] = [];
  for (const pair of pairs) {
    if (typeof pair.latencySeconds === 'number' && Number.isFinite(pair.latencySeconds) && pair.latencySeconds >= 0) {
      points.push({ x: pair.requestElapsedSeconds, y: pair.latencySeconds, id: pair.id });
    }
  }
  points.sort((a, b) => a.x - b.x);
  return points;
}

export interface LatencyBin {
  binStart: number;
  binEnd: number;
  count: number;
}

/** Equal-width histogram bins across the observed latency range. Returns [] when
 *  there are fewer than 2 distinct latency values to bin (nothing meaningful to show). */
export function getLatencyHistogram(pairs: readonly LogEventPair[], binCount = 16): LatencyBin[] {
  const values = pairs
    .map((p) => p.latencySeconds)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return [{ binStart: min, binEnd: max, count: values.length }];
  }

  const width = (max - min) / binCount;
  const bins: LatencyBin[] = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * width,
    binEnd: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count += 1;
  }
  return bins;
}
