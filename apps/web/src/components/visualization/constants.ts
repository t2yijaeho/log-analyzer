/** Shared spatial constants for the 3D lifespan-bar scene. Kept in one place so
 *  LifespanBars, TimeAxis, CameraRig and Playhead all agree on the same layout. */

/** Fixed scene width along X regardless of session length, for consistent framing. */
export const SCENE_WIDTH = 40;

/** Spacing between adjacent lanes along Z. */
export const LANE_SPACING = 1.1;

/** Fraction of LANE_SPACING a bar actually occupies (leaves a visible gap between lanes). */
export const LANE_FILL = 0.72;

/** Max bar height (Y) once latency is normalized against the log's own p95. */
export const MAX_BAR_HEIGHT = 6;

/** Floor height so zero/near-zero-latency bars stay visible as a sliver, not a hairline. */
export const MIN_BAR_HEIGHT = 0.06;

/** Floor length (X) so very short-duration requests stay visible/clickable. */
export const MIN_BAR_LENGTH = SCENE_WIDTH * 0.0015;

/** Latency percentile used to clamp bar height -- one pathological outlier shouldn't
 *  compress every other bar. Outliers still render (flat-capped), just not full scale. */
export const HEIGHT_CLAMP_PERCENTILE = 95;
