/**
 * stateLabel.ts — Formatting of the per-note State label in the practice
 * results overlay. Out-of-time notes display their signed timing deviation
 * in milliseconds. See specs/095-state-timing-ms/contracts/status-label-contract.md.
 */

/** Format a signed timing deviation (ms) for the note State column. */
export function formatStateLabel(relativeDeltaMs: number): string {
  if (relativeDeltaMs > 0) return `+${relativeDeltaMs} ms`;
  if (relativeDeltaMs < 0) return `${relativeDeltaMs} ms`;
  return '0 ms';
}