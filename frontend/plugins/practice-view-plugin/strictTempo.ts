/**
 * Practice View Plugin — Strict Tempo Helper (Feature 101, T004)
 *
 * Pure timing math for strict tempo evaluation. No React, no storage,
 * no audio, no runtime imports (Principle VI). Consumed by practiceEngine.ts;
 * type-only imports are allowed for consumers (practiceEngine.types.ts).
 *
 * Contract: specs/101-strict-tempo-mode/contracts/strict-tempo-engine-contract.md
 *
 * Exports:
 *   STRICT_WINDOW_RATIO / STRICT_WINDOW_MIN_MS / STRICT_WINDOW_MAX_MS /
 *     STRICT_FAILURE_LIMIT — contract constants
 *   computeStrictWindowMs(expectedGapMs) — tempo-relative window, 120–300 ms
 *   evaluateStrictOnset(params)          — grace anchoring + grid judgement
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Window is 40% of the expected gap to the previous practice note.
 * (Raised from 20% in the original spec so an average human performance
 * at moderate tempo is not near-impossible to play correctly.)
 */
export const STRICT_WINDOW_RATIO = 0.40;

/** Smallest allowed window in ms (fast tempos would otherwise be unplayable). */
export const STRICT_WINDOW_MIN_MS = 120;

/** Largest allowed window in ms (slow tempos become trivial otherwise). */
export const STRICT_WINDOW_MAX_MS = 300;

/** Consecutive strict failures that stop the session. */
export const STRICT_FAILURE_LIMIT = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A point on the absolute tempo grid for the current segment. */
export interface StrictAnchor {
  /** Expected onset of the grace note on the score clock. */
  readonly expectedTimeMs: number;
  /** Measured onset of the grace note on the practice clock. */
  readonly responseTimeMs: number;
}

/** Result of evaluating one note onset against the grid. */
export interface StrictEvaluation {
  /** Anchor in effect after this note. Always non-null: a grace note creates one. */
  readonly anchor: StrictAnchor;
  /** Signed deviation from the anchor grid. 0 for a grace note. */
  readonly deltaMs: number;
  /** Window applied to this note, 120–300 ms. */
  readonly windowMs: number;
  /** True when this note established/re-established the grid. */
  readonly isGrace: boolean;
  /** True when the note is on the beat (always true for a grace note). */
  readonly onBeat: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Tempo-relative window: 40% of the expected gap to the previous note,
 * clamped to 120–300 ms and rounded to an integer.
 * Non-finite or negative gaps use the floor (120 ms).
 */
export function computeStrictWindowMs(expectedGapMs: number): number {
  if (!Number.isFinite(expectedGapMs) || expectedGapMs <= 0) {
    return STRICT_WINDOW_MIN_MS;
  }
  const raw = STRICT_WINDOW_RATIO * expectedGapMs;
  return Math.round(clamp(raw, STRICT_WINDOW_MIN_MS, STRICT_WINDOW_MAX_MS));
}

/**
 * Evaluate one note onset against the current anchor grid.
 *
 * - `anchor === null` → grace note: establishes the anchor from the supplied
 *   expected/response times, returns `deltaMs = 0`, `onBeat = true`.
 * - Otherwise the note is judged: signed deviation
 *   `round((responseTimeMs - anchor.responseTimeMs) - (expectedTimeMs - anchor.expectedTimeMs))`
 *   against `computeStrictWindowMs(expectedGapMs)`; the input anchor is
 *   returned unchanged (a judged note never re-anchors).
 * - The comparison is inclusive: `|delta| === window` is on the beat.
 */
export function evaluateStrictOnset(params: {
  readonly anchor: StrictAnchor | null;
  readonly responseTimeMs: number;
  readonly expectedTimeMs: number;
  readonly expectedGapMs: number;
}): StrictEvaluation {
  const { anchor, responseTimeMs, expectedTimeMs, expectedGapMs } = params;

  if (anchor === null) {
    // Grace note — establishes/re-establishes the grid, never judged.
    return {
      anchor: { expectedTimeMs, responseTimeMs },
      deltaMs: 0,
      windowMs: computeStrictWindowMs(expectedGapMs),
      isGrace: true,
      onBeat: true,
    };
  }

  const deltaMs = Math.round(
    (responseTimeMs - anchor.responseTimeMs) - (expectedTimeMs - anchor.expectedTimeMs),
  );
  const windowMs = computeStrictWindowMs(expectedGapMs);

  return {
    anchor,
    deltaMs,
    windowMs,
    isGrace: false,
    onBeat: Math.abs(deltaMs) <= windowMs,
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
