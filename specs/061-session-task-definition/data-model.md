# Data Model: Tasks-Based Session Definition

**Feature**: 061-session-task-definition  
**Date**: 2026-03-28

## Entity Diagram

```
Session (extended)
├── id: string (UUID)
├── name: string
├── createdAt: string (ISO 8601)
├── status: 'active' | 'closed'
├── tasks: SessionTask[]          ← NEW
└── activities: SessionActivity[] ← existing (backward compat)

SessionTask (NEW)
├── id: string (UUID)
├── scoreRef: ScoreRef { type: 'preloaded' | 'user', id: string }
├── scoreTitle: string
├── regionType: 'all' | 'measures'
├── startMeasure: number | null   (1-based, null when regionType='all')
├── endMeasure: number | null     (1-based, null when regionType='all')
├── staffIndex: number            (0=RH, 1=LH, -1=BH)
├── loopCount: number             (iterations, ≥1)
├── tempoMultiplier: number       (ratio 0.5–2.0)
├── minResult: number             (0–100, percentage)
├── status: TaskStatus
├── currentRound: number          (0-based, increments on retry)
└── linkedPractices: TaskLinkedPractice[]

TaskLinkedPractice
├── savedPracticeId: string       (→ SavedPractice.id)
├── practiceScore: number         (0–100)
├── completionStatus: 'complete' | 'partial'
├── createdAt: string             (ISO 8601)
└── round: number                 (which retry round: 0, 1, 2, …)

SessionActivity (extended)
├── ... (all existing fields unchanged)
└── taskId: string | undefined    ← NEW (optional ref to originating task)

SessionIndexEntry (extended)
├── ... (all existing fields unchanged)
└── taskCount: number             ← NEW

PracticeSavedEvent (extended)
├── ... (all existing fields unchanged)
└── taskId: string | undefined    ← NEW (optional)
```

## Entities

### SessionTask

A planned practice activity defined at session creation time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4, generated at creation |
| `scoreRef` | `ScoreRef` | Yes | `{ type: 'preloaded' \| 'user', id: string }` |
| `scoreTitle` | `string` | Yes | Snapshot of score display name at creation |
| `regionType` | `'all' \| 'measures'` | Yes | Whether the entire score or a measure range |
| `startMeasure` | `number \| null` | Conditional | 1-based start measure (null when `regionType === 'all'`) |
| `endMeasure` | `number \| null` | Conditional | 1-based end measure, inclusive (null when `regionType === 'all'`) |
| `staffIndex` | `number` | Yes | `0` = Right Hand, `1` = Left Hand, `-1` = Both Hands |
| `loopCount` | `number` | Yes | Number of iterations per round. Min: 1 |
| `tempoMultiplier` | `number` | Yes | Ratio applied to score's base tempo. Range: 0.5–2.0 |
| `minResult` | `number` | Yes | Minimum practice score (0–100) to mark task "done" |
| `status` | `TaskStatus` | Yes | `'todo' \| 'in-progress' \| 'done' \| 'failed'` |
| `currentRound` | `number` | Yes | 0-based round counter. Starts at 0, increments on retry |
| `linkedPractices` | `TaskLinkedPractice[]` | Yes | Ordered list of practices linked to this task across all rounds |

### TaskLinkedPractice

A reference to a saved practice linked to a task.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `savedPracticeId` | `string` | Yes | References `SavedPractice.id` in IndexedDB |
| `practiceScore` | `number` | Yes | Score 0–100 from the practice |
| `completionStatus` | `'complete' \| 'partial'` | Yes | Whether the practice was fully completed |
| `createdAt` | `string` | Yes | ISO 8601 timestamp |
| `round` | `number` | Yes | Which retry round this practice belongs to (0-based) |

### Session (extended)

Existing entity with one new field:

| Field | Type | Change |
|-------|------|--------|
| `tasks` | `SessionTask[]` | **NEW** — empty array for legacy sessions (backward compat) |

All existing fields (`id`, `name`, `createdAt`, `status`, `activities`) remain unchanged.

### SessionActivity (extended)

Existing entity with one new optional field:

| Field | Type | Change |
|-------|------|--------|
| `taskId` | `string \| undefined` | **NEW** — references originating `SessionTask.id` if practice was launched from a task |

### SessionIndexEntry (extended)

Existing entity with one new field:

| Field | Type | Change |
|-------|------|--------|
| `taskCount` | `number` | **NEW** — total number of tasks (0 for legacy sessions) |

### PracticeSavedEvent (extended)

Existing plugin API event with one new optional field:

| Field | Type | Change |
|-------|------|--------|
| `taskId` | `string \| undefined` | **NEW** — set when practice was launched from a task's practice link |

## Validation Rules

### Task Creation Validation

1. `scoreRef` MUST be non-null (a score must be selected)
2. If `regionType === 'measures'`: `startMeasure` MUST be ≥ 1 and `endMeasure` MUST be ≥ `startMeasure`
3. `staffIndex` MUST be one of `0`, `1`, `-1`
4. `loopCount` MUST be ≥ 1 (integer)
5. `tempoMultiplier` MUST be in range [0.5, 2.0]
6. `minResult` MUST be in range [0, 100] (integer)

### Session Creation Validation

1. At least one task MUST be present
2. All tasks MUST pass individual validation
3. No active session may exist (at-most-one-active constraint)

## State Transitions

### TaskStatus

```
                     ┌──────────────────────────────────────┐
                     │                                      │
                     ▼                                      │
  ┌──────┐    ┌─────────────┐    ┌──────┐                  │
  │ todo │───▶│ in-progress │───▶│ done │  (terminal)       │
  └──────┘    └─────────────┘    └──────┘                  │
                     │                                      │
                     ▼                                      │
               ┌──────────┐                                │
               │  failed  │────────────────────────────────┘
               └──────────┘  (retry → resets to in-progress,
                              currentRound++)
```

**Transitions**:
- `todo` → `in-progress`: First practice linked to this task (in current round)
- `in-progress` → `done`: A linked practice's `practiceScore` ≥ `minResult` (terminal — no further transitions)
- `in-progress` → `failed`: Number of practices in current round ≥ `loopCount` AND no practice met `minResult`
- `failed` → `in-progress`: User taps "Practice" link on a failed task. `currentRound` increments. Iteration count resets (only practices in the new round count toward `loopCount`).

## Storage

### IndexedDB (`sessions` store)

Full `Session` objects (including embedded `tasks[]` and `activities[]`) are stored via `saveSessionToIndexedDB()`. No schema migration needed — IndexedDB is schemaless; new fields are simply added to the stored objects. Legacy sessions loaded from IDB will have `tasks` as `undefined` — code normalizes to `[]`.

### localStorage (`graditone-sessions-index`)

`SessionIndexEntry[]` with new `taskCount` field. Legacy entries will have `taskCount` as `undefined` — code normalizes to `0`.

### Protected Practice IDs

`computeProtectedPracticeIds()` must be extended to include `savedPracticeId` values from `task.linkedPractices[]` in addition to existing `activities[]` scan.

## Backward Compatibility

- Sessions created before this feature have `tasks: undefined` (normalized to `[]` on load)
- SessionActivities created before this feature have `taskId: undefined`
- SessionIndexEntries before this feature have `taskCount: undefined` (normalized to `0`)
- The UI conditionally renders the task section only when `tasks.length > 0`
- No data migration required — all new fields are optional or array-defaulted
