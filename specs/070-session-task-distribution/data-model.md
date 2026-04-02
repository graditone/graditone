# Data Model: Session Task Distribution

**Feature**: 070-session-task-distribution
**Date**: 2026-04-01

## Entity Changes

### SessionTask (MODIFIED)

Two new fields added to the existing `SessionTask` interface.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| difficulty | `DifficultyLevel` (1\|2\|3) | No | undefined | Computed difficulty for the task's measure range and staff. Set at creation time for auto-generated tasks. `1`=Easy, `2`=Medium, `3`=Hard. |
| estimatedDurationSecs | `number` | No | undefined | Estimated total practice time in seconds to master the phrase to minResult. Set at creation time for auto-generated tasks. |

**Backward compatibility**: Both fields are optional. Existing tasks (created before this feature) will have `undefined` for both — UI treats missing values as "no estimate available".

### Session (MODIFIED)

One new field added to the existing `Session` interface.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| availableTime | `number` | No | undefined | Maximum practice time budget in seconds. `undefined` or `0` means no limit. Auto-generated sessions default to `3600` (1 hour). |

**Backward compatibility**: Field is optional. Existing sessions have `undefined` — treated as unlimited.

### Goal (MODIFIED)

The `sessionId` field is replaced by `sessionIds` to support goals spanning multiple sessions.

| Field | Old Type | New Type | Migration |
|-------|----------|----------|-----------|
| sessionId | `string` | removed | — |
| sessionIds | — | `string[]` | Existing goals with `sessionId` are migrated: `sessionIds = [sessionId]` |

**Migration strategy**: On goal load, if `sessionId` exists and `sessionIds` does not, set `sessionIds = [sessionId]`. This is done in the goal storage read path (lazy migration).

### SessionIndexEntry (MODIFIED)

One new optional field for UI display.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| totalEstimatedDurationSecs | `number` | No | undefined | Sum of estimatedDurationSecs for all tasks in the session. Computed at session creation time. |

### DifficultyLevel (EXISTING — no change)

Already exists in `frontend/src/types/score.ts`:
```typescript
export type DifficultyLevel = 1 | 2 | 3;  // 1=Easy, 2=Medium, 3=Hard
```

### DifficultyRating (EXISTING — no change)

Already exists in `frontend/src/types/score.ts`:
```typescript
export interface DifficultyRating {
  density_rate: number;
  level: DifficultyLevel;
}
```

### PhraseRegion (EXISTING — no change)

Already exists. Tasks are generated for each detected phrase. No structural changes.

## Relationships

```
Goal 1 ──────────── * SessionTask   (via goal.taskIds[] / task.goalId)
Goal 1 ──────────── * Session       (via goal.sessionIds[] / session.goalId)
Session 1 ────────── * SessionTask  (embedded in session.tasks[])
```

Key change: Goal → Session is now 1:many (was 1:1).

## State Transitions

### Task lifecycle (UNCHANGED)
```
todo → in-progress → done (terminal)
                   → failed → in-progress (retry, round++)
```

### Session lifecycle (UNCHANGED)
```
scheduled → active → closed (terminal)
```

### Goal lifecycle (UNCHANGED except multi-session)
```
active → completed (when ALL tasks across ALL linked sessions are 'done')
```

## Validation Rules

- `availableTime`: Must be `undefined`, `0`, or a positive integer. Negative values rejected.
- `estimatedDurationSecs`: Must be a positive number when set. Computed, not user-editable.
- `difficulty`: Must be `1`, `2`, or `3` when set. Computed, not user-editable.
- `sessionIds`: Must be a non-empty array of valid UUID strings.
- `totalEstimatedDurationSecs`: Must be a non-negative number when set.
