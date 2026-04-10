/**
 * Contract: Goal Progress View
 * Feature: 077-arabesque-goal-review
 *
 * Defines the data shape that GoalsView exposes for per-phrase mastery reporting.
 * Consumed by: GoalsView.tsx (renderer)
 * Produced by: computePhraseProgress() in GoalsView or goalEngine.ts
 *
 * This is a VIEW CONTRACT — data is derived at render time, never persisted.
 */

// ---------------------------------------------------------------------------
// Inputs (already persisted in sessionStorage / goalStorage)
// ---------------------------------------------------------------------------

/**
 * A single practice task linked to a goal.
 * Subset of the full SessionTask type — only fields needed for progress derivation.
 */
export interface GoalTaskSummary {
  id: string;
  goalId: string;
  /** 1-based start measure of the phrase */
  startMeasure: number;
  /** 1-based end measure of the phrase */
  endMeasure: number;
  /** Staff variant: 0 = RH, 1 = LH, -1 = BH */
  staffIndex: number;
  status: 'todo' | 'in-progress' | 'done' | 'failed';
}

// ---------------------------------------------------------------------------
// Output (derived, not persisted)
// ---------------------------------------------------------------------------

export type PhraseMasteryStatus = 'mastered' | 'in-progress' | 'failed' | 'pending';

/**
 * Per-phrase mastery status derived from all task variants (RH, LH, BH)
 * for that phrase.
 *
 * Derivation rules (applied in order):
 *   1. mastered  — ALL task variants are 'done'
 *   2. failed    — ANY variant is 'failed' AND NOT all are 'done'
 *   3. in-progress — ANY variant is 'in-progress' (and not all done, none failed)
 *   4. pending   — ALL variants are 'todo'
 */
export interface PhraseProgress {
  /** 1-based, matches GoalTaskSummary.startMeasure */
  startMeasure: number;
  /** 1-based, matches GoalTaskSummary.endMeasure */
  endMeasure: number;
  /** Derived mastery status */
  status: PhraseMasteryStatus;
  /** Number of task variants in 'done' status */
  doneCount: number;
  /** Total task variants for this phrase (typically 3 for piano: RH, LH, BH) */
  totalCount: number;
}

/**
 * Full progress summary for a single learning goal.
 * Displayed in the expanded Goals tab section.
 */
export interface GoalProgressSummary {
  goalId: string;
  /** Ordered list of phrase progress entries (ascending by startMeasure) */
  phrases: PhraseProgress[];
  /** mastered phrases / total phrases × 100, rounded to nearest integer */
  completionPercentage: number;
  /** Number of mastered phrases */
  masteredPhraseCount: number;
  /** Total phrase count */
  totalPhraseCount: number;
}

// ---------------------------------------------------------------------------
// Derivation function signature (to be implemented in goalEngine.ts or GoalsView)
// ---------------------------------------------------------------------------

/**
 * Groups goal tasks by phrase range and derives mastery status for each phrase.
 *
 * @param tasks - All SessionTask objects belonging to the given goal,
 *                across all sessions linked to the goal.
 * @returns GoalProgressSummary — sorted by startMeasure, completionPercentage computed.
 */
export type ComputeGoalProgress = (
  goalId: string,
  tasks: readonly GoalTaskSummary[],
) => GoalProgressSummary;
