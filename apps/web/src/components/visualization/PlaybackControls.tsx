import { useVizStore, type CameraPreset } from '../../state/useVizStore';
import { formatElapsed } from '../../utils/format';
import { SessionHeatStrip } from './SessionHeatStrip';
import type { VizLayout } from './LifespanBars';
import styles from './PlaybackControls.module.css';

const SPEEDS = [0.5, 1, 2, 4];
const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'top-down', label: 'Top-down' },
  { id: 'follow-playhead', label: 'Follow playhead' },
];

export function PlaybackControls({ layout }: { layout: VizLayout }) {
  const isPlaying = useVizStore((s) => s.isPlaying);
  const scrubTime = useVizStore((s) => s.scrubTime);
  const playbackSpeed = useVizStore((s) => s.playbackSpeed);
  const cameraPreset = useVizStore((s) => s.cameraPreset);
  const togglePlaying = useVizStore((s) => s.togglePlaying);
  const setScrubTime = useVizStore((s) => s.setScrubTime);
  const setPlaybackSpeed = useVizStore((s) => s.setPlaybackSpeed);
  const setCameraPreset = useVizStore((s) => s.setCameraPreset);

  const { sessionStart, sessionEnd } = layout;
  const duration = Math.max(sessionEnd - sessionStart, 0.001);
  const hasLog = layout.items.length > 0;

  return (
    <div className={styles.bar}>
      <div className={styles.transport}>
        <button type="button" className={styles.playButton} onClick={togglePlaying} disabled={!hasLog}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          className={styles.scrubber}
          min={sessionStart}
          max={sessionEnd}
          step={duration / 1000}
          value={Math.min(Math.max(scrubTime, sessionStart), sessionEnd)}
          onChange={(e) => setScrubTime(Number(e.target.value))}
          disabled={!hasLog}
        />
        <span className={styles.time}>{formatElapsed(scrubTime)}</span>
        <select
          className={styles.speed}
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          disabled={!hasLog}
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>

      <div className={styles.presets} role="group" aria-label="Camera preset">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cameraPreset === p.id ? styles.presetActive : styles.preset}
            onClick={() => setCameraPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <SessionHeatStrip layout={layout} />
    </div>
  );
}
