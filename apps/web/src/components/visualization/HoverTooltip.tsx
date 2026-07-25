import { Html } from '@react-three/drei';
import { useVizStore } from '../../state/useVizStore';
import type { VizLayout } from './LifespanBars';
import { OUTCOME_STYLES } from '../../theme/outcomeColors';
import { formatElapsed, formatLatency, formatTimestamp } from '../../utils/format';
import styles from './HoverTooltip.module.css';

export interface HoverTooltipProps {
  layout: VizLayout;
}

/**
 * A 3D-anchored tooltip (drei's <Html>, projected from the bar's own layout
 * position) shown while hovering a bar. Bars don't move (only pulse/brighten in
 * place), so this only needs to re-render on the discrete `hoveredPairId` change --
 * a plain reactive store subscription is correct and cheap here.
 */
export function HoverTooltip({ layout }: HoverTooltipProps) {
  const hoveredPairId = useVizStore((s) => s.hoveredPairId);
  if (!hoveredPairId) return null;

  const item = layout.items.find((i) => i.pair.id === hoveredPairId);
  if (!item) return null;

  const { pair } = item;
  const style = OUTCOME_STYLES[pair.outcome];
  const anchor: [number, number, number] = [item.position[0], item.position[1] + item.size[1] / 2 + 0.5, item.position[2]];

  return (
    <Html position={anchor} center occlude={false} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
      <div className={styles.tooltip}>
        <div className={styles.header}>
          <span className={styles.dot} style={{ background: style.hex }} aria-hidden="true" />
          <span className={styles.outcome}>{style.label}</span>
          <span className={styles.id}>{pair.id}</span>
        </div>
        <div className={styles.row}>
          Request {formatTimestamp(pair.requestTimestamp)} (t={formatElapsed(pair.requestElapsedSeconds)})
        </div>
        <div className={styles.row}>
          Terminal {formatTimestamp(pair.terminalTimestamp)} (t={formatElapsed(pair.terminalElapsedSeconds)})
        </div>
        <div className={styles.row}>Latency {formatLatency(pair.latencySeconds)}</div>
        {pair.anomalies.length > 0 ? (
          <div className={styles.anomalies}>{pair.anomalies.map((a) => a.detail).join(', ')}</div>
        ) : null}
      </div>
    </Html>
  );
}
