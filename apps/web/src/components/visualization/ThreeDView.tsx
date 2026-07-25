import type { LogEventPair } from '@log-analyzer/core';
import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';
import { computeBarLayout } from './LifespanBars';
import { Legend } from './Legend';
import { PlaybackControls } from './PlaybackControls';
import { Scene } from './Scene';
import { SelectedPairPanel } from './SelectedPairPanel';

export default function ThreeDView({ pairs }: { pairs: LogEventPair[] }) {
  const layout = useMemo(() => computeBarLayout(pairs), [pairs]);

  return (
    <>
      <Canvas camera={{ position: [0, 14, 26], fov: 50, near: 0.1, far: 400 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene layout={layout} />
          <EffectComposer frameBufferType={HalfFloatType}>
            <Bloom luminanceThreshold={0.22} luminanceSmoothing={0.85} intensity={1.15} mipmapBlur radius={0.6} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <Legend />
      <PlaybackControls layout={layout} />
      <SelectedPairPanel />
    </>
  );
}
