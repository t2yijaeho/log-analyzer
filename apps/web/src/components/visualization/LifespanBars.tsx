import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, PositionMesh } from '@react-three/drei';
import * as THREE from 'three';
import type { LogEventPair } from '@log-analyzer/core';
import { assignLanes, laneCountOf, type LaneItem } from '../../utils/laneAssignment';
import { percentile } from '../../utils/format';
import { OUTCOME_STYLES } from '../../theme/outcomeColors';
import { useVizStore } from '../../state/useVizStore';
import {
  HEIGHT_CLAMP_PERCENTILE,
  LANE_FILL,
  LANE_SPACING,
  MAX_BAR_HEIGHT,
  MIN_BAR_HEIGHT,
  MIN_BAR_LENGTH,
  SCENE_WIDTH,
} from './constants';

export interface BarLayoutItem {
  pair: LogEventPair;
  /** Center position, in scene units: [x=time, y=latency/2, z=lane]. */
  position: [number, number, number];
  /** Box dimensions: [length(x, duration), height(y, latency), thickness(z, lane width)]. */
  size: [number, number, number];
  lane: number;
  isOutlier: boolean;
  startElapsed: number;
  endElapsed: number;
  /** Precomputed outcome-scaled color (outcome hex x intensity, boosted for outliers). */
  baseColor: THREE.Color;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface VizLayout {
  items: BarLayoutItem[];
  sessionStart: number;
  sessionEnd: number;
  laneCount: number;
}

const EMPTY_LAYOUT: VizLayout = { items: [], sessionStart: 0, sessionEnd: 1, laneCount: 1 };

/**
 * Pure spatial mapping from parsed pairs to 3D layout -- shared by LifespanBars
 * (the actual instanced meshes) and HoverTooltip (which anchors on the same
 * positions). See constants.ts for the shared spatial constants.
 *
 *   X = time (SCENE_WIDTH fixed regardless of session length)
 *   Z = lane, via greedy interval-scheduling (utils/laneAssignment)
 *   Y = latency, clamped to the log's own p95 (outliers flat-cap + brighten instead
 *       of stretching every other bar down to nothing)
 *   bar length (X-span) = duration -- the primary, non-redundant duration encoding
 *   color = outcome (theme/outcomeColors) -- always paired with text elsewhere
 *       (Legend, HoverTooltip, SelectedPairPanel), never color alone
 */
export function computeBarLayout(pairs: readonly LogEventPair[]): VizLayout {
  if (pairs.length === 0) return EMPTY_LAYOUT;

  let sessionStart = Infinity;
  let sessionEnd = -Infinity;
  for (const pair of pairs) {
    const start = pair.requestElapsedSeconds;
    const end = pair.terminalElapsedSeconds ?? start;
    sessionStart = Math.min(sessionStart, start);
    sessionEnd = Math.max(sessionEnd, end);
  }
  if (!Number.isFinite(sessionStart)) sessionStart = 0;
  if (!Number.isFinite(sessionEnd) || sessionEnd <= sessionStart) sessionEnd = sessionStart + 1;
  const sessionDuration = sessionEnd - sessionStart;
  const xScale = SCENE_WIDTH / sessionDuration;

  const intervals: LaneItem[] = pairs.map((pair) => {
    const start = pair.requestElapsedSeconds;
    // A true PENDING pair (no terminal event at all) extends to the session end so it
    // still reads as "still going" instead of collapsing to a zero-width sliver.
    const end = pair.terminalElapsedSeconds ?? (pair.outcome === 'PENDING' ? sessionEnd : start);
    return { id: pair.id, start, end };
  });
  const laneAssignment = assignLanes(intervals);
  const laneCount = Math.max(1, laneCountOf(laneAssignment));

  const latencyValues: number[] = [];
  for (const pair of pairs) {
    if (typeof pair.latencySeconds === 'number' && Number.isFinite(pair.latencySeconds) && pair.latencySeconds >= 0) {
      latencyValues.push(pair.latencySeconds);
    }
  }
  latencyValues.sort((a, b) => a - b);
  const p95 = Math.max(percentile(latencyValues, HEIGHT_CLAMP_PERCENTILE), 0.001);

  const laneThickness = LANE_SPACING * LANE_FILL;

  const items = pairs.map((pair, i): BarLayoutItem => {
    const interval = intervals[i];
    const lane = laneAssignment.get(pair.id) ?? 0;

    const rawLatency = pair.latencySeconds ?? Math.max(interval.end - interval.start, 0);
    const isOutlier = rawLatency > p95;
    const heightRatio = clamp01(rawLatency / p95);
    const height = Math.max(heightRatio * MAX_BAR_HEIGHT, MIN_BAR_HEIGHT);

    const length = Math.max((interval.end - interval.start) * xScale, MIN_BAR_LENGTH);
    const centerX = (interval.start - sessionStart + (interval.end - interval.start) / 2) * xScale - SCENE_WIDTH / 2;
    const centerZ = lane * LANE_SPACING - ((laneCount - 1) * LANE_SPACING) / 2;

    const style = OUTCOME_STYLES[pair.outcome];
    // Outliers get a brighter edge on top of their outcome's base intensity, per the
    // plan's "flat-capped top + brighter emissive edge" treatment.
    const intensity = isOutlier ? style.intensity * 1.35 : style.intensity;
    const baseColor = new THREE.Color(style.hex).multiplyScalar(intensity);

    return {
      pair,
      position: [centerX, height / 2, centerZ],
      size: [length, height, laneThickness],
      lane,
      isOutlier,
      startElapsed: interval.start,
      endElapsed: interval.end,
      baseColor,
    };
  });

  return { items, sessionStart, sessionEnd, laneCount };
}

export interface LifespanBarsProps {
  layout: VizLayout;
}

/**
 * Renders every bar as one GPU-instanced draw call (drei's <Instances>/<Instance>),
 * which is also what gives every bar per-instance pointer events for free. Colors are
 * unlit (`meshBasicMaterial`) and driven entirely through each instance's `color`
 * (three.js's built-in `instanceColor` support) rather than material `emissive*`
 * uniforms, precisely so a single shared material can still show a different "pop"
 * per bar: outcome intensity multipliers can push a channel's float above 1.0 (see
 * theme/outcomeColors.ts), which survives into the postprocessing bloom pass even
 * though it would clip if written through a plain CSS hex string.
 *
 * Hover/select/pending-pulse/active-at-playhead visual feedback is applied by
 * mutating each instance's `color`/`scale` directly inside `useFrame` -- never a
 * React state setter -- reading `useVizStore.getState()` imperatively so this
 * component never re-renders 500-1000 instances just because the user moved the
 * mouse. Only the *discrete* hover/select events themselves go through
 * `useVizStore`'s `set` (via onPointerOver/onPointerOut/onClick below), for the
 * benefit of other, non-per-frame consumers (HoverTooltip, SelectedPairPanel).
 */
export function LifespanBars({ layout }: LifespanBarsProps) {
  const instanceRefs = useRef(new Map<string, PositionMesh>()).current;
  const tmpColor = useRef(new THREE.Color()).current;

  useFrame((state) => {
    const { hoveredPairId, selectedPairId, scrubTime } = useVizStore.getState();
    const t = state.clock.getElapsedTime();
    const pulseFactor = 0.85 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.2));

    for (const item of layout.items) {
      const mesh = instanceRefs.get(item.pair.id);
      if (!mesh) continue;

      let multiplier = 1;
      if (item.pair.outcome === 'PENDING') multiplier *= pulseFactor;

      const isHovered = hoveredPairId === item.pair.id;
      const isSelected = selectedPairId === item.pair.id;
      if (isHovered) multiplier *= 1.35;
      if (isSelected) multiplier *= 1.6;

      const isActive = scrubTime >= item.startElapsed && scrubTime <= item.endElapsed;
      if (isActive) multiplier *= 1.25;

      tmpColor.copy(item.baseColor).multiplyScalar(multiplier);
      mesh.color.copy(tmpColor);

      const lift = isHovered || isSelected ? 1.18 : 1;
      mesh.scale.set(item.size[0] * lift, item.size[1], item.size[2] * lift);
    }
  });

  return (
    <Instances limit={Math.max(layout.items.length, 1)}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
      {layout.items.map((item) => (
        <Instance
          key={item.pair.id}
          ref={(el: PositionMesh | null) => {
            if (el) instanceRefs.set(item.pair.id, el);
            else instanceRefs.delete(item.pair.id);
          }}
          position={item.position}
          scale={item.size}
          color={[item.baseColor.r, item.baseColor.g, item.baseColor.b]}
          onPointerOver={(e) => {
            e.stopPropagation();
            useVizStore.getState().setHovered(item.pair.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            if (useVizStore.getState().hoveredPairId === item.pair.id) {
              useVizStore.getState().setHovered(null);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            useVizStore.getState().setSelected(item.pair.id);
          }}
        />
      ))}
    </Instances>
  );
}
