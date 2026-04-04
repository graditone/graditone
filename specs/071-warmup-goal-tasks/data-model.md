# Data Model: Warm-Up Goal Tasks for Sessions (Feature 071)

## Modified Entities

### `ScoreRef` (sessionTypes.ts)

```typescript
// BEFORE
export interface ScoreRef {
  readonly type: 'preloaded' | 'user';
  readonly id: string;
}

// AFTER — add 'warmup-scale' as third member
export interface ScoreRef {
  readonly type: 'preloaded' | 'user' | 'warmup-scale';
  readonly id: string;
  // When type === 'warmup-scale': id holds the scale identifier (e.g. 'c-major')
}
```

**Impact**: `TaskRow.tsx` `scoreUnavailable` check uses `task.scoreRef.type === 'preloaded'` — `'warmup-scale'` tasks evaluate `scoreUnavailable = false` automatically (no code change needed there).

---

### `GoalType` (goalTypes.ts)

```typescript
// BEFORE
export type GoalType = 'learn-score-phrase';

// AFTER
export type GoalType = 'learn-score-phrase' | 'warm-up-scales';
```

---

### `Goal` (goalTypes.ts)

```typescript
// Additions only — existing fields unchanged
export interface Goal {
  // ...all existing fields preserved...

  /** Feature 071: Scale identifier for warm-up-scales goals (e.g. 'c-major'). */
  readonly warmUpScaleId?: string;
  /** Feature 071: Number of sessions the user requested to receive this warm-up task. */
  readonly warmUpSessionCount?: number;
}
```

For `type: 'warm-up-scales'` goals:
- `scoreRef`: `{ type: 'warmup-scale', id: scaleId }`
- `scoreTitle`: scale display name + " Warm-Up" (e.g. "C Major Warm-Up")
- `startMeasure`: `0` (unused sentinel)
- `endMeasure`: `0` (unused sentinel)
- `warmUpScaleId`: same as `scoreRef.id` (duplicate for clarity)
- `warmUpSessionCount`: user-configured value (e.g. 5)
- `taskIds`: array containing the single warm-up task ID that was injected into each session (one per session)
- `sessionIds`: populated during injection — contains only sessions that had free time

**State transitions**: `active` → `completed` (when `checkGoalCompletionAcrossSessions` returns `'completed'`). Same as `learn-score-phrase` — the function is goal-type-agnostic.

---

### `GoalIndexEntry` (goalTypes.ts)

No changes needed. `tasksDone` and `tasksTotal` are computed from the task list during goal-index update, which is goal-type-agnostic.

---

### `GoalCreationFormParams` (goalTypes.ts)

```typescript
// Existing type — unchanged (used by LearnScorePhraseGoal form)
export interface GoalCreationFormParams {
  scoreRef: ScoreRef;
  scoreTitle: string;
  loopCount: number;
  minResult: number;
  tempoMultiplier: number;
}

// NEW — params for WarmUpGoalCreationForm
export interface WarmUpGoalCreationFormParams {
  /** Always 'warm-up-scales' for this type. */
  goalType: 'warm-up-scales';
  /** Scale identifier (e.g. 'c-major'). */
  scaleId: string;
  /** Scale display name (e.g. 'C Major'). */
  scaleDisplayName: string;
  /** Tempo as multiplier (0.5–2.0). */
  tempoMultiplier: number;
  /** Number of times the scale must be played per task completion. Integer [1, 20]. */
  loopCount: number;
  /** Minimum accuracy % to mark the task done. Integer [0, 100]. */
  minResult: number;
  /** Number of existing sessions to inject the warm-up task into. Integer ≥ 1. Default: 5. */
  sessionCount: number;
}
```

---

## New Entities

### `WarmUpTaskConfig` (navigation contract — not persisted)

Used as the payload passed via `context.openPlugin('train-view', { warmUpTaskConfig })`:

```typescript
export interface WarmUpTaskConfig {
  taskId: string;
  sessionId: string;
  sessionName: string;
  /** Scale identifier (e.g. 'c-major'). Matches a SCALE_OPTIONS entry in train-view. */
  scaleId: string;
  /** Tempo multiplier as set on the goal (0.5–2.0). */
  tempoMultiplier: number;
  /** Iterations (loopCount) as set on the goal. */
  loopCount: number;
  /** Minimum accuracy score as set on the goal. */
  minResult: number;
}
```

---

## Warm-Up Scale Task Shape (how it appears as a SessionTask)

Warm-up tasks are stored as regular `SessionTask` objects. Their field values follow these conventions:

| Field | Value for Warm-Up Tasks |
|-------|------------------------|
| `scoreRef.type` | `'warmup-scale'` |
| `scoreRef.id` | scale identifier (e.g. `'c-major'`) |
| `scoreTitle` | scale display name (e.g. `'C Major'`) |
| `regionType` | `'all'` |
| `startMeasure` | `null` |
| `endMeasure` | `null` |
| `staffIndex` | `-1` (both hands) |
| `loopCount` | user-configured (default 10) |
| `tempoMultiplier` | user-configured (default 1.0) |
| `minResult` | user-configured (default 90) |
| `estimatedDurationSecs` | `300` (5 minutes, fixed) |
| `goalId` | ID of the parent warm-up goal |
| `status` | `'todo'` initially |
| `currentRound` | `0` |
| `linkedPractices` | `[]` |
| `difficulty` | `undefined` (not applicable) |

---

## Injection Logic: `insertWarmUpTaskIntoSessions`

**Location**: `goalEngine.ts` (pure function, no side effects)

**Signature**:
```typescript
export function insertWarmUpTaskIntoSessions(
  warmUpTask: SessionTask,
  sessions: Session[],
  maxCount: number,
  warmUpDurationSecs: number,
): Session[]
```

**Algorithm**:
1. Sort sessions by `targetDate` ascending (earliest first).
2. For each session (up to `maxCount` matches):
   - Compute `usedTime = sum(task.estimatedDurationSecs ?? 0 for task in session.tasks)`
   - Compute `freeTime = (session.availableTime ?? 0) <= 0 ? Infinity : session.availableTime - usedTime`
   - If `freeTime >= warmUpDurationSecs` (or unlimited): prepend `warmUpTask` to `session.tasks`; add session to result list.
3. Return array of modified sessions (caller persists them).

**Side effects**: None — returns new Session objects (immutable-style updates). Caller (`GoalsView`) persists via `saveSessionToIndexedDB` + updates indexes.

---

## Goal Creation Flow (GoalsView, warm-up path)

```
User submits WarmUpGoalCreationForm
  ↓
[GoalsView] createWarmUpGoal(params) → { goal, task }   [pure, no side effects]
  ↓
[GoalsView] load all existing sessions from IndexedDB
  ↓
[GoalsView] insertWarmUpTaskIntoSessions(task, sessions, params.sessionCount, 300)
  → returns modified sessions (up to sessionCount)
  ↓
[GoalsView] for each modified session:
    saveSessionToIndexedDB(modifiedSession)
    updateSessionIndex(modifiedSession)
  ↓
[GoalsView] populate goal.sessionIds = [...modifiedSessionIds]
    populate goal.taskIds = [task.id, task.id, ...] one per session
  ↓
[GoalsView] saveGoal(goal)
  ↓
[GoalsView] refreshGoals() + refreshSessions()
```

> **Note**: Each session receives its own copy of the warm-up task (same `goalId`, unique `id` per task). This lets `checkGoalCompletionAcrossSessions` operate correctly — it collects all tasks with matching `goalId` from `goal.sessionIds`.
