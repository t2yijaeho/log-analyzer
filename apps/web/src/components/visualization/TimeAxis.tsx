import { Html } from '@react-three/drei';
import { formatElapsed } from '../../utils/format';
import { LANE_SPACING, SCENE_WIDTH } from './constants';

export interface TimeAxisProps {
  sessionStart: number;
  sessionEnd: number;
  laneCount: number;
}

const TICK_COUNT = 8;
const AXIS_COLOR = '#5b5a55';

/**
 * A simple baseline + tick marks along X (time), drawn just behind the last lane.
 * Tick labels use drei's <Html> (real DOM text via the system font stack) rather
 * than drei's SDF <Text> -- <Text> resolves its glyph atlas through
 * troika-three-text, which falls back to fetching a font from a remote CDN when no
 * local font file is configured, which this app deliberately avoids taking on as a
 * dependency (no bundled font asset, and no reliance on outbound network access
 * just to label an axis).
 */
export function TimeAxis({ sessionStart, sessionEnd, laneCount }: TimeAxisProps) {
  const duration = Math.max(sessionEnd - sessionStart, 0.001);
  const z = -((laneCount - 1) * LANE_SPACING) / 2 - LANE_SPACING;

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const frac = i / TICK_COUNT;
    const elapsed = sessionStart + frac * duration;
    const x = frac * SCENE_WIDTH - SCENE_WIDTH / 2;
    return { x, elapsed, key: i };
  });

  return (
    <group>
      <mesh position={[0, 0, z]}>
        <boxGeometry args={[SCENE_WIDTH, 0.02, 0.02]} />
        <meshBasicMaterial color={AXIS_COLOR} toneMapped={false} />
      </mesh>
      {ticks.map((tick) => (
        <group key={tick.key} position={[tick.x, 0, z]}>
          <mesh>
            <boxGeometry args={[0.02, 0.02, 0.3]} />
            <meshBasicMaterial color={AXIS_COLOR} toneMapped={false} />
          </mesh>
          <Html
            position={[0, -0.05, -0.35]}
            center
            style={{ fontSize: '10px', color: '#c3c2b7', whiteSpace: 'nowrap', pointerEvents: 'none' }}
          >
            {formatElapsed(tick.elapsed)}
          </Html>
        </group>
      ))}
    </group>
  );
}
