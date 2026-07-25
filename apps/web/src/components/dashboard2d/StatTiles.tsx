import type { ParsedLog } from '@log-analyzer/core';
import { formatLatency } from '../../utils/format';
import styles from './StatTiles.module.css';

export interface StatTilesProps {
  log: ParsedLog;
}

/** Label/value styling follows the "API Latency Viewer" Claude Design mockup
 *  exactly (plain small secondary-ink label, bold tabular-nums value) rather
 *  than the dataviz skill's general default -- a concrete design reference for
 *  this exact project takes precedence over the generic guidance. */
export function StatTiles({ log }: StatTilesProps) {
  const pending = log.outcomeCounts.PENDING ?? 0;
  const paired = log.pairs.length - pending;
  const overall = log.latencyStats.overall;

  const tiles: Array<{ label: string; value: string }> = [
    { label: 'Paired', value: String(paired) },
    { label: 'Unpaired', value: String(pending) },
    { label: 'Min', value: overall ? formatLatency(overall.minSeconds) : '—' },
    { label: 'Avg', value: overall ? formatLatency(overall.meanSeconds) : '—' },
    { label: 'p50', value: overall ? formatLatency(overall.p50Seconds) : '—' },
    { label: 'p95', value: overall ? formatLatency(overall.p95Seconds) : '—' },
    { label: 'p99', value: overall ? formatLatency(overall.p99Seconds) : '—' },
    { label: 'Max', value: overall ? formatLatency(overall.maxSeconds) : '—' },
  ];

  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <div className={styles.label}>{tile.label}</div>
          <div className={styles.value}>{tile.value}</div>
        </div>
      ))}
    </div>
  );
}
