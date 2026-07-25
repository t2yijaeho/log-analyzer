/** Small formatting + numeric helpers shared across the viz and chat UI. */

export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return `${seconds.toFixed(3)}s`;
}

export function formatLatency(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  if (mins <= 0) return `${secs.toFixed(1)}s`;
  return `${mins}m ${secs.toFixed(0)}s`;
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear percentile over an already-ascending-sorted array (nearest-rank method). */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = clamp(Math.ceil((p / 100) * sortedAsc.length) - 1, 0, sortedAsc.length - 1);
  return sortedAsc[idx];
}

export function isLikelyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
