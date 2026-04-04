/**
 * computePracticeScore.ts — Shared practice score computation.
 *
 * Canonical formula for scoring a practice session. All consumers
 * (ResultsOverlay, PracticeViewPlugin save, sessions plugin) must
 * use this single implementation so scores are consistent everywhere.
 */

/** Minimal shape required from each note result — avoids coupling to practiceEngine types. */
export interface ScorableNoteResult {
  readonly outcome: string;
  readonly wrongAttempts: number;
}

export interface PracticeScoreBreakdown {
  readonly totalNotes: number;
  readonly correctCount: number;
  readonly lateCount: number;
  readonly earlyReleaseCount: number;
  readonly totalWrongAttempts: number;
  /** 0–100, clamped. Reflects tempo weighting when tempoMultiplier < 1.0. */
  readonly score: number;
  /** The tempoMultiplier applied to produce `score`. 1.0 when not supplied. */
  readonly tempoMultiplier: number;
}

/**
 * Compute the practice score from an array of note results.
 *
 * @param noteResults    Per-note outcomes and wrong-attempt counts.
 * @param tempoMultiplier  Optional tempo multiplier (0–∞). Values ≤ 0 or absent
 *                         default to 1.0. Values > 1.0 are clamped to 1.0 so a
 *                         perfect performance at any speed still earns 100.
 *                         Formula: `score = clamp(round(rawAccuracy × min(1.0, mult)), 0, 100)`
 *
 * Returns `null` when the array is empty (no notes to score).
 */
export function computePracticeScore(
  noteResults: ReadonlyArray<ScorableNoteResult>,
  tempoMultiplier?: number,
): PracticeScoreBreakdown | null {
  const totalNotes = noteResults.length;
  if (totalNotes === 0) return null;

  const correctCount = noteResults.filter((r) => r.outcome === 'correct').length;
  const lateCount = noteResults.filter((r) => r.outcome === 'correct-late').length;
  const earlyReleaseCount = noteResults.filter((r) => r.outcome === 'early-release').length;
  const totalWrongAttempts = noteResults.reduce((sum, r) => sum + r.wrongAttempts, 0);

  const rawScore =
    totalNotes > 0
      ? Math.round(
          ((correctCount + (lateCount + earlyReleaseCount) * 0.5) / totalNotes) * 100 -
            Math.min(totalWrongAttempts * 2, 30),
        )
      : 0;

  // Feature 072: Apply multiplicative tempo weighting.
  // Guard: treat absent, zero, or negative multipliers as neutral (1.0).
  const safeMult = tempoMultiplier != null && tempoMultiplier > 0 ? tempoMultiplier : 1.0;
  const effectiveMult = Math.min(1.0, safeMult);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * effectiveMult)));

  return { totalNotes, correctCount, lateCount, earlyReleaseCount, totalWrongAttempts, score, tempoMultiplier: effectiveMult };
}
