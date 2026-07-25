import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVizStore } from '../../state/useVizStore';
import { LANE_SPACING, MAX_BAR_HEIGHT, SCENE_WIDTH } from './constants';
import { clamp } from '../../utils/format';

export interface PlayheadProps {
  sessionStart: number;
  sessionEnd: number;
  laneCount: number;
}

/**
 * A translucent plane that sweeps along the time axis. Also doubles as the
 * playback "driver": while `isPlaying`, it advances `useVizStore`'s `scrubTime`
 * each frame (auto-pausing at the end of the session); it always repositions
 * itself from the *current* scrubTime afterward.
 *
 * Reads/writes `useVizStore` via `getState()`/`setState()` inside its own
 * `useFrame` rather than the reactive hook -- the mesh moves by direct ref
 * mutation every frame regardless, so subscribing reactively here would only
 * cost an extra render with no benefit. `setScrubTime` itself still goes through
 * the store (so 2D consumers like PlaybackControls' scrubber can subscribe to it
 * normally -- a per-frame DOM update there is cheap, unlike a per-frame React
 * re-render of the 3D bar field).
 */
export function Playhead({ sessionStart, sessionEnd, laneCount }: PlayheadProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const duration = Math.max(sessionEnd - sessionStart, 0.001);
  const xScale = SCENE_WIDTH / duration;
  const depth = laneCount * LANE_SPACING + LANE_SPACING;

  useFrame((_state, delta) => {
    const { isPlaying, playbackSpeed, scrubTime, setScrubTime, pause } = useVizStore.getState();

    let t = scrubTime;
    if (isPlaying) {
      const next = clamp(scrubTime + delta * playbackSpeed, sessionStart, sessionEnd);
      if (next !== scrubTime) setScrubTime(next);
      t = next;
      if (next >= sessionEnd) pause();
    }

    if (meshRef.current) {
      const x = (t - sessionStart) * xScale - SCENE_WIDTH / 2;
      meshRef.current.position.x = x;
    }
  });

  return (
    <mesh ref={meshRef} position={[-SCENE_WIDTH / 2, MAX_BAR_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[depth, MAX_BAR_HEIGHT * 1.15]} />
      <meshBasicMaterial
        color="#e8f6ff"
        transparent
        opacity={0.28}
        toneMapped={false}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
