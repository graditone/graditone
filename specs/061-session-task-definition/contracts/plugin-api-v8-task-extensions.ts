/**
 * Contract: Plugin API v8 Task Extensions — Feature 061
 *
 * Defines the type extensions for task-based sessions.
 * These types extend existing interfaces in the sessions plugin
 * and plugin API without breaking backward compatibility.
 *
 * NOT a runtime module — this is a design contract document.
 */

// ---------------------------------------------------------------------------
// ScoreRef (existing — re-declared for reference)
// ---------------------------------------------------------------------------

interface ScoreRef {
  readonly type: 'preloaded' | 'user';
  readonly id: string;
}

// ---------------------------------------------------------------------------
// NEW: SessionTask
// ---------------------------------------------------------------------------

type TaskStatus = 'todo' | 'in-progress' | 'done' | 'failed';

interface TaskLinkedPractice {
  readonly savedPracticeId: string;
  readonly practiceScore: number;
  readonly completionStatus: 'complete' | 'partial';
  readonly createdAt: string;
  readonly round: number;
}

interface SessionTask {
  readonly id: string;
  readonly scoreRef: ScoreRef;
  readonly scoreTitle: string;
  readonly regionType: 'all' | 'measures';
  readonly startMeasure: number | null;
  readonly endMeasure: number | null;
  readonly staffIndex: number;       // 0=RH, 1=LH, -1=BH
  readonly loopCount: number;        // iterations per round, ≥1
  readonly tempoMultiplier: number;  // ratio 0.5–2.0
  readonly minResult: number;        // 0–100
  status: TaskStatus;
  currentRound: number;
  linkedPractices: TaskLinkedPractice[];
}

// ---------------------------------------------------------------------------
// EXTENDED: Session (adds tasks field)
// ---------------------------------------------------------------------------

interface Session {
  readonly id: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed';
  tasks: SessionTask[];                // NEW — empty for legacy sessions
  activities: SessionActivity[];
}

// ---------------------------------------------------------------------------
// EXTENDED: SessionActivity (adds optional taskId)
// ---------------------------------------------------------------------------

interface SessionActivity {
  readonly id: string;
  readonly type: 'score-practice';
  readonly createdAt: string;
  readonly savedPracticeId: string;
  readonly practiceName: string;
  readonly scoreTitle: string;
  readonly completionStatus: 'complete' | 'partial';
  readonly practiceScore: number;
  readonly correctCount: number;
  readonly totalNotes: number;
  readonly practiceTimeMs: number;
  readonly taskId?: string;            // NEW — optional ref to originating task
}

// ---------------------------------------------------------------------------
// EXTENDED: SessionIndexEntry (adds taskCount)
// ---------------------------------------------------------------------------

interface SessionIndexEntry {
  readonly id: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed';
  activityCount: number;
  taskCount: number;                   // NEW — 0 for legacy sessions
}

// ---------------------------------------------------------------------------
// EXTENDED: PracticeSavedEvent (adds optional taskId)
// ---------------------------------------------------------------------------

interface PracticeSavedEvent {
  readonly savedPracticeId: string;
  readonly practiceName: string;
  readonly scoreTitle: string;
  readonly completionStatus: 'complete' | 'partial';
  readonly savedAt: string;
  readonly practiceScore: number;
  readonly correctCount: number;
  readonly totalNotes: number;
  readonly practiceTimeMs: number;
  readonly taskId?: string;            // NEW — set when launched from a task
}

// ---------------------------------------------------------------------------
// Navigation Data: Task Launch
// ---------------------------------------------------------------------------

/**
 * When opening the practice view from a task's "Practice" link,
 * the sessions plugin calls:
 *
 *   context.openPlugin('practice-view-plugin', {
 *     taskConfig: { ... }
 *   });
 *
 * The practice view checks for navData.taskConfig on mount.
 */

interface TaskPracticeNavData {
  taskConfig: {
    taskId: string;
    scoreRef: ScoreRef;
    staffIndex: number;
    tempoMultiplier: number;
    loopCount: number;
    regionType: 'all' | 'measures';
    startMeasure: number | null;
    endMeasure: number | null;
  };
}

// ---------------------------------------------------------------------------
// Task Status Engine (pure function contract)
// ---------------------------------------------------------------------------

/**
 * computeTaskStatus — Pure function determining task status from linked practices.
 *
 * @param task - The current task state
 * @returns The new TaskStatus after evaluating linked practices
 *
 * Rules:
 * - No practices in current round → 'todo'
 * - At least one practice in current round, none ≥ minResult,
 *   count < loopCount → 'in-progress'
 * - Any practice in current round ≥ minResult → 'done'
 * - Practices in current round ≥ loopCount, none ≥ minResult → 'failed'
 */
type ComputeTaskStatus = (task: SessionTask) => TaskStatus;

// ---------------------------------------------------------------------------
// Storage Functions (extended)
// ---------------------------------------------------------------------------

/**
 * loadTasksFromLastSession — Returns task definitions (without status/linkedPractices)
 * from the most recently created session, for pre-populating the task builder.
 *
 * Returns null if no previous session exists.
 */
type LoadTasksFromLastSession = () => Promise<SessionTask[] | null>;

/**
 * updateTaskInSession — Updates a single task within a session in IndexedDB.
 * Used after a practice is linked to update status and linkedPractices.
 */
type UpdateTaskInSession = (
  sessionId: string,
  taskId: string,
  update: {
    status: TaskStatus;
    currentRound: number;
    linkedPractices: TaskLinkedPractice[];
  }
) => Promise<void>;
