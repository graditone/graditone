/**
 * Tempo Calculation Utilities
 * 
 * Feature 008 - Tempo Change: Utility functions for tempo multiplier calculations
 */

/**
 * Minimum tempo multiplier: 10% (slowest selectable speed)
 */
export const MIN_TEMPO_MULTIPLIER = 0.1;

/**
 * Absolute BPM floor: the lowest effective playback BPM allowed.
 * Used by computeEffectiveMinMultiplier to prevent inaudibly slow playback
 * for scores that have a slow original BPM.
 */
export const ABSOLUTE_BPM_FLOOR = 10;

/**
 * Maximum tempo multiplier: 200% (double speed)
 */
export const MAX_TEMPO_MULTIPLIER = 2.0;

/**
 * Default tempo multiplier: 100% (no change)
 */
export const DEFAULT_TEMPO_MULTIPLIER = 1.0;

/**
 * Clamp tempo multiplier to valid range [MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER].
 *
 * @param multiplier - Tempo multiplier to clamp
 * @returns Clamped value within [0.1, 2.0]
 *
 * @example
 * clampTempoMultiplier(0.05); // Returns 0.1
 * clampTempoMultiplier(1.5);  // Returns 1.5
 * clampTempoMultiplier(3.0);  // Returns 2.0
 */
export function clampTempoMultiplier(multiplier: number): number {
  return Math.max(MIN_TEMPO_MULTIPLIER, Math.min(MAX_TEMPO_MULTIPLIER, multiplier));
}

/**
 * Compute the effective minimum tempo multiplier for a given score BPM.
 *
 * Ensures that the absolute playback BPM never drops below ABSOLUTE_BPM_FLOOR
 * (10 BPM), even when the user drags the slider to the global minimum (10%).
 * For scores with an original BPM ≥ 100, this returns MIN_TEMPO_MULTIPLIER
 * (0.1) unchanged. For slower scores the floor is raised proportionally.
 *
 * @param originalBpm - Score's original BPM from the player state
 * @returns Effective minimum multiplier in [0.1, 2.0]
 *
 * @example
 * computeEffectiveMinMultiplier(120); // 0.1  (12 BPM > floor)
 * computeEffectiveMinMultiplier(40);  // 0.25 (10/40)
 * computeEffectiveMinMultiplier(0);   // 0.1  (defensive)
 */
export function computeEffectiveMinMultiplier(originalBpm: number): number {
  if (originalBpm <= 0) return MIN_TEMPO_MULTIPLIER;
  return Math.max(MIN_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR / originalBpm);
}

/**
 * Convert tempo multiplier to percentage
 * 
 * @param multiplier - Tempo multiplier (0.5 to 2.0)
 * @returns Percentage (50 to 200)
 * 
 * @example
 * multiplierToPercentage(1.0);  // Returns 100
 * multiplierToPercentage(0.8);  // Returns 80
 * multiplierToPercentage(1.5);  // Returns 150
 */
export function multiplierToPercentage(multiplier: number): number {
  return Math.round(multiplier * 100);
}

/**
 * Convert percentage to tempo multiplier
 * 
 * @param percentage - Percentage (50 to 200)
 * @returns Tempo multiplier (0.5 to 2.0)
 * 
 * @example
 * percentageToMultiplier(100);  // Returns 1.0
 * percentageToMultiplier(80);   // Returns 0.8
 * percentageToMultiplier(150);  // Returns 1.5
 */
export function percentageToMultiplier(percentage: number): number {
  return percentage / 100;
}

/**
 * Calculate effective tempo from original tempo and multiplier
 * 
 * @param originalTempo - Original tempo in BPM
 * @param multiplier - Tempo multiplier (0.5 to 2.0)
 * @returns Effective tempo in BPM (rounded)
 * 
 * @example
 * calculateEffectiveTempo(120, 1.0);  // Returns 120
 * calculateEffectiveTempo(120, 0.8);  // Returns 96
 * calculateEffectiveTempo(120, 1.5);  // Returns 180
 */
export function calculateEffectiveTempo(originalTempo: number, multiplier: number): number {
  return Math.round(originalTempo * multiplier);
}
