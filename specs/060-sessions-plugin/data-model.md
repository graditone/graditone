# Data Model: Sessions Plugin

**Feature**: 060-sessions-plugin  
**Date**: 2026-03-27  

## Entities

### Session

Represents a named practice session block containing ordered activities.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID v4, primary key |
| `name` | `string` | User-editable name; default: date/time string (e.g., "Session 2026-03-27 14:30") |
| `createdAt` | `string` | ISO 8601 timestamp |
| `status` | `'active' \| 'closed'` | Lifecycle state; at most one session can be `active` at any time |
| `activities` | `SessionActivity[]` | Ordered list of activities, chronological |

**Invariants**:
- At most 1 session with `status === 'active'` at any time
- Maximum 50 sessions stored; oldest closed sessions evicted first
- Active session is never evicted

### SessionActivity

Represents one practice event within a session. Snapshotted metadata ensures display even if the referenced practice is later orphaned.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID v4, unique within session |
| `type` | `'score-practice'` | Activity type discriminator (extensible to other types in future) |
| `createdAt` | `string` | ISO 8601 timestamp |
| `savedPracticeId` | `string` | Reference to `SavedPractice.id` in the practices store |
| `scoreTitle` | `string` | Snapshotted from saved practice at creation time |
| `completionStatus` | `'complete' \| 'partial'` | Snapshotted from saved practice at creation time |

**Invariants**:
- Activities can only be added to a session with `status === 'active'`
- Once created, activity metadata is immutable (snapshotted values never change)

### SessionIndexEntry

Lightweight metadata for fast list rendering, stored in localStorage.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Same UUID as Session.id |
| `name` | `string` | Session name |
| `createdAt` | `string` | ISO 8601 timestamp |
| `status` | `'active' \| 'closed'` | Current lifecycle state |
| `activityCount` | `number` | Number of activities in this session |

## Storage Layout

### IndexedDB (`graditone-db` v3)

| Object Store | Key Path | Indexes | Contents |
|-------------|----------|---------|----------|
| `scores` (existing) | `id` | `lastModified` | User-imported scores |
| `practices` (existing) | `id` | `savedAt` | Full saved practice data |
| `sessions` (new) | `id` | `createdAt`, `status` | Full `Session` objects (including embedded `activities[]`) |

**Design decision**: Activities are embedded within the Session document rather than stored in a separate object store. Rationale:
- Activities are always read/written in the context of their parent session
- No cross-session activity queries are needed
- Simpler schema; avoids join-like lookups
- Session document size stays small (activity entries are lightweight metadata, not full practice data)

### localStorage

| Key | Type | Contents |
|-----|------|----------|
| `graditone-sessions-index` | `SessionIndexEntry[]` | Lightweight index for fast list rendering |
| `graditone-saved-practices-index` (existing) | `SavedPracticeIndexEntry[]` | Unchanged |

## Relationships

```
Session 1──* SessionActivity *──1 SavedPractice
   │                                    │
   │ (embedded)                         │ (reference by ID)
   │                                    │
   └─── SessionIndexEntry              └─── SavedPracticeIndexEntry
         (localStorage mirror)               (localStorage mirror, existing)
```

- **Session → Activities**: One-to-many, embedded (activities live inside the session document)
- **Activity → SavedPractice**: Many-to-one reference by `savedPracticeId`. The activity snapshots display metadata; the reference enables loading the full practice.
- **Session → SessionIndexEntry**: One-to-one mirror. The index entry is a denormalized projection for fast list rendering.

## State Transitions

```
  ┌──────────────────────────────┐
  │      (no active session)     │
  └──────────────┬───────────────┘
                 │ Start Session
                 ▼
  ┌──────────────────────────────┐
  │     Session: ACTIVE          │◄──── practices saved → activities added
  └──────────────┬───────────────┘
                 │ Close Session
                 ▼
  ┌──────────────────────────────┐
  │     Session: CLOSED          │──── (remains in list, no new activities)
  └──────────────┬───────────────┘
                 │ Eviction (cap reached)
                 ▼
  ┌──────────────────────────────┐
  │     Session: DELETED         │──── linked practices released (standalone)
  └──────────────────────────────┘
```

## Protected Practices

The set of practice IDs protected from deletion is derived from all existing sessions:

```
protectedPracticeIds = union of all session.activities[].savedPracticeId
                       for all sessions in the sessions index
```

When a session is evicted, its activities' `savedPracticeId` values are naturally removed from the computed set, releasing those practices for deletion.

## Eviction Strategy

| Trigger | Action |
|---------|--------|
| New session created, count = 50 | Find oldest closed session (by `createdAt`), delete from IndexedDB + localStorage index |
| New session created, count = 50, all sessions active | ERROR: cannot create (only 1 active allowed, so this means 49 closed + 1 active — evict oldest closed) |
| Active session exists, user starts new | BLOCKED: must close current active session first |

**Eviction order**: Oldest `createdAt` among sessions with `status === 'closed'`.
