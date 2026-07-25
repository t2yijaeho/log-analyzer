import { lazy, Suspense } from 'react';
import { useLogStore } from '../../state/useLogStore';
import { useVizStore } from '../../state/useVizStore';
import { Spinner } from '../common/Spinner';
import { Dashboard2DView } from '../dashboard2d/Dashboard2DView';
import { EmptyState } from '../common/EmptyState';
import styles from './VizCanvas.module.css';

const ThreeDView = lazy(() => import('./ThreeDView'));

export function VizCanvas() {
  const parsedLog = useLogStore((s) => s.parsedLog);
  const viewMode = useVizStore((s) => s.viewMode);
  const setViewMode = useVizStore((s) => s.setViewMode);
  const hasLog = (parsedLog?.pairs.length ?? 0) > 0;

  return (
    <div className={styles.wrap}>
      {hasLog ? (
        <div className={styles.viewToggle} role="group" aria-label="Visualization mode">
          <button
            type="button"
            className={viewMode === '2d' ? styles.toggleActive : styles.toggleButton}
            aria-pressed={viewMode === '2d'}
            onClick={() => setViewMode('2d')}
          >
            2D
          </button>
          <button
            type="button"
            className={viewMode === '3d' ? styles.toggleActive : styles.toggleButton}
            aria-pressed={viewMode === '3d'}
            onClick={() => setViewMode('3d')}
          >
            3D
          </button>
        </div>
      ) : null}

      {!hasLog ? (
        <div className={styles.emptyOverlay}>
          <EmptyState title="Loading a sample" description="Signal 2 opens automatically so you can explore immediately." />
        </div>
      ) : viewMode === '2d' ? (
        <Dashboard2DView log={parsedLog!} />
      ) : (
        <Suspense
          fallback={
            <div className={styles.emptyOverlay}>
              <Spinner label="Loading 3D view…" />
            </div>
          }
        >
          <ThreeDView pairs={parsedLog!.pairs} />
        </Suspense>
      )}
    </div>
  );
}
