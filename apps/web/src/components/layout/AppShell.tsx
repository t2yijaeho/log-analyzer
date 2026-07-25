import { LogSourceBar } from '../log-source/LogSourceBar';
import { LogStatsChip } from '../log-source/LogStatsChip';
import { VizCanvas } from '../visualization/VizCanvas';
import { AnalysisPanel } from './AnalysisPanel';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <LogSourceBar />
        <LogStatsChip />
      </header>
      <main className={styles.main}>
        <section className={styles.vizArea}>
          <VizCanvas />
        </section>
        <section className={styles.chatArea}>
          <AnalysisPanel />
        </section>
      </main>
    </div>
  );
}
