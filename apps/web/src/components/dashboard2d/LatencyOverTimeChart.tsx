import { useMemo, useRef, useState } from 'react';
import type { LatencyPoint } from '../../utils/latencyChart';
import { formatElapsed, formatLatency, clamp } from '../../utils/format';
import { niceCeiling } from '../../utils/niceNumber';
import styles from './Charts.module.css';

export interface LatencyOverTimeChartProps {
  points: LatencyPoint[];
  sessionStart: number;
  sessionEnd: number;
}

const W = 900;
const H = 260;
const PAD_LEFT = 34;
const PAD_BOTTOM = 20;
const X_TICKS = 6;
const Y_TICKS = 4;

/**
 * Single-series line + area chart (latency vs. elapsed time). Per the dataviz
 * skill: one hue, no legend box (the card title names the series), 2px line,
 * ~10% opacity area fill, hairline recessive gridlines, a crosshair that snaps
 * to the nearest point rather than requiring the reader to hit a 2px line.
 */
export function LatencyOverTimeChart({ points, sessionStart, sessionEnd }: LatencyOverTimeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const duration = Math.max(sessionEnd - sessionStart, 0.001);
  const plotW = W - PAD_LEFT;
  const plotH = H - PAD_BOTTOM;

  const yMax = useMemo(() => {
    const maxY = points.reduce((m, p) => Math.max(m, p.y), 0);
    return niceCeiling(maxY || 1);
  }, [points]);

  const xScale = (t: number) => PAD_LEFT + ((t - sessionStart) / duration) * plotW;
  const yScale = (v: number) => plotH - (v / yMax) * plotH;

  const linePath = useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' '),
    [points, sessionStart, duration, yMax],
  );
  const areaPath = points.length
    ? `${linePath} L${xScale(points[points.length - 1].x).toFixed(1)},${plotH} L${xScale(points[0].x).toFixed(1)},${plotH} Z`
    : '';

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (yMax * i) / Y_TICKS);
  const xTicks = Array.from({ length: X_TICKS + 1 }, (_, i) => sessionStart + (duration * i) / X_TICKS);

  function nearestIndex(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const relX = clamp(((clientX - rect.left) / rect.width) * W, PAD_LEFT, W);
    const t = sessionStart + ((relX - PAD_LEFT) / plotW) * duration;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - t);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className={styles.chartWrap}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        tabIndex={points.length > 0 ? 0 : -1}
        role="img"
        aria-label="Latency over time"
        onPointerMove={(e) => setHoverIndex(nearestIndex(e.clientX))}
        onPointerLeave={() => setHoverIndex(null)}
        onKeyDown={(e) => {
          if (!points.length) return;
          if (e.key === 'ArrowRight') setHoverIndex((i) => Math.min(points.length - 1, (i ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setHoverIndex((i) => Math.max(0, (i ?? points.length) - 1));
        }}
      >
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PAD_LEFT}
            x2={W}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke={v === 0 ? 'var(--baseline)' : 'var(--gridline)'}
            strokeWidth={1}
          />
        ))}

        {points.length > 0 ? (
          <>
            <path d={areaPath} fill="var(--accent)" opacity={0.1} />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}

        {hovered ? (
          <>
            <line x1={xScale(hovered.x)} x2={xScale(hovered.x)} y1={0} y2={plotH} stroke="var(--baseline)" strokeWidth={1} />
            <circle cx={xScale(hovered.x)} cy={yScale(hovered.y)} r={5} fill="var(--accent)" stroke="var(--surface-1)" strokeWidth={2} />
          </>
        ) : null}

        {yTicks.map((v) => (
          <text key={`yl-${v}`} x={PAD_LEFT - 6} y={yScale(v) + 3} textAnchor="end" className={styles.tickLabel}>
            {formatLatency(v)}
          </text>
        ))}
        {xTicks.map((t) => (
          <text key={`xl-${t}`} x={xScale(t)} y={H - 4} textAnchor="middle" className={styles.tickLabel}>
            {formatElapsed(t)}
          </text>
        ))}
      </svg>

      {hovered ? (
        <div
          className={styles.tooltip}
          style={{ left: `${(xScale(hovered.x) / W) * 100}%`, top: `${(yScale(hovered.y) / H) * 100}%` }}
        >
          <div className={styles.tooltipId}>{hovered.id}</div>
          <div>
            t={formatElapsed(hovered.x)} · <strong>{formatLatency(hovered.y)}</strong>
          </div>
        </div>
      ) : null}

      {points.length === 0 ? <div className={styles.emptyOverlay}>No completed requests to plot.</div> : null}
    </div>
  );
}
