import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { easing } from 'maath';
import * as THREE from 'three';
import { useVizStore, type CameraPreset } from '../../state/useVizStore';
import { SCENE_WIDTH } from './constants';

export interface CameraRigProps {
  hasLog: boolean;
  sessionStart: number;
  sessionEnd: number;
}

const IDLE_TARGET: [number, number, number] = [0, 14, 26];
const IDLE_LOOKAT: [number, number, number] = [0, 2, 0];
/** How long (seconds) a preset switch actively drives the camera before handing
 *  control back to free OrbitControls orbiting. */
const TRANSITION_WINDOW = 1.4;

/**
 * Three camera presets (Overview / Top-down / Follow-playhead), lerped via maath's
 * `easing.damp3` rather than snapping. Overview/Top-down actively drive the camera
 * only for a short window right after the preset changes, then hand control back to
 * free OrbitControls orbiting; Follow-playhead is a genuine "follow" camera and
 * keeps tracking the playhead continuously (by design -- switch preset to orbit
 * freely again). OrbitControls itself supplies idle auto-rotate, but only in the
 * empty pre-load state.
 */
export function CameraRig({ hasLog, sessionStart, sessionEnd }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lastPresetRef = useRef<CameraPreset | 'none'>('none');
  const transitionElapsedRef = useRef(0);
  const lookAtRef = useRef(new THREE.Vector3(...IDLE_LOOKAT));

  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { cameraPreset, scrubTime } = useVizStore.getState();

    if (lastPresetRef.current !== cameraPreset) {
      lastPresetRef.current = cameraPreset;
      transitionElapsedRef.current = 0;
    }
    transitionElapsedRef.current += delta;

    const isFollowing = hasLog && cameraPreset === 'follow-playhead';
    const stillTransitioning = transitionElapsedRef.current < TRANSITION_WINDOW;
    if (!hasLog) {
      // always gently settle toward the idle framing
    } else if (!isFollowing && !stillTransitioning) {
      return; // let the user freely orbit/zoom/pan undisturbed
    }

    let targetPos: [number, number, number];
    let targetLookAt: [number, number, number];

    if (!hasLog) {
      targetPos = IDLE_TARGET;
      targetLookAt = IDLE_LOOKAT;
    } else if (isFollowing) {
      const sessionSpan = Math.max(sessionEnd - sessionStart, 0.001);
      const xScale = SCENE_WIDTH / sessionSpan;
      const x = (scrubTime - sessionStart) * xScale - SCENE_WIDTH / 2;
      targetPos = [x, 6, 14];
      targetLookAt = [x, 2, 0];
    } else if (cameraPreset === 'top-down') {
      const sessionSpan = Math.max(sessionEnd - sessionStart, 1);
      targetPos = [0, Math.max(sessionSpan * 0.6, 22), 0.01];
      targetLookAt = [0, 0, 0];
    } else {
      targetPos = [SCENE_WIDTH * 0.32, 12, 22];
      targetLookAt = [0, 2, 0];
    }

    easing.damp3(camera.position, targetPos, 0.45, delta);
    easing.damp3(lookAtRef.current, targetLookAt, 0.45, delta);
    controls.target.copy(lookAtRef.current);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={70}
      maxPolarAngle={Math.PI / 2 - 0.02}
      autoRotate={!hasLog}
      autoRotateSpeed={0.6}
    />
  );
}
