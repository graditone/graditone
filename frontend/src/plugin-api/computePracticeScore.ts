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
  /** 0–100, clamped. Based solely on accuracy — tempo does not affect max score. */
  readonly score: number;
  /** The tempoMultiplier recorded for informational purposes. 1.0 when not supplied. */
  readonly tempoMultiplier: number;
}

/**
 * Compute the practice score from an array of note results.
 *
 * @param noteResults    Per-note outcomes and wrong-attempt counts.
 * @param tempoMultiplier  Optional tempo multiplier, recorded in the breakdown for
 *                         informational purposes only. Does not affect the score —
 *                         a perfect performance always earns 100 regardless of tempo.
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

  const score = Math.max(0, Math.min(100, rawScore));
  const safeMult = tempoMultiplier != null && tempoMultiplier > 0 ? tempoMultiplier : 1.0;

  return { totalNotes, correctCount, lateCount, earlyReleaseCount, totalWrongAttempts, score, tempoMultiplier: safeMult };
}
