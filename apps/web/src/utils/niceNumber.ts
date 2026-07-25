/** Rounds a value up to a "nice" axis ceiling (1/2/5 x 10^n) so gridline labels
 *  read as clean numbers instead of an arbitrary max * 1.1. */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
