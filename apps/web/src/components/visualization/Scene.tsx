import { Grid } from '@react-three/drei';
import { SCENE_BACKGROUND } from '../../theme/outcomeColors';
import { LifespanBars, type VizLayout } from './LifespanBars';
import { TimeAxis } from './TimeAxis';
import { Playhead } from './Playhead';
import { HoverTooltip } from './HoverTooltip';
import { CameraRig } from './CameraRig';

export interface SceneProps {
  layout: VizLayout;
}

/**
 * Scene content, mounted inside <Canvas> (see VizCanvas.tsx). Renders the fixed
 * dark "void" background/fog/floor grid regardless of whether a log is loaded --
 * that's the idle-state placeholder 3D scene -- and adds the bars/axis/playhead/
 * tooltip only once real pairs exist.
 */
export function Scene({ layout }: SceneProps) {
  const hasLog = layout.items.length > 0;

  return (
    <>
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <fog attach="fog" args={[SCENE_BACKGROUND, 40, 115]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight intensity={0.25} color="#8fb4ff" groundColor="#1a1a19" />

      <Grid
        position={[0, -0.02, 0]}
        args={[10, 10]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#2c2c2a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#3a3a37"
        fadeDistance={100}
        fadeStrength={1.2}
        infiniteGrid
      />

      {hasLog ? (
        <>
          <LifespanBars layout={layout} />
          <TimeAxis sessionStart={layout.sessionStart} sessionEnd={layout.sessionEnd} laneCount={layout.laneCount} />
          <Playhead sessionStart={layout.sessionStart} sessionEnd={layout.sessionEnd} laneCount={layout.laneCount} />
          <HoverTooltip layout={layout} />
        </>
      ) : null}

      <CameraRig hasLog={hasLog} sessionStart={layout.sessionStart} sessionEnd={layout.sessionEnd} />
    </>
  );
}
