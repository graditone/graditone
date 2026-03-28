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
  /** 0–100, clamped. */
  readonly score: number;
}

/**
 * Compute the practice score from an array of note results.
 * Returns `null` when the array is empty (no notes to score).
 */
export function computePracticeScore(
  noteResults: ReadonlyArray<ScorableNoteResult>,
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

  return { totalNotes, correctCount, lateCount, earlyReleaseCount, totalWrongAttempts, score };
}
