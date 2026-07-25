import { useLogStore } from '../../state/useLogStore';
import { useVizStore } from '../../state/useVizStore';
import { useChatStore } from '../../state/useChatStore';
import { OUTCOME_STYLES } from '../../theme/outcomeColors';
import { formatElapsed, formatLatency, formatTimestamp } from '../../utils/format';
import styles from './SelectedPairPanel.module.css';

/**
 * A docked 2D detail panel (plain DOM, outside the <Canvas>) for the currently
 * clicked bar. "Ask about this request" is the one intentional bridge between the
 * viz and chat features: it *prefills* useChatStore's draftText (never auto-sends),
 * which works with no prop drilling only because draftText lives in the chat store
 * rather than a component's local state.
 */
export function SelectedPairPanel() {
  const parsedLog = useLogStore((s) => s.parsedLog);
  const selectedPairId = useVizStore((s) => s.selectedPairId);
  const setSelected = useVizStore((s) => s.setSelected);

  if (!selectedPairId || !parsedLog) return null;
  const pair = parsedLog.pairs.find((p) => p.id === selectedPairId);
  if (!pair) return null;

  const style = OUTCOME_STYLES[pair.outcome];

  const askAboutThis = () => {
    useChatStore
      .getState()
      .setDraftText(`What happened with request ${pair.id} (outcome: ${pair.outcome}, latency: ${formatLatency(pair.latencySeconds)})?`);
  };

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close detail panel">
        ×
      </button>
      <div className={styles.header}>
        <span className={styles.dot} style={{ background: style.hex }} aria-hidden="true" />
        <span className={styles.outcome}>{style.label}</span>
        <span className={styles.id}>{pair.id}</span>
      </div>
      <dl className={styles.detail}>
        <dt>Request</dt>
        <dd>
          {formatTimestamp(pair.requestTimestamp)} (t={formatElapsed(pair.requestElapsedSeconds)})
        </dd>
        <dt>Terminal</dt>
        <dd>
          {formatTimestamp(pair.terminalTimestamp)} (t={formatElapsed(pair.terminalElapsedSeconds)})
        </dd>
        <dt>Latency</dt>
        <dd>{formatLatency(pair.latencySeconds)}</dd>
        {pair.anomalies.length > 0 ? (
          <>
            <dt>Anomalies</dt>
            <dd>{pair.anomalies.map((a) => a.detail).join(', ')}</dd>
          </>
        ) : null}
      </dl>
      <button type="button" className={styles.ask} onClick={askAboutThis}>
        Ask about this request
      </button>
    </div>
  );
}
