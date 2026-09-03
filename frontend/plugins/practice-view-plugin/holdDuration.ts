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
 * Early-acceptance tuning (feature 098, follow-up): a hold is accepted once the
 * player has held for (1 − EARLY_ACCEPTANCE_RATIO) of the required duration,
 * with the early margin capped at EARLY_ACCEPTANCE_CAP_MS. This grants the
 * player a small release margin before the note's notated end so they can begin
 * repositioning their fingers for the next chord — while still requiring ~85%
 * of the duration to actually be held (feature 099: tuned down from 25% / 1500ms
 * for greater accuracy).
 *
 * For a whole-note chord filling a 4/4 measure this yields roughly a half-beat
 * margin at typical practice tempos (60 BPM whole note → 15% ≈ 600 ms).
 */
export const EARLY_ACCEPTANCE_RATIO = 0.15;
export const EARLY_ACCEPTANCE_CAP_MS = 750;

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
 * The wall-clock duration at which a hold is accepted: the required duration
 * minus the early-acceptance margin (ratio × required, capped at
 * EARLY_ACCEPTANCE_CAP_MS) so very long notes at ultra-low tempos are never
 * accepted absurdly early, while short-to-moderate notes get a comfortable
 * release margin.
 *
 * Returns 0 when `requiredHoldMs <= 0` (no hold requested).
 */
export function computeHoldAcceptanceMs(requiredHoldMs: number): number {
  return requiredHoldMs > 0
    ? requiredHoldMs - Math.min(requiredHoldMs * EARLY_ACCEPTANCE_RATIO, EARLY_ACCEPTANCE_CAP_MS)
    : 0;
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