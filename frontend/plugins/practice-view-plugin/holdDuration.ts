/**
 * Hold duration validation helpers (feature 098).
 *
 * Single source of truth for the practice-view hold-acceptance rule. The decision
 * to accept or reject a hold depends ONLY on the measured elapsed time versus the
 * required hold time — never on which event (release, press, or rAF tick) happens
 * to be processed first.
 *
 * Pure TypeScript: no React, no browser APIs, no side effects.
 */

// Minimum wall-clock hold duration (ms) required before the hold gate is engaged.
// Notes whose computed duration is <= this value need no hold.
export const HOLD_FLOOR_MS = 500;

/**
 * Compute the required hold duration in milliseconds for a note.
 * Returns 0 when `bpm <= 0` (guards against division-by-zero).
 *
 * PPQ = 960 pulses per quarter note.
 */
export function computeRequiredHoldMs(durationTicks: number, bpm: number): number {
  return bpm > 0 ? (durationTicks / ((bpm / 60) * PPQ)) * 1000 : 0;
}

/**
 * The wall-clock duration at which a hold is accepted: 90% of the required
 * duration, with the early-acceptance window capped at 500 ms so very long notes
 * at ultra-low tempos are never accepted more than 500 ms early.
 *
 * Returns 0 when `requiredHoldMs <= 0` (no hold requested).
 */
export function computeHoldAcceptanceMs(requiredHoldMs: number): number {
  return requiredHoldMs > 0 ? requiredHoldMs - Math.min(requiredHoldMs * 0.1, 500) : 0;
}

/**
 * True when a hold of `elapsedMs` satisfies the requirement for `requiredHoldMs`.
 * A hold is accepted once it reaches (or passes) the acceptance threshold, so a
 * release at exactly the boundary counts as a successful hold.
 */
export function isHoldAccepted(requiredHoldMs: number, elapsedMs: number): boolean {
  return requiredHoldMs > 0 && elapsedMs >= computeHoldAcceptanceMs(requiredHoldMs);
}

/** PPQ constant for tick→ms conversion (960 pulses per quarter note). */
const PPQ = 960;