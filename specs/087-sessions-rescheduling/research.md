# Research: Sessions Rescheduling (087)

All unknowns resolved from direct codebase exploration of `plugins-external/sessions-plugin/`.

---

## R1 — Overdue Session Detection

**Decision**: Use the existing localStorage index (`listSessionsIndex()`) synchronously on Sessions view mount.

**Rationale**: The index is already in localStorage so detection is O(n) with zero async overhead, satisfying SC-001 (dialog within 1 second). An overdue session is any `SessionIndexEntry` where `status === 'scheduled'` and `targetDate < todayISO`.

**Implementation**: New pure function `detectOverdueSessions(entries: SessionIndexEntry[], todayISO: string): SessionIndexEntry[]`.

**Alternatives considered**: Loading full sessions from IndexedDB — rejected because `targetDate` is already mirrored in the index, making a full async load unnecessary.

---

## R2 — findFreeDays Extension

**Decision**: Add `findFreeDaysFrom(startISO: string, numDays: number, occupiedDates: Set<string>): string[]` to `sessionDistribution.ts` alongside the existing `findFreeDays()`.

**Rationale**: The existing `findFreeDays()` always starts from tomorrow. For rescheduling, we may want to start from today (so the first redistributed session can land on today if today is free). Extracting a `startISO` parameter makes both cases possible and keeps the original function unchanged for backward compatibility.

**Implementation**:
```ts
export function findFreeDaysFrom(startISO: string, numDays: number, occupiedDates: Set<string>): string[] {
  const [y, m, d] = startISO.split('-').map(Number);
  const candidate = new Date(y, m - 1, d);
  const occupied = new Set(occupiedDates);
  const result: string[] = [];
  while (result.length < numDays) {
    const key = formatDateOnly(candidate);
    if (!occupied.has(key)) {
      result.push(key);
      occupied.add(key);
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return result;
}
```

**Alternatives considered**: Modifying `findFreeDays()` in-place — rejected to avoid breaking existing callers.

---

## R3 — Goal-Linked Session Redistribution

**Decision**: For each goal touched by an overdue session:
1. Load the full `Goal` from IndexedDB via `loadGoalFromIndexedDB(goalId)`.
2. Filter `goal.sessionIds` to pending sessions (`status === 'scheduled'`, not closed, not active).
3. Build `occupiedDates` from `getOccupiedDates()` **excluding** the goal's own pending sessions' current `targetDate` values (those slots are being vacated).
4. Call `findFreeDaysFrom(todayISO, pendingCount, adjustedOccupied)` to get new dates.
5. Update each session: `updateSessionIndex(id, { targetDate: newDate })` + `saveSessionToIndexedDB(...)` with updated `targetDate`.

**Rationale**: This reuses all existing storage helpers. The "exclude own slots" rule matches the clarified answer from session Q3.

**Implementation location**: New file `rescheduleEngine.ts` — pure async function `rescheduleGoalSessions(goalId, allIndexEntries, todayISO): Promise<void>`.

---

## R4 — Isolated Session Redistribution

**Decision**: For each overdue isolated session (no `goalId`):
1. Find next free day using `findFreeDaysFrom(todayISO, 1, occupiedSoFar)`.
2. Update `targetDate` on both the index and IndexedDB.
3. Add the new date to `occupiedSoFar` to avoid double-booking subsequent isolated sessions.

**Rationale**: Simple single-day assignment; `getOccupiedDates()` is the baseline occupied set and is updated incrementally as each isolated session is assigned.

---

## R5 — Manual Date Picker Integration

**Decision**: The existing `DatePicker.tsx` component (Feature 066) is reused directly. It already supports `value`, `min`, and `onChange` props.

**Integration point**: In `SessionsPlugin.tsx`, when rendering the `entry.targetDate` span (line ~633), wrap it in a conditional: if `editingSessionId === entry.id`, render a `<button>` that opens a `<DatePicker>` inline (or in a popover). On `onChange`, call a new `handleRescheduleSession(id, newDate)` handler that calls `updateSessionIndex` + `saveSessionToIndexedDB`.

**Edit mode**: The `editingSessionId` state already exists (set by the "Edit" / "Done" toggle button, shown for non-closed sessions). No new state needed.

**State transition**: When a date changes via the picker, session `status` transitions to `'scheduled'` (FR-010). If the session was already `'scheduled'`, just the date updates. If `'active'`, the status cannot change to `'scheduled'` — the date picker should only appear for non-active sessions (i.e., `status === 'scheduled'`, since `'closed'` sessions have no Edit button).

**Decision — date picker activation scope**: Only `'scheduled'` sessions have an Edit button *and* a `targetDate`, so the date picker naturally applies only to them. Active sessions can have a `targetDate` (preserved from scheduling) but the picker is not appropriate there (session is in progress). The implementation guards: `entry.status === 'scheduled' && editingSessionId === entry.id`.

---

## R6 — Auto-Reschedule Dialog Suppression

**Decision**: An in-memory `useRef<boolean>` flag (`reschedulePromptDismissedRef`) in `SessionsPlugin`. Set to `true` after the user dismisses the dialog. Checked on each mount of the Sessions view component; if `true`, skip showing the dialog.

**Rationale**: React `useRef` persists across re-renders and navigation within the same app session. No localStorage write needed. This correctly satisfies "suppress for the rest of the app session" (Q2 answer B).

---

## R7 — i18n Keys Required

New keys to add to `i18n.tsx` + all locale files (`en`, any existing locales):

| Key | Example value (en) |
|-----|-------------------|
| `sessions.reschedule_dialog_title` | `Rescheduling past sessions` |
| `sessions.reschedule_dialog_body` | `{goalCount} goal-linked session(s) and {isolatedCount} isolated session(s) are in the past.` |
| `sessions.reschedule_dialog_accept` | `Reschedule` |
| `sessions.reschedule_dialog_dismiss` | `Skip` |
| `sessions.change_date_aria` | `Change scheduled date` |

---

## R8 — Post-Design Constitution Re-Check

| Principle | Post-Design Status | Notes |
|-----------|-------------------|-------|
| I. DDD | ✅ PASS | `rescheduleEngine.ts` contains pure domain functions; UI is a thin caller |
| III. PWA | ✅ PASS | All storage via existing IndexedDB/localStorage helpers |
| V. Test-First | ✅ REQUIRED | `rescheduleEngine.test.ts` covers detection, goal redistribution, isolated redistribution, and edge cases |
| VII. Regression | ✅ REQUIRED | Edge cases: all sessions past, no free days, mixed types, skipped/completed exclusion |
| VIII. Profile Awareness | ✅ PASS | `getOccupiedDates()` and `listSessionsIndex()` are already profile-scoped; `loadGoalFromIndexedDB` uses `getActiveProfileId()` index internally |
