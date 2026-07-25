import { useMemo, useState } from 'react';
import type { LatencyBin } from '../../utils/latencyChart';
import { formatLatency } from '../../utils/format';
import { niceCeiling } from '../../utils/niceNumber';
import styles from './Charts.module.css';

export interface LatencyHistogramChartProps {
  bins: LatencyBin[];
}

const W = 900;
const H = 260;
const PAD_LEFT = 34;
const PAD_BOTTOM = 20;
const MAX_BAR_WIDTH = 24;
const BAR_RADIUS = 4;
const Y_TICKS = 4;

function roundedTopBarPath(x: number, y: number, width: number, height: number, r: number): string {
  const radius = Math.max(0, Math.min(r, width / 2, height));
  const top = y;
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `L${x},${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `L${x + width - radius},${top}`,
    `Q${x + width},${top} ${x + width},${top + radius}`,
    `L${x + width},${bottom}`,
    'Z',
  ].join(' ');
}

/**
 * Single-series latency histogram. Per the dataviz skill: bars capped at 24px
 * (never stretched to fill the slot), 4px rounded top / square baseline, a
 * per-bar hover+focus tooltip (no crosshair -- the mark itself is the hit
 * target, widened to the full slot so gaps between bars are still hoverable).
 */
export function LatencyHistogramChart({ bins }: LatencyHistogramChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = W - PAD_LEFT;
  const plotH = H - PAD_BOTTOM;
  const slotWidth = bins.length > 0 ? plotW / bins.length : plotW;
  const barWidth = Math.max(2, Math.min(MAX_BAR_WIDTH, slotWidth - 2));

  const yMax = useMemo(() => niceCeiling(bins.reduce((m, b) => Math.max(m, b.count), 0) || 1), [bins]);
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => Math.round((yMax * i) / Y_TICKS));

  const hovered = hoverIndex != null ? bins[hoverIndex] : null;

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={styles.svg}
        role="group"
        aria-label="Latency distribution"
      >
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PAD_LEFT}
            x2={W}
            y1={plotH - (v / yMax) * plotH}
            y2={plotH - (v / yMax) * plotH}
            stroke={v === 0 ? 'var(--baseline)' : 'var(--gridline)'}
            strokeWidth={1}
          />
        ))}

        {bins.map((bin, i) => {
          const slotX = PAD_LEFT + i * slotWidth;
          const barX = slotX + (slotWidth - barWidth) / 2;
          const barHeight = (bin.count / yMax) * plotH;
          const barY = plotH - barHeight;
          const isHovered = hoverIndex === i;
          return (
            <g
              key={i}
              tabIndex={0}
              role="img"
              aria-label={`${formatLatency(bin.binStart)} to ${formatLatency(bin.binEnd)}: ${bin.count} request${bin.count === 1 ? '' : 's'}`}
              className={styles.barGroup}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex((cur) => (cur === i ? null : cur))}
            >
              {/* Full-slot invisible hit target -- wider than the capped visual bar. */}
              <rect x={slotX} y={0} width={slotWidth} height={plotH} fill="transparent" />
              {bin.count > 0 ? (
                <path
                  d={roundedTopBarPath(barX, barY, barWidth, barHeight, BAR_RADIUS)}
                  fill="var(--accent)"
                  opacity={isHovered ? 1 : 0.85}
                />
              ) : null}
            </g>
          );
        })}

        {yTicks.map((v) => (
          <text key={`yl-${v}`} x={PAD_LEFT - 6} y={plotH - (v / yMax) * plotH + 3} textAnchor="end" className={styles.tickLabel}>
            {v}
          </text>
        ))}
        {bins.map((bin, i) =>
          i % 2 === 0 ? (
            <text key={`xl-${i}`} x={PAD_LEFT + (i + 0.5) * slotWidth} y={H - 4} textAnchor="middle" className={styles.tickLabel}>
              {formatLatency(bin.binStart)}
            </text>
          ) : null,
        )}
      </svg>

      {hovered && hoverIndex != null ? (
        <div
          className={styles.tooltip}
          style={{
            left: `${((PAD_LEFT + (hoverIndex + 0.5) * slotWidth) / W) * 100}%`,
            top: `${Math.max(0, (plotH - (hovered.count / yMax) * plotH) / H) * 100}%`,
          }}
        >
          <div>
            {formatLatency(hovered.binStart)}–{formatLatency(hovered.binEnd)}
          </div>
          <div>
            <strong>{hovered.count}</strong> request{hovered.count === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}

      {bins.length === 0 ? <div className={styles.emptyOverlay}>No completed requests to plot.</div> : null}
    </div>
  );
}
