# Data Model: Fix Rescheduling Bugs — Feature 090

This feature introduces **no new entities, no new storage keys, and no schema
changes**. All fixes are to control-flow logic and CSS.

---

## Affected Entities (unchanged shape)

### SessionIndexEntry  
File: `plugins-external/sessions-plugin/sessionTypes.ts`

```ts
interface SessionIndexEntry {
  readonly id: string;
  readonly profileId?: string;
  name: string;
  readonly createdAt: string;
  status: 'active' | 'closed' | 'scheduled';
  targetDate?: string;           // ISO date-only "YYYY-MM-DD"
  activityCount: number;
  taskCount: number;
  allTasksDone: boolean;
  goalId?: string;               // present iff session belongs to a goal
  goalIds?: string[];
  totalEstimatedDurationSecs?: number;
  totalRealTimeSecs?: number;
}
```

**Read during detection** (Bug 1 fix): read via `listSessionsIndex()` — **after**
`reconcileSessionsIndex()` completes, not before.  
**No field changes**: the shape remains identical; only the timing of when it is
read changes.

---

### RescheduleSummary  
File: `plugins-external/sessions-plugin/rescheduleEngine.ts`

```ts
interface RescheduleSummary {
  goalLinked: SessionIndexEntry[];   // overdue sessions with goalId set
  isolated: SessionIndexEntry[];     // overdue sessions with no goalId
}
```

**Read during dialog render** (Bug 2b fix): `goalLinked.length` is used instead
of `new Set(goalLinked.map(s => s.goalId)).size`.  
**No type changes**: shape is unchanged; only the consumer expression changes.

---

## Storage Layer — No Changes

| Store | Key | Change |
|-------|-----|--------|
| localStorage (session index) | `graditone-sessions-index` | None |
| IndexedDB `sessions` | — | None |
| IndexedDB `goals` | — | None |

## CSS — Additive Only

The single CSS change is additive:

| Rule | Property Added |
|------|----------------|
| `.sessions-plugin__reschedule-overlay` | `background: rgba(0, 0, 0, 0.45)` |

No existing CSS rules are removed or modified.

---

## State/Lifecycle Model Change (Bug 1)

The change to detection timing affects the React effect lifecycle in
`SessionsPlugin.tsx`:

**Before** (two separate effects):
```
mount → Effect 1 (refreshSessions, async, not awaited by Effect 2)
      → Effect 2 (detect from localStorage, possibly stale/empty)
```

**After** (single chained effect):
```
mount → Effect 1 (refreshSessions) → .then(detect from localStorage, fresh)
```

The `rescheduleSummary` and `showRescheduleDialog` state values are set in the
same React setState batch at the end of the `.then()` chain — behaviour is
identical to the original once the timing is corrected.
