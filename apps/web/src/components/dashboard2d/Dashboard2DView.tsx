import { useMemo } from 'react';
import type { ParsedLog } from '@log-analyzer/core';
import { getLatencyHistogram, getLatencySeries } from '../../utils/latencyChart';
import { StatTiles } from './StatTiles';
import { LatencyOverTimeChart } from './LatencyOverTimeChart';
import { LatencyHistogramChart } from './LatencyHistogramChart';
import styles from './Dashboard2DView.module.css';

export interface Dashboard2DViewProps {
  log: ParsedLog;
}

/**
 * The 2D alternative to the 3D lifespan-bar scene, over the same ParsedLog --
 * a stat-tile row plus two single-series charts (latency over time, latency
 * distribution). Side-by-side when there's room, stacked when there isn't
 * (a responsive flex-wrap, rather than picking one of the two static layouts
 * a design pass explored).
 */
export function Dashboard2DView({ log }: Dashboard2DViewProps) {
  const series = useMemo(() => getLatencySeries(log.pairs), [log]);
  const bins = useMemo(() => getLatencyHistogram(log.pairs), [log]);
  const sessionStart = log.timeRange.firstElapsedSeconds ?? 0;
  const sessionEnd = log.timeRange.lastElapsedSeconds ?? sessionStart + 1;

  return (
    <div className={styles.root}>
      <StatTiles log={log} />
      <div className={styles.charts}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Latency over time</div>
          <LatencyOverTimeChart points={series} sessionStart={sessionStart} sessionEnd={sessionEnd} />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Latency distribution</div>
          <LatencyHistogramChart bins={bins} />
        </div>
      </div>
    </div>
  );
}
