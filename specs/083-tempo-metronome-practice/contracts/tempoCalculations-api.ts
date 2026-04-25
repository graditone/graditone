/**
 * Contract: Updated `tempoCalculations` public API
 * Feature 083 — Tempo Slider Range Extension & Practice Metronome Deferred Start
 *
 * This file documents the public surface of
 * `frontend/src/utils/tempoCalculations.ts` after this feature.
 *
 * The contract is consumed by:
 *  - frontend/plugins/play-score/playbackToolbar.tsx
 *  - frontend/plugins/practice-view-plugin/practiceToolbar.tsx
 *  - frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx
 *  - frontend/src/services/state/TempoStateContext.tsx  (unchanged usage)
 *
 * Tests: frontend/src/utils/tempoCalculations.test.ts
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum tempo multiplier: 10% (one-tenth speed). FR-001. */
export declare const MIN_TEMPO_MULTIPLIER: 0.1;

/** Maximum tempo multiplier: 200% (double speed). FR-001. */
export declare const MAX_TEMPO_MULTIPLIER: 2.0;

/** Default tempo multiplier: 100% (original score tempo). */
export declare const DEFAULT_TEMPO_MULTIPLIER: 1.0;

/**
 * Absolute minimum playback BPM regardless of tempo multiplier. FR-014.
 * When 10% of the score's original BPM falls below this floor, the slider
 * minimum is clamped upward so the user cannot set playback below 10 BPM.
 */
export declare const ABSOLUTE_BPM_FLOOR: 10;

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Clamp a tempo multiplier to the valid range [MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER].
 *
 * Used on IndexedDB load (FR-009) and whenever an external value is ingested.
 *
 * @param multiplier — Raw tempo multiplier (any number)
 * @returns Value clamped to [0.1, 2.0]
 *
 * @example
 * clampTempoMultiplier(0.05) // → 0.1
 * clampTempoMultiplier(0.8)  // → 0.8
 * clampTempoMultiplier(3.0)  // → 2.0
 */
export declare function clampTempoMultiplier(multiplier: number): number;

/**
 * Compute the effective minimum tempo multiplier for a score, accounting for
 * the ABSOLUTE_BPM_FLOOR. (FR-014)
 *
 * For most scores (original BPM ≥ 100), this returns MIN_TEMPO_MULTIPLIER (0.1).
 * For unusually slow scores (e.g. 40 BPM Largo), the floor clamps the minimum
 * upward so playback never drops below 10 BPM.
 *
 * @param originalBpm — Score's base BPM as reported by the WASM layout engine
 *                       (NOT multiplied by tempoMultiplier)
 * @returns Effective minimum multiplier in [MIN_TEMPO_MULTIPLIER, 1.0]
 *
 * @example
 * computeEffectiveMinMultiplier(120) // → 0.1   (10 / 120 < 0.1 → use 0.1)
 * computeEffectiveMinMultiplier(40)  // → 0.25  (10 / 40 = 0.25 > 0.1)
 * computeEffectiveMinMultiplier(0)   // → 0.1   (defensive fallback)
 */
export declare function computeEffectiveMinMultiplier(originalBpm: number): number;

/**
 * Convert a tempo multiplier to an integer percentage.
 *
 * @param multiplier — Tempo multiplier (0.1 to 2.0)
 * @returns Integer percentage (10 to 200)
 *
 * @example
 * multiplierToPercentage(1.0)  // → 100
 * multiplierToPercentage(0.1)  // → 10
 * multiplierToPercentage(2.0)  // → 200
 */
export declare function multiplierToPercentage(multiplier: number): number;

/**
 * Convert a percentage to a tempo multiplier.
 *
 * @param percentage — Integer percentage (10 to 200)
 * @returns Tempo multiplier (0.10 to 2.0)
 *
 * @example
 * percentageToMultiplier(100) // → 1.0
 * percentageToMultiplier(10)  // → 0.1
 */
export declare function percentageToMultiplier(percentage: number): number;

/**
 * Calculate the effective BPM given an original BPM and a tempo multiplier.
 *
 * @param originalBpm  — Base BPM from the score
 * @param multiplier   — Tempo multiplier (0.1 to 2.0)
 * @returns Effective BPM = round(originalBpm * multiplier)
 */
export declare function calculateEffectiveTempo(originalBpm: number, multiplier: number): number;
