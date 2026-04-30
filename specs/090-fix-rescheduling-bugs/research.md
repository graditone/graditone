# Research: Fix Rescheduling Bugs — Feature 090

All unknowns resolved through direct codebase exploration of
`plugins-external/sessions-plugin/` and `frontend/src/plugin-api/`.

---

## R1 — Bug 1 Root Cause: Incomplete Past-Session Detection

### Decision
Detection timing is the root cause. The overdue-session detection `useEffect` in
`SessionsPlugin.tsx` runs synchronously at mount, **before** the async
`reconcileSessionsIndex()` (called from `refreshSessions()`) completes.

### Detailed Analysis

`SessionsPlugin.tsx` declares two mount-only effects in this order:

```tsx
// Effect 1 — declared first, so runs first
useEffect(() => {
  refreshSessions();               // async — starts reconcileSessionsIndex()
}, [refreshSessions]);

// Effect 2 — declared later, runs after Effect 1 starts, before it awaits
useEffect(() => {
  const overdue = detectOverdueSessions(listSessionsIndex(), todayISO); // sync read
  ...
}, []);
```

React commits all effects synchronously in declaration order after the first
render.  Effect 1 fires `refreshSessions()` which schedules an async Promise
chain (`reconcileSessionsIndex → listSessionsIndex → setSessions`).  Effect 2
executes in the **same JavaScript call stack turn**, while the Promise is still
pending.

`reconcileSessionsIndex()` has this guard:
```ts
if (existing.length > 0) return false; // already populated
```
It only rebuilds when localStorage is **empty**.  If localStorage is empty
(profile migration, browser cache clear, fresh device), Effect 2 reads an empty
index and detects zero overdue sessions.  Reconciliation later rebuilds the
index from IndexedDB, but `showRescheduleDialog` is already `false` — no dialog
ever appears.

### Impact
- User opens Sessions view → no dialog shown despite past sessions in IndexedDB
- Past sessions remain unaddressed; `SC-001` (zero past sessions after accept)
  can never be satisfied

### Fix
Merge the detection logic into the `refreshSessions` mount effect, chaining it
after the async operation resolves:

```tsx
useEffect(() => {
  refreshSessions().then(() => {
    if (reschedulePromptDismissedRef.current) return;
    const todayISO = new Date().toISOString().slice(0, 10);
    const overdue = detectOverdueSessions(listSessionsIndex(), todayISO);
    if (overdue.length > 0) {
      setRescheduleSummary(classifyOverdueSessions(overdue));
      setShowRescheduleDialog(true);
    }
  });
}, [refreshSessions]);
```

The separate detection-only `useEffect([], [])` is removed entirely.
`refreshSessions` is a stable `useCallback` (empty deps), so this effect still
runs exactly once per mount, and detection now happens after reconciliation.

### Alternatives Considered
- **`useEffect` depending on `sessions` state** — Detection could depend on the
  React `sessions` array state instead of `listSessionsIndex()`, triggering once
  sessions are populated. Rejected because it would require additional ref-based
  "ran once" guards and is harder to reason about; chaining in `.then()` is
  simpler and equally safe.
- **Calling `listSessionsIndex()` inside the existing `refreshSessions` hook
  itself** — Would couple session management and dialog logic, violating
  separation of concerns between `useSessionManager` and `SessionsPlugin`.

---

## R2 — Bug 2a Root Cause: Missing Backdrop on Reschedule Overlay

### Decision
The `.sessions-plugin__reschedule-overlay` CSS rule is missing
`background: rgba(0, 0, 0, 0.45)`.

### Detailed Analysis

All other modal overlays in `SessionsPlugin.css` share a consistent set of
rules.  The confirm-delete overlay (the nearest comparable):

```css
.sessions-plugin__confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);   /* ← present */
}
```

The reschedule overlay (introduced in 087):

```css
.sessions-plugin__reschedule-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
                                      /* ← missing background */
}
```

Without the semi-transparent backdrop the dialog renders without dimming
the content behind it, which:
- Looks visually different from all other dialogs in the app (FR-005)
- Fails dark-mode visual consistency (FR-006) since the background of the rest
  of the page shows through unchanged

### Fix
Add `background: rgba(0, 0, 0, 0.45);` to `.sessions-plugin__reschedule-overlay`.

No other dialog-card CSS rules differ; the inner `.sessions-plugin__reschedule-dialog`
already uses the same `var(--ls-bg)` / `var(--color-border)` / `var(--ls-heading)` /
`var(--ls-body)` CSS variables as other dialogs.

---

## R3 — Bug 2b Root Cause: Inaccurate Goal-Linked Session Count in Dialog

### Decision
`goalCount` is derived with `.size` (unique goalIds) when it should be `.length`
(goal-linked session count).

### Detailed Analysis

`SessionsPlugin.tsx` renders the dialog body with:

```tsx
{t('sessions.reschedule_dialog_body', {
  goalCount: new Set(rescheduleSummary.goalLinked.map((s) => s.goalId)).size,
  isolatedCount: rescheduleSummary.isolated.length,
})}
```

The i18n string:
```json
"sessions.reschedule_dialog_body":
  "{goalCount} goal-linked session(s) and {isolatedCount} isolated session(s) are in the past."
```

`new Set(...).size` counts **unique goals**, not sessions.

**Example that exposes the bug**:
- User has Goal G1 with sessions S1 (overdue), S2 (overdue)
- Detection builds `goalLinked = [S1, S2]`
- Dialog shows `goalCount = 1` (1 unique goal)
- Dialog reads: "1 goal-linked session(s) and 0 isolated session(s) are in the past."
- But 2 sessions are actually in the past (S1 and S2)

This violates FR-004 (dialog count must equal sessions rescheduled) and FR-007
(accurate breakdown).

### Fix
```tsx
goalCount: rescheduleSummary.goalLinked.length,
```

Note on `rescheduleGoalSessions` scope: that function reschedules ALL pending
sessions for the goal (including future-dated ones, not just the overdue ones
in the summary), so the total rescheduled count could be higher than
`goalLinked.length`. However, FR-007 describes "the sessions that will be
rescheduled" in terms of the breakdown shown *to the user*. The dialog text
says "are in the past" — it is describing the **detected overdue sessions**, not
the total rescheduled set. Using `goalLinked.length` correctly reflects the
number of past goal-linked sessions that triggered the dialog.

---

## R4 — `rescheduleGoalSessions` Behaviour: All Pending vs Overdue Only

### Decision
No change to `rescheduleGoalSessions`. The current behaviour (reschedule ALL
pending sessions for the goal, including future ones) is intentional and correct.

### Rationale
When any session in a goal is overdue, the entire goal's remaining schedule
needs to shift forward to maintain session ordering. Rescheduling only overdue
sessions would create gaps in the goal's sequence (overdue sessions moved to
near future, future sessions untouched and possibly conflicting).

The dialog text "are in the past" explains *why* rescheduling is proposed;
the acceptance action is understood as "reschedule this goal's outstanding
sessions from today". This is consistent with the UX intent of 087.
