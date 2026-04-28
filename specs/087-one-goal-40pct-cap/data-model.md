# Data Model: One-Goal 40% Session Time Cap

**Feature**: `087-one-goal-40pct-cap`  
**Phase**: 1 — Design  
**Date**: 2026-04-28

---

## Entity Changes

### 1. `GoalPhraseGroup` — New Interface (`sessionDistribution.ts`)

Extends the existing `PhraseGroup` with a mandatory `goalId`. Used exclusively by `distributeMultiGoalTasks()`.

```typescript
// NEW: sessionDistribution.ts
export interface GoalPhraseGroup extends PhraseGroup {
  /** ID of the goal that owns this phrase group. */
  goalId: string;
}
```

**Existing `PhraseGroup`** (unchanged):
```typescript
export interface PhraseGroup {
  phraseIndex: number;
  tasks: SessionTask[];
  totalDuration: number;  // sum of estimatedDurationSecs for all tasks in group (0 for unknown)
}
```

**Where produced**: `GoalsView.tsx` (for the new goal's phrase groups, annotated from `createGoal()` result) and `goalEngine.reconstructPhraseGroupsFromTasks()` (for existing goals' pending tasks).

---

### 2. `DistributedSession` — Modified Interface (`sessionDistribution.ts`)

New optional `goalIds` field carries the set of goal IDs that contributed tasks to this session.

```typescript
// MODIFIED: sessionDistribution.ts
export interface DistributedSession {
  tasks: SessionTask[];
  totalEstimatedDurationSecs: number;
  availableTime: number;
  /** Feature 087: goal IDs that contributed tasks. Populated only for multi-goal sessions. */
  goalIds?: string[];
}
```

**Backward compatibility**: Field is optional; existing callers of `distributeTasks()` receive `undefined` for this field (single-goal path unchanged).

---

### 3. `Session` — Modified Interface (`sessionTypes.ts`)

New optional `goalIds` field for multi-goal sessions. The existing `goalId?: string` field is retained for single-goal sessions and warmup-injection sessions.

```typescript
// MODIFIED: sessionTypes.ts — inside Session interface
/** Feature 087: IDs of goals that contributed tasks to this multi-goal session. */
readonly goalIds?: readonly string[];
```

**Semantics**:
- Single-goal session: `goalId` is set, `goalIds` is `undefined` (existing behaviour).
- Multi-goal session: `goalId` is `undefined`, `goalIds` is set with 2+ entries.
- Warmup-injection: `goalId` is set (unchanged).

---

### 4. `SessionIndexEntry` — Modified Interface (`sessionTypes.ts`)

Same `goalIds` addition for fast list rendering without full session load.

```typescript
// MODIFIED: sessionTypes.ts — inside SessionIndexEntry interface
/** Feature 087: Mirrors Session.goalIds for fast list rendering. */
goalIds?: string[];
```

---

## New Domain Functions

### 5. `distributeMultiGoalTasks()` — New Function (`sessionDistribution.ts`)

Pure function. Distributes phrase groups from multiple goals into sessions with a 40% per-goal time cap.

```typescript
export function distributeMultiGoalTasks(
  groups: GoalPhraseGroup[],
  availableTime: number,
): DistributedSession[]
```

**Inputs**:
- `groups`: All phrase groups from all participating goals, each tagged with `goalId`. May be ordered arbitrarily across goals; the function maintains phraseIndex order within each goal via per-goal queues.
- `availableTime`: Session budget in seconds. `0` or `undefined` → unlimited (all tasks in one session).

**Algorithm** (see research.md Q4 for full description):
1. Group input into per-goal FIFO queues (ordered by `phraseIndex` ascending).
2. If `availableTime <= 0` or only one distinct goalId: delegate to `distributeTasks()`.
3. Compute `goalBudget = availableTime × 0.4`.
4. Greedy round-robin: for each session, iterate goals and admit the next phrase group if it fits within the per-goal budget AND the session total budget. The first group for any goal is always admitted (FR-005 best-effort).
5. Close the session when a full round-robin pass adds nothing. Open the next session.
6. Continue until all queues are empty.

