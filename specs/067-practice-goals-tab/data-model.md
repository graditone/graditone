# Data Model: Practice Goals View Tab (Feature 067)

**Date**: 2026-03-31  
**Feature**: [spec.md](spec.md)

## Entities

### Goal (NEW)

The primary new entity. Persisted in IndexedDB `goals` store and summarised in `goals-index` localStorage.

```typescript
export type GoalType = 'learn-score-phrase';
export type GoalStatus = 'active' | 'completed';

export interface Goal {
  /** Unique identifier (UUID v4). */
  readonly id: string;
  /** Type of goal — extensible enum, initially only 'learn-score-phrase'. */
  readonly type: GoalType;
  /** Human-readable title, e.g. "Learn first phrase — Für Elise". */
  readonly title: string;
  /** Reference to the source score. */
  readonly scoreRef: ScoreRef;
  /** Display title of the score at goal creation time. */
  readonly scoreTitle: string;
  /** ISO 8601 datetime string of goal creation. */
  readonly createdAt: string;
  /** Current goal status. Transitions: active → completed. */
  status: GoalStatus;
  /** 0-based start measure (inclusive) of the phrase region. */
  readonly startMeasure: number;
  /** 0-based end measure (inclusive) of the phrase region. */
  readonly endMeasure: number;
  /** IDs of the generated SessionTask entries. */
  readonly taskIds: readonly string[];
  /** ID of the auto-created scheduled session, or null if session was deleted. */
  sessionId: string | null;
}
```

### GoalIndexEntry (NEW)

Lightweight summary for fast list rendering from localStorage (mirrors `SessionIndexEntry` pattern).

```typescript
export interface GoalIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly scoreTitle: string;
  readonly createdAt: string;
  status: GoalStatus;
  /** Pre-computed count of tasks with status 'done'. */
  tasksDone: number;
  /** Total number of tasks in the goal. */
  tasksTotal: number;
}
```

### SessionTask (MODIFIED — existing)

Add optional `goalId` field to link tasks back to their originating goal.

```typescript
// Addition to existing SessionTask interface in sessionTypes.ts:
export interface SessionTask {
  // ... all existing fields unchanged ...
  /** Feature 067: Optional reference to the originating goal. */
  readonly goalId?: string;
}
```

### Session (MODIFIED — existing)

Add optional `goalId` field to indicate auto-created sessions.

```typescript
// Addition to existing Session interface in sessionTypes.ts:
export interface Session {
  // ... all existing fields unchanged ...
  /** Feature 067: ID of the goal that auto-created this session, if any. */
  readonly goalId?: string;
}
```

### SessionIndexEntry (MODIFIED — existing)

Mirror `goalId` for fast rendering.

```typescript
// Addition to existing SessionIndexEntry interface in sessionTypes.ts:
export interface SessionIndexEntry {
  // ... all existing fields unchanged ...
  /** Feature 067: Mirrors Session.goalId for fast list rendering. */
  goalId?: string;
}
```

## Relationships

```
Goal 1 ──────── * SessionTask   (via goal.taskIds[] / task.goalId)
Goal 1 ──────── 0..1 Session    (via goal.sessionId / session.goalId)
Session 1 ───── * SessionTask   (via session.tasks[])
```

- A Goal owns 1–3 tasks (3 for multi-staff scores, 1 for single-staff).
- A Goal points to exactly 1 auto-created Session (nullable if session is deleted).
- A Session may or may not be linked to a Goal.
- Deleting a Goal orphans the Session and its Tasks (they remain functional independently).

## State Transitions

### Goal status

```
  ┌──────────┐
  │  active  │
  └────┬─────┘
       │ All tasks reach "done" status
       ▼
  ┌───────────┐
  │ completed │
  └───────────┘
```

- `active` → `completed`: Automatic when `goal.taskIds.every(id => task.status === 'done')`.
- `completed` is terminal — once achieved, goal cannot revert (tasks could be retried, but goal stays completed).

### Task status (existing — no changes)

```
todo → in-progress → done
                   → failed → (retry) → in-progress
```

## Validation Rules

| Field | Rule |
|-------|------|
| `Goal.id` | UUID v4, non-empty |
| `Goal.type` | Must be 'learn-score-phrase' |
| `Goal.title` | Non-empty string |
| `Goal.scoreRef` | Must have valid type ('preloaded' \| 'user') and non-empty id |
| `Goal.startMeasure` | Integer ≥ 0 |
| `Goal.endMeasure` | Integer ≥ startMeasure |
| `Goal.taskIds` | 1–3 elements, each non-empty UUID |
| `Goal.sessionId` | UUID or null |
| `SessionTask.goalId` | UUID or undefined |
| `Session.goalId` | UUID or undefined |

## Storage Schema

### IndexedDB — `graditone-db` version 4

```
Object Store: 'goals'
  keyPath: 'id'
  Indexes:
    - 'createdAt' (unique: false) — for chronological listing
    - 'status' (unique: false) — for filtering active/completed
```

### localStorage

```
Key: 'goals-index'
Value: JSON.stringify(GoalIndexEntry[])
```
