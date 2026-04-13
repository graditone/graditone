/**
 * Convert 1-based measure range to tick range using measure_end_ticks.
 * Returns null if inputs are out of range.
 */
export function measureRangeToTicks(
  startMeasure: number,
  endMeasure: number,
  measureEndTicks: ReadonlyArray<number>,
): { startTick: number; endTick: number } | null {
  const startIndex = startMeasure - 1; // 0-based
  const endIndex = endMeasure - 1;     // 0-based
  if (startIndex < 0 || endIndex >= measureEndTicks.length || startIndex > endIndex) return null;
  const startTick = startIndex === 0 ? 0 : measureEndTicks[startIndex - 1];
  const endTick = measureEndTicks[endIndex];
  return { startTick, endTick };
}
