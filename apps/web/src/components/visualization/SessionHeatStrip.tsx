import { useEffect, useRef } from 'react';
import { useVizStore } from '../../state/useVizStore';
import { OUTCOME_STYLES } from '../../theme/outcomeColors';
import type { Outcome } from '@log-analyzer/core';
import type { VizLayout } from './LifespanBars';
import styles from './SessionHeatStrip.module.css';

const BUCKET_COUNT = 240;
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 32;

/** A small canvas-2D strip giving an at-a-glance shape of the whole session:
 *  each column is a time bucket, stacked by outcome count, tallest = busiest. */
export function SessionHeatStrip({ layout }: { layout: VizLayout }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubTime = useVizStore((s) => s.scrubTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { items, sessionStart, sessionEnd } = layout;
    const duration = Math.max(sessionEnd - sessionStart, 0.001);
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (items.length === 0) {
      ctx.fillStyle = 'rgba(137,135,129,0.2)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const buckets: Partial<Record<Outcome, number>>[] = Array.from({ length: BUCKET_COUNT }, () => ({}));
    let maxTotal = 0;
    for (const item of items) {
      const frac = (item.startElapsed - sessionStart) / duration;
      const idx = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(frac * BUCKET_COUNT)));
      const bucket = buckets[idx];
      bucket[item.pair.outcome] = (bucket[item.pair.outcome] ?? 0) + 1;
    }
    for (const bucket of buckets) {
      const total = Object.values(bucket).reduce((a, b) => a + (b ?? 0), 0);
      if (total > maxTotal) maxTotal = total;
    }
    if (maxTotal === 0) maxTotal = 1;

    const colWidth = width / BUCKET_COUNT;
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const bucket = buckets[i];
      const total = Object.values(bucket).reduce((a, b) => a + (b ?? 0), 0);
      if (total === 0) continue;
      const colHeight = Math.max(1, (total / maxTotal) * height);

      let y = height;
      for (const outcome of Object.keys(bucket) as Outcome[]) {
        const count = bucket[outcome] ?? 0;
        const segHeight = (count / total) * colHeight;
        y -= segHeight;
        ctx.fillStyle = OUTCOME_STYLES[outcome].hex;
        ctx.fillRect(i * colWidth, y, Math.ceil(colWidth), segHeight);
      }
    }
    // Re-drawn whenever the underlying layout changes (new log, new pairs) --
    // scrubTime is intentionally NOT a dependency here; the playhead marker below
    // is a separate cheap CSS-positioned overlay instead of a canvas redraw.
  }, [layout]);

  const { sessionStart, sessionEnd } = layout;
  const duration = Math.max(sessionEnd - sessionStart, 0.001);
  const playheadFrac = Math.min(1, Math.max(0, (scrubTime - sessionStart) / duration));

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className={styles.canvas} />
      <div className={styles.playheadMarker} style={{ left: `${playheadFrac * 100}%` }} />
    </div>
  );
}
