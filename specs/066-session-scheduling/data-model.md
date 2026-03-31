# Data Model: Session Scheduling

**Feature**: 066-session-scheduling  
**Date**: 2026-03-31

## Entity Changes

### Session (modified)

Extends existing `Session` interface in `sessionTypes.ts`.

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| id | `string` | unchanged | UUID, readonly |
| name | `string` | unchanged | User-editable session name |
| createdAt | `string` | unchanged | ISO 8601 datetime |
| status | `'active' \| 'closed' \| 'scheduled'` | **modified** | Added `'scheduled'` literal to union |
| targetDate | `string \| undefined` | **new** | ISO 8601 date-only string (e.g. `"2026-04-15"`). Set on creation for scheduled sessions. Preserved across all transitions. Undefined for legacy/immediate sessions. |
| tasks | `SessionTask[]` | unchanged | Pre-defined tasks (can be set at creation for scheduled sessions) |
| activities | `SessionActivity[]` | unchanged | Practice activities recorded during active phase |

### SessionIndexEntry (modified)

Extends existing `SessionIndexEntry` interface in `sessionTypes.ts`.

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| id | `string` | unchanged | UUID, readonly |
| name | `string` | unchanged | Session name |
| createdAt | `string` | unchanged | ISO 8601 datetime |
| status | `'active' \| 'closed' \| 'scheduled'` | **modified** | Added `'scheduled'` literal to union |
| targetDate | `string \| undefined` | **new** | Mirrors Session.targetDate for list rendering without IndexedDB lookup |
| activityCount | `number` | unchanged | Count of activities |
| taskCount | `number` | unchanged | Count of tasks |
| allTasksDone | `boolean` | unchanged | Whether all tasks are done |

### Unchanged Entities

- **SessionActivity**: No changes. Activities are only added to active sessions.
- **SessionTask**: No changes. Tasks can be assigned at creation time to scheduled sessions (already supported by the tasks array on Session).
- **TaskLinkedPractice**: No changes.
- **ScoreRef**: No changes.

## State Machine

```
                ┌──────────┐
   create with  │          │  activate()
   future date  │ scheduled├─────────────┐
   ────────────►│          │             │
                └──────────┘             ▼
                                   ┌──────────┐
   create with                     │          │  closeSession()
   today's date                    │  active  ├──────────────┐
   ───────────────────────────────►│          │              │
                                   └──────────┘              ▼
                                                       ┌──────────┐
                                                       │          │
                                                       │  closed  │
                                                       │ (terminal)│
                                                       └──────────┘
```

**Allowed transitions:**
- `scheduled` → `active` (via `activateScheduledSession`)
- `active` → `closed` (via `closeSession`)

**Forbidden transitions:**
- `closed` → any (terminal state)
- `scheduled` → `closed` (must activate first)
- `active` → `scheduled` (cannot un-activate)

## Validation Rules

| Rule | Field | Constraint |
|------|-------|-----------|
| Future date required | targetDate | When status is `'scheduled'`, targetDate must be strictly after today |
| Past date blocked | targetDate | Date picker `min` attribute set to today's date; validation in creation function |
| Single active | status | At most one session with `status === 'active'` across all sessions |
| Closed is terminal | status | Sessions with `status === 'closed'` cannot have their status changed |
| Target date immutable | targetDate | Once set, targetDate is never modified or cleared |

## Sorting Rules

Session list ordered by three tiers:

1. **Active** sessions first (at most one)
2. **Scheduled** sessions, sorted by `targetDate` ascending (nearest date first)
3. **Closed** sessions, sorted by `createdAt` descending (most recent first)

## Storage Impact

### IndexedDB (`sessions` store)
- No schema version change needed — `targetDate` is an additive optional field
- Existing sessions load correctly with `targetDate === undefined`

### localStorage (`graditone-sessions-index`)
- `SessionIndexEntry` gains optional `targetDate` field
- Existing entries normalize correctly (undefined targetDate)
- `normalizeIndexEntry()` extended to handle missing `targetDate`

### Eviction Policy
- Unchanged: evicts oldest **closed** session when at MAX_SESSIONS (50)
- Scheduled sessions are not eligible for eviction
- Active sessions are not eligible for eviction
