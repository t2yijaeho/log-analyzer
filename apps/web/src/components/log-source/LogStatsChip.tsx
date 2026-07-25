import { useMemo } from 'react';
import { useLogStore } from '../../state/useLogStore';
import { countByOutcome, getSessionTimeRange } from '../../utils/summarize';
import { formatDuration } from '../../utils/format';
import { OUTCOME_ORDER, OUTCOME_STYLES } from '../../theme/outcomeColors';
import styles from './LogStatsChip.module.css';

export function LogStatsChip() {
  const parsedLog = useLogStore((s) => s.parsedLog);

  const stats = useMemo(() => {
    if (!parsedLog) return null;
    const pairs = parsedLog.pairs ?? [];
    return {
      total: pairs.length,
      counts: countByOutcome(pairs),
      range: getSessionTimeRange(pairs),
    };
  }, [parsedLog]);

  if (!parsedLog || !stats) {
    return <div className={styles.chip}>No log loaded</div>;
  }

  return (
    <div className={styles.chip} title={parsedLog.sourceUrl}>
      <span className={styles.total}>{stats.total} requests</span>
      <span className={styles.divider} aria-hidden="true" />
      {OUTCOME_ORDER.filter((outcome) => stats.counts[outcome] > 0).map((outcome) => (
        <span key={outcome} className={styles.outcome}>
          <span className={styles.dot} style={{ background: OUTCOME_STYLES[outcome].hex }} aria-hidden="true" />
          {OUTCOME_STYLES[outcome].label} {stats.counts[outcome]}
        </span>
      ))}
      {stats.range ? (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.duration}>{formatDuration(stats.range.end - stats.range.start)}</span>
        </>
      ) : null}
    </div>
  );
}
