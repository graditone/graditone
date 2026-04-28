# Quickstart: Sessions Rescheduling (087)

## What This Feature Adds

Two rescheduling capabilities to `plugins-external/sessions-plugin/`:

1. **Auto-reschedule dialog** — shown once per app session on Sessions view open when overdue scheduled sessions are detected.
2. **Manual date picker** — clicking the date label on a session in edit mode opens the existing `DatePicker` component to pick a new date (min = today).

---

## Files to Create

### `rescheduleEngine.ts`

New file containing all business logic as pure/async functions. Import into `SessionsPlugin.tsx`.

```ts
// Minimal skeleton — see contracts/reschedule-engine-api.ts for full signatures

export function detectOverdueSessions(entries, todayISO) { ... }
export function classifyOverdueSessions(overdue) { ... }
export async function rescheduleGoalSessions(goalId, globalOccupied, todayISO) { ... }
export async function rescheduleIsolatedSession(entry, occupied, todayISO) { ... }
export async function applyAutoReschedule(summary, todayISO) { ... }
export async function updateSessionDate(sessionId, newDate) { ... }
```

### `rescheduleEngine.test.ts`

Unit tests for all functions above. Must be written **before** implementation (Principle V).

Key test cases:
- `detectOverdueSessions`: no overdue, some overdue, today boundary (today not overdue)
- `classifyOverdueSessions`: all goal-linked, all isolated, mixed
- `rescheduleGoalSessions`: goal with 2 pending sessions redistributed starting today; existing occupied dates skipped; goal's own dates excluded from occupied
- `rescheduleIsolatedSession`: placed on first free day; occupied set updated
- `applyAutoReschedule`: end-to-end with mocked storage

---

## Files to Modify

### `sessionDistribution.ts`

Add `findFreeDaysFrom(startISO, numDays, occupiedDates)` — variant of `findFreeDays()` with a configurable start date. Keep the existing `findFreeDays()` unchanged.

### `sessionStorage.ts`

Add `updateSessionTargetDate(id, newDate)` helper that writes `targetDate` + `status: 'scheduled'` to both the localStorage index (via `updateSessionIndex`) and the full session in IndexedDB (via `loadSessionFromIndexedDB` + `saveSessionToIndexedDB`).

### `SessionsPlugin.tsx`

Three changes:

**1. Overdue detection + dialog on mount**
```tsx
const reschedulePromptDismissedRef = useRef(false);
const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
const [rescheduleSummary, setRescheduleSummary] = useState<RescheduleSummary | null>(null);

useEffect(() => {
  if (reschedulePromptDismissedRef.current) return;
  const todayISO = formatDateOnly(new Date());
  const overdue = detectOverdueSessions(listSessionsIndex(), todayISO);
  if (overdue.length > 0) {
    setRescheduleSummary(classifyOverdueSessions(overdue));
    setShowRescheduleDialog(true);
  }
}, []); // run once on mount
```

**2. Dialog JSX** (render at top of return, before session list)
```tsx
{showRescheduleDialog && rescheduleSummary && (
  <div className="sessions-plugin__reschedule-dialog" role="dialog" aria-modal="true">
    <h3>{t('sessions.reschedule_dialog_title')}</h3>
    <p>{t('sessions.reschedule_dialog_body', {
      goalCount: new Set(rescheduleSummary.goalLinked.map(s => s.goalId)).size,
      isolatedCount: rescheduleSummary.isolated.length,
    })}</p>
    <button onClick={handleRescheduleAccept}>{t('sessions.reschedule_dialog_accept')}</button>
    <button onClick={handleRescheduleDismiss}>{t('sessions.reschedule_dialog_dismiss')}</button>
  </div>
)}
```

**3. Date picker in edit mode** (in the session row, where `entry.targetDate` is displayed)
```tsx
// Replace the static targetDate span with:
{entry.targetDate && entry.status === 'scheduled' && editingSessionId === entry.id ? (
  <DatePicker
    value={entry.targetDate}
    min={formatDateOnly(new Date())}
    onChange={(date) => handleManualReschedule(entry.id, date)}
    aria-label={t('sessions.change_date_aria')}
  />
) : entry.targetDate ? (
  <span className="sessions-plugin__target-date">
    📅 {new Date(entry.targetDate + 'T00:00:00').toLocaleDateString(...)}
  </span>
) : null}
```

### `i18n.tsx` + `locales/*.json`

Add the 5 new translation keys from Research R7.

---

## Running Tests

```bash
cd plugins-external/sessions-plugin
npm test                          # run all Vitest tests
npm test -- rescheduleEngine      # run only rescheduleEngine tests
npm run typecheck                 # verify TypeScript
```

## Building & Local Dev

```bash
npm run build                     # produces sessions-plugin.zip in dist/
npm run dev                       # Vite dev server for isolated plugin testing
```

---

## Key Invariants

- `detectOverdueSessions` is **synchronous** — reads only the localStorage index.
- `today` is never considered overdue — `targetDate < todayISO` (strict less-than).
- `completed` and `skipped` tasks within a session are never touched — session-level rescheduling only changes `targetDate` and `status`.
- The auto-reschedule dialog appears **at most once** per app session (suppressed by ref after first dismiss or accept).
- The manual date picker enforces `min = today` via the `DatePicker` component's existing `min` prop.
