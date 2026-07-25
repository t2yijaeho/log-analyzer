/**
 * Greedy interval-scheduling lane assignment -- the same class of algorithm used for
 * calendar/video-editor track assignment. Pure and framework-free so it's trivially
 * unit-testable in isolation.
 *
 * Sorts items by start time, then for each item finds the first lane whose most
 * recently placed item already ended at or before this item's start (no overlap) and
 * reuses it; opens a new lane only when every existing lane is still occupied. This
 * runs in O(n * laneCount) rather than O(n^2), which is trivial at the ~500-1000
 * items / ~20-30 lanes this app expects (real observed concurrency is ~8-15,
 * peaking ~20+).
 */

export interface LaneItem {
  id: string;
  /** Interval start, in whatever unit the caller is using (this app: elapsed seconds). */
  start: number;
  /** Interval end. If less than `start`, it is treated as equal to `start`. */
  end: number;
}

export function assignLanes(items: readonly LaneItem[]): Map<string, number> {
  const laneAssignment = new Map<string, number>();
  // laneEnds[i] = end time of the most recent item placed in lane i.
  const laneEnds: number[] = [];

  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);

  for (const item of sorted) {
    const end = Math.max(item.start, item.end);
    let placedLane = -1;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] <= item.start) {
        placedLane = lane;
        break;
      }
    }
    if (placedLane === -1) {
      placedLane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[placedLane] = end;
    }
    laneAssignment.set(item.id, placedLane);
  }

  return laneAssignment;
}

/** Total number of lanes actually used by a result from `assignLanes`. */
export function laneCountOf(laneAssignment: ReadonlyMap<string, number>): number {
  let max = -1;
  for (const lane of laneAssignment.values()) {
    if (lane > max) max = lane;
  }
  return max + 1;
}
