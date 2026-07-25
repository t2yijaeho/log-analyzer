import { listOutliers } from '@log-analyzer/core';
import { useLogStore } from '../../state/useLogStore';
import { formatLatency } from '../../utils/format';
import styles from './LocalInsightsPanel.module.css';

export function LocalInsightsPanel() {
  const log = useLogStore((state) => state.parsedLog);
  const outliers = log ? listOutliers(log.pairs, 5) : [];

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span>Local insights</span>
        <span className={styles.badge}>No upload</span>
      </div>
      <div className={styles.body}>
        <p className={styles.intro}>
          GitHub Pages runs entirely in your browser. The optional AI investigator is available only with the protected
          full-stack deployment.
        </p>
        {log ? (
          <>
            <div className={styles.metricGrid}>
              <div>
                <span>Requests</span>
                <strong>{log.pairs.length}</strong>
              </div>
              <div>
                <span>Errors + timeouts</span>
                <strong>{log.outcomeCounts.ERROR + log.outcomeCounts.TIMEOUT}</strong>
              </div>
              <div>
                <span>P95 latency</span>
                <strong>{formatLatency(log.latencyStats.overall?.p95Seconds)}</strong>
              </div>
              <div>
                <span>Peak concurrency</span>
                <strong>{log.concurrency.maxConcurrent}</strong>
              </div>
            </div>
            <section>
              <h2>Slowest requests</h2>
              <ol className={styles.outliers}>
                {outliers.map((outlier) => (
                  <li key={outlier.id}>
                    <code>{outlier.id}</code>
                    <span>{formatLatency(outlier.latencySeconds)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : (
          <p>Choose a sample or open a local log to calculate insights.</p>
        )}
      </div>
    </aside>
  );
}
