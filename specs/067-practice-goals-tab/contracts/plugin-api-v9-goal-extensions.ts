/**
 * Plugin API v9 — Goal Extensions (Feature 067)
 *
 * Contract for the new getPhrases() method on PluginScorePlayerContext
 * and the GoalsView component interface.
 */

import type { PhraseRegion } from '../../../frontend/src/types/score';
import type { ScoreRef, SessionTask } from '../../../plugins-external/sessions-plugin/sessionTypes';

// ---------------------------------------------------------------------------
// Plugin API extension: getPhrases()
// ---------------------------------------------------------------------------

/**
 * Extension to PluginScorePlayerContext (added in v9).
 *
 * Returns detected musical phrase regions for the currently loaded score.
 * Returns null if no score is loaded (status !== 'ready').
 * Returns an empty array if the score has no detected phrases.
 *
 * @example
 * const phrases = context.scorePlayer.getPhrases();
 * if (phrases && phrases.length > 0) {
 *   const firstPhrase = phrases[0]; // smallest start_measure for instrument 0
 * }
 */
export interface PluginScorePlayerContextV9Extension {
  getPhrases(): ReadonlyArray<PhraseRegion> | null;
}

// ---------------------------------------------------------------------------
// Goal storage contract
// ---------------------------------------------------------------------------

export type GoalType = 'learn-score-phrase';
export type GoalStatus = 'active' | 'completed';

export interface Goal {
  readonly id: string;
  readonly type: GoalType;
  readonly title: string;
  readonly scoreRef: ScoreRef;
  readonly scoreTitle: string;
  readonly createdAt: string;
  status: GoalStatus;
  readonly startMeasure: number;
  readonly endMeasure: number;
  readonly taskIds: readonly string[];
  sessionId: string | null;
}

export interface GoalIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly scoreTitle: string;
  readonly createdAt: string;
  status: GoalStatus;
  tasksDone: number;
  tasksTotal: number;
}

// ---------------------------------------------------------------------------
// Goal engine contract: createGoal()
// ---------------------------------------------------------------------------

export interface CreateGoalInput {
  /** Score reference (preloaded or user). */
  scoreRef: ScoreRef;
  /** Score display title. */
  scoreTitle: string;
  /** Detected phrase regions for the score (from getPhrases()). */
  phrases: ReadonlyArray<PhraseRegion>;
  /** Number of staves in the score (from ScorePlayerState.staffCount). */
  staffCount: number;
  /** Measure end ticks (from getMeasureEndTicks()), used for fallback calculation. */
  measureEndTicks: ReadonlyArray<number>;
}

export interface CreateGoalResult {
  /** The created Goal entity (already persisted). */
  goal: Goal;
  /** The generated SessionTask entities (already embedded in the session). */
  tasks: SessionTask[];
  /** The auto-created scheduled session ID. */
  sessionId: string;
}

/**
 * Goal engine: Pure function that computes goal data, tasks, and session parameters.
 *
 * Logic:
 * 1. Select first phrase: filter phrases where instrument_index === 0,
 *    sort by start_measure ascending, pick first. Fallback: measures 0–3
 *    (or 0..totalMeasures-1 if fewer than 4 measures).
 * 2. Generate tasks:
 *    - If staffCount >= 2: 3 tasks (RH staffIndex=0, LH staffIndex=1, TH staffIndex=-1)
 *    - If staffCount === 1: 1 task (TH staffIndex=-1)
 *    - Each task: loopCount=10, minResult=90, tempoMultiplier=1.0, status='todo'
 * 3. Compute targetDate: tomorrow (current date + 1 day, ISO 8601 date string).
 * 4. Return CreateGoalResult with all entities ready for persistence.
 */
export type CreateGoalFn = (input: CreateGoalInput) => CreateGoalResult;

// ---------------------------------------------------------------------------
// Goal storage contract: CRUD operations
// ---------------------------------------------------------------------------

export interface GoalStorageContract {
  /** Save a goal to IndexedDB and update localStorage index. */
  saveGoal(goal: Goal): Promise<void>;
  /** Load a goal by ID from IndexedDB. Returns null if not found. */
  loadGoal(id: string): Promise<Goal | null>;
  /** Delete a goal from IndexedDB and remove from localStorage index. */
  deleteGoal(id: string): Promise<void>;
  /** List all goal index entries from localStorage (fast). */
  listGoalsIndex(): GoalIndexEntry[];
  /** Update the goal index entry for a specific goal. */
  updateGoalIndex(id: string, updates: Partial<GoalIndexEntry>): void;
  /** Load all goals from IndexedDB (for full data access). */
  loadAllGoals(): Promise<Goal[]>;
  /** Check if a goal already exists for a given score reference. */
  hasGoalForScore(scoreRef: ScoreRef): boolean;
}

// ---------------------------------------------------------------------------
// SessionTask extension (Feature 067 addition)
// ---------------------------------------------------------------------------

/**
 * Extends the existing SessionTask with an optional goalId field.
 * This is additive — all existing SessionTask fields remain unchanged.
 */
export interface SessionTaskGoalExtension {
  /** Feature 067: Optional reference to the originating goal. */
  readonly goalId?: string;
}

/**
 * Extends the existing Session with an optional goalId field.
 * This is additive — all existing Session fields remain unchanged.
 */
export interface SessionGoalExtension {
  /** Feature 067: ID of the goal that auto-created this session, if any. */
  readonly goalId?: string;
}
