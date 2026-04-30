# Quickstart: Fix Rescheduling Bugs — Feature 090

## Prerequisites

- Node 22 (managed via `.nvmrc`)
- The `plugins-external/` repo cloned inside this worktree and on the
  `090-fix-rescheduling-bugs` branch (already done)

```bash
# Verify setup
cd /path/to/.worktrees/090-fix-rescheduling-bugs
ls plugins-external/sessions-plugin/package.json   # must exist
cd plugins-external/sessions-plugin
git branch --show-current                           # 090-fix-rescheduling-bugs
```

## Install Dependencies

```bash
cd plugins-external/sessions-plugin
npm install
```

## Run Tests

```bash
# From plugins-external/sessions-plugin/
npm test               # run all unit tests (Vitest)
npm run test:watch     # watch mode during development
```

The relevant test files for this feature:
- `rescheduleEngine.test.ts` — unit tests for detection and classification logic
- `SessionsPlugin.test.tsx` — integration tests for the dialog lifecycle

## What to Fix

Three targeted changes, each preceded by a failing regression test (Principle VII):

### Fix 1 — Detection Timing (`SessionsPlugin.tsx`)

**Symptom**: When localStorage index is empty (profile migration, cache clear),
no dialog appears despite past sessions existing in IndexedDB.

**Change**: Remove the standalone detection `useEffect([], [])`. Chain detection
into the `refreshSessions` mount effect so it runs after `reconcileSessionsIndex()`
completes:

```tsx
// REMOVE this standalone effect:
useEffect(() => {
  if (reschedulePromptDismissedRef.current) return;
  const todayISO = new Date().toISOString().slice(0, 10);
  const overdue = detectOverdueSessions(listSessionsIndex(), todayISO);
  if (overdue.length > 0) {
    setRescheduleSummary(classifyOverdueSessions(overdue));
    setShowRescheduleDialog(true);
  }
}, []);

// REPLACE the refreshSessions effect with:
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

**Regression test** (add to `SessionsPlugin.test.tsx`): mock
`reconcileSessionsIndex` to populate the index asynchronously, assert the dialog
appears only after reconciliation resolves.

---

### Fix 2 — Dialog Backdrop (`SessionsPlugin.css`)

**Symptom**: Reschedule dialog appears without the semi-transparent backdrop that
all other dialogs have, making it visually inconsistent.

**Change**: Add `background: rgba(0, 0, 0, 0.45)` to
`.sessions-plugin__reschedule-overlay`:

```css
.sessions-plugin__reschedule-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);   /* ← add this line */
}
```

**Regression test**: add a snapshot or class assertion verifying the overlay
element has the expected class in `SessionsPlugin.test.tsx`.

---

### Fix 3 — Accurate Goal Count in Dialog Body (`SessionsPlugin.tsx`)

**Symptom**: Dialog says "1 goal-linked session(s)" when 2 sessions from the
same goal are both overdue (because `Set.size` counts unique goals, not sessions).

**Change**: Replace `.size` with `.length`:

```tsx
// BEFORE:
goalCount: new Set(rescheduleSummary.goalLinked.map((s) => s.goalId)).size,

// AFTER:
goalCount: rescheduleSummary.goalLinked.length,
```

**Regression test** (add to `rescheduleEngine.test.ts` or `SessionsPlugin.test.tsx`):
create a summary with 2 goal-linked sessions sharing the same `goalId`, assert
`goalCount === 2` in the rendered dialog body.

---

## Verification Checklist

After applying all three fixes and passing tests:

- [ ] `npm test` — all tests pass, including new regression tests
- [ ] Manual: create 3 overdue sessions (2 with same goalId, 1 isolated); clear
  localStorage manually in DevTools; reload Sessions view → dialog appears
  with "2 goal-linked session(s) and 1 isolated session(s)"
- [ ] Manual: open Sessions view with past sessions → dialog has semi-transparent
  backdrop matching the delete-confirm dialog
- [ ] Manual: accept auto-reschedule → zero sessions remain with past `targetDate`
- [ ] Manual: dismiss dialog, reload page → dialog reappears (still dismissed for
  current app session only, not persisted across page loads)
