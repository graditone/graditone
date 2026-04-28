# Data Model: Sessions Rescheduling (087)

## Existing Entities (unchanged)

### Session (sessionTypes.ts)

```ts
interface Session {
  readonly id: string;
  readonly profileId?: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed' | 'scheduled';
  targetDate?: string;           // ISO date-only "YYYY-MM-DD"
  tasks: SessionTask[];
  activities: SessionActivity[];
  readonly goalId?: string;      // set iff session belongs to a goal
  readonly availableTime?: number;
}
```

**Modified fields**: `targetDate` and `status` are written during rescheduling. Both fields are mutable in the type.

### SessionIndexEntry (sessionTypes.ts)

```ts
interface SessionIndexEntry {
  readonly id: string;
  readonly profileId?: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed' | 'scheduled';
  targetDate?: string;           // mirrors Session.targetDate
  activityCount: number;
  taskCount: number;
  allTasksDone: boolean;
  goalId?: string;               // mirrors Session.goalId for fast lookup
  totalEstimatedDurationSecs?: number;
  totalRealTimeSecs?: number;
}
```

**Read during**: overdue detection (synchronous, from localStorage).  
**Written during**: both auto-reschedule and manual date picker update.

### Goal (goalTypes.ts)

```ts
interface Goal {
  readonly id: string;
  readonly profileId?: string;
  readonly title: string;
  status: GoalStatus;            // 'active' | 'completed'
  sessionIds: string[];          // IDs of all sessions linked to this goal
  // ... other fields unchanged
}
```

**Read during**: goal-linked reschedule (to enumerate pending session IDs).  
**Not written**: goal itself is not modified during rescheduling.

---

## New Pure Functions (rescheduleEngine.ts)

### detectOverdueSessions

```ts
function detectOverdueSessions(
  entries: SessionIndexEntry[],
  todayISO: string,
): SessionIndexEntry[]
```

Returns all entries where `status === 'scheduled'` and `targetDate < todayISO`.

### RescheduleSummary

```ts
interface RescheduleSummary {
  goalLinked: SessionIndexEntry[];   // overdue sessions with a goalId
  isolated: SessionIndexEntry[];     // overdue sessions without a goalId
}
```

Returned by `classifyOverdueSessions()` to drive the dialog body text.

### classifyOverdueSessions

```ts
function classifyOverdueSessions(overdue: SessionIndexEntry[]): RescheduleSummary
```

Partitions overdue sessions into goal-linked vs isolated buckets.

### rescheduleGoalSessions (async)

```ts
async function rescheduleGoalSessions(
  goalId: string,
  overdueSessions: SessionIndexEntry[],
  globalOccupied: Set<string>,
  todayISO: string,
): Promise<void>
```

1. Load `Goal` from IndexedDB.  
2. Collect all pending `sessionIds` from the goal (cross-referenced against the index — skip `'closed'` and `'active'` entries).  
3. Build `adjustedOccupied = globalOccupied` minus the current `targetDate` values of this goal's own pending sessions.  
4. Call `findFreeDaysFrom(todayISO, pendingCount, adjustedOccupied)`.  
5. For each pending session, update `targetDate` on both index and IndexedDB.

### rescheduleIsolatedSession (async)

```ts
async function rescheduleIsolatedSession(
  entry: SessionIndexEntry,
  occupied: Set<string>,
  todayISO: string,
): Promise<string>   // returns the new targetDate
```

Finds the next free day, updates the session, returns the new date so the caller can add it to `occupied`.

---

## State Additions (SessionsPlugin.tsx)

| State | Type | Purpose |
|-------|------|---------|
| `reschedulePromptDismissedRef` | `useRef<boolean>` | In-memory suppression flag — set after dismiss |
| `showRescheduleDialog` | `boolean` (useState) | Controls dialog visibility |
| `rescheduleSummary` | `RescheduleSummary \| null` (useState) | Drives dialog body |
| `datePickerSessionId` | `string \| null` (useState) | Tracks which session has the date picker open |

---

## Validation Rules

- `targetDate` must be a valid `YYYY-MM-DD` ISO date string (`isValidTargetDate()` already exists in `sessionStorage.ts`).
- Manual date picker enforces `min = todayISO` at the UI layer.
- Auto-reschedule only moves `'scheduled'` sessions — never `'active'` or `'closed'`.
- Completed/skipped tasks within a session are not affected — session-level rescheduling only touches `targetDate` and `status`.

---

## State Transitions

```
'scheduled' (targetDate in past)
  → [auto-reschedule accept]  → 'scheduled' (targetDate = future free day)
  → [manual date pick]        → 'scheduled' (targetDate = selected date ≥ today)

'scheduled' (targetDate in future)
  → [manual date pick]        → 'scheduled' (new targetDate ≥ today)
```

No new status values. Status stays `'scheduled'` — the date is what changes.