**Output**: `DistributedSession[]` with `goalIds` populated per session (set of goalIds whose tasks appear in that session).

**Invariants**:
- All input groups appear in exactly one output session (no task dropped, no task duplicated).
- Each session's actual per-goal fraction ≤ 40% except when the first group of a goal is the only group remaining for that goal in the session (best-effort).
- `tasks` within a session maintain the same intra-goal phraseIndex order as the input.

---

### 6. `reconstructPhraseGroupsFromTasks()` — New Function (`goalEngine.ts`)

Pure function. Given a flat array of `SessionTask[]` from pending (scheduled) sessions of a goal, reconstructs `GoalPhraseGroup[]` for use in multi-goal redistribution.

```typescript
export function reconstructPhraseGroupsFromTasks(
  tasks: readonly SessionTask[],
): GoalPhraseGroup[]
```

**Logic**:
- Filter to tasks where `regionType === 'measures'` and `goalId !== undefined` and `status === 'todo'`.
- Exclude warmup tasks (`scoreRef.type === 'warmup-scale'`).
- Group by `(goalId, startMeasure, endMeasure)` — each unique tuple is one phrase group.
- Sort groups by `startMeasure` ascending within each goal (approximate phraseIndex restoration).
- `totalDuration` = sum of `estimatedDurationSecs` for each task in the group (undefined treated as 0).
- `phraseIndex` = rank of group within its goal after sorting.

**Preconditions**: All tasks belong to a single goal (callers filter by goalId before calling). Mixed-goal calls are not supported (function asserts uniform goalId).

**Returns**: `GoalPhraseGroup[]` with `goalId` set from the tasks.

---

## State Transitions During Multi-Goal Redistribution

When the user creates a new `learn-score-phrase` goal (Goal N) and K ≥ 1 other active `learn-score-phrase` goals already exist:

```
Before:
  Goal A → sessions [A1(scheduled), A2(scheduled), A3(active)]
  Goal B → sessions [B1(scheduled), B2(scheduled)]
  Goal N → (newly created, no sessions yet)

Redistribution steps:
  1. Collect pending tasks from A1, A2 (scheduled, not active)
  2. Collect pending tasks from B1, B2 (scheduled)
  3. Add Goal N's phrase groups (all new tasks)
  4. Cancel A1, A2, B1, B2 (delete from IndexedDB + remove from index)
  5. Run distributeMultiGoalTasks() on combined GoalPhraseGroup[]
  6. Create new sessions M1..Mk with mixed tasks from A, B, N
  7. Update Goal A.sessionIds = [A3.id, ...new session IDs containing A tasks]
  8. Update Goal B.sessionIds = [new session IDs containing B tasks]
  9. Update Goal N.sessionIds = [new session IDs containing N tasks]

After:
  Goal A → sessions [A3(active/untouched), M1, M3, M5] (example)
  Goal B → sessions [M1, M2, M4] (example)
  Goal N → sessions [M1, M2, M3, M4, M5] (example)
  M1.goalIds = ['goal-a-id', 'goal-b-id', 'goal-n-id']
```

Active session A3 is never cancelled. Its tasks remain with Goal A only.

---

## Unchanged Entities

| Entity | Status | Reason |
|--------|--------|--------|
| `Goal` | NO CHANGE | `sessionIds` array already supports multiple sessions; `taskIds` unchanged |
| `SessionTask` | NO CHANGE | `goalId` field already present from Feature 067 |
| `PhraseGroup` | NO CHANGE | Extended via `GoalPhraseGroup` without modification |
| `GoalIndexEntry` | NO CHANGE | Goal metadata display unchanged |
| `distributeTasks()` | NO CHANGE | Single-goal path fully preserved |
| `findFreeDays()` | NO CHANGE | Free-day scheduling algorithm unchanged |
| Warmup goal flow | NO CHANGE | `insertWarmUpTaskIntoSessions` is unaffected |
