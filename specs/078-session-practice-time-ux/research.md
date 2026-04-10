# Research: Session & Practice Goal Execution UX Improvements

**Branch**: `078-session-practice-time-ux` | **Phase**: 0 | **Date**: 2026-04-10

## All spec assumptions verified against the current codebase.

---

## R-001: Is `practiceTimeMs` already stored on linked practices?

**Decision**: Yes — field exists today.

**Rationale**: `TaskLinkedPractice.practiceTimeMs` (number, ms) is defined in `sessionTypes.ts` line 35. Populated in `sessionStorage.ts` line 297 from the `PracticeSavedEvent`. `SessionActivity.practiceTimeMs` is also defined (line 99) and populated (line 260).

**Consequence**: Story 1 (invested time display) requires no new data capture. `TaskRow.tsx` can compute `investedTimeMs = task.linkedPractices.reduce((sum, lp) => sum + lp.practiceTimeMs, 0)` inline.

---

## R-002: Is `estimatedDurationSecs` already stored on tasks?

**Decision**: Yes — field exists today.

**Rationale**: `SessionTask.estimatedDurationSecs?: number` is defined in `sessionTypes.ts` line 55. Already displayed in `TaskRow.tsx` via the `formatEstimatedDuration()` helper (seconds → "Xm Ys"). Already persisted in `SessionIndexEntry.totalEstimatedDurationSecs`.

**Consequence**: Story 1 side-by-side display (invested / estimated) is a pure UI change to `TaskRow.tsx`.

---

## R-003: Does `taskLocked` already propagate to `ResultsOverlay`?

**Decision**: No — gap confirmed.

**Rationale**: `PracticeViewPlugin.tsx` computes `taskLocked: !!taskIdRef.current` and passes it to `usePracticeLoop` (to lock the loop region pins), but this flag is **not** passed to `ResultsOverlay`. The overlay therefore allows the loop count slider to be changed freely during a task-linked practice, violating FR-010.

**Consequence**: Story 3 requires:
1. Add `loopCountLocked?: boolean` prop to `ResultsOverlay`.
2. Pass it from `PracticeViewPlugin.tsx` as `loopCountLocked={!!taskIdRef.current}`.
3. Disable the `<input type="range">` slider and show a tooltip when locked.

**Alternatives considered**: Alternatively, wrap `setLoopCount` in `PracticeViewPlugin.tsx` with a no-op when task-locked (without touching `ResultsOverlay`). Rejected because it would silently swallow user intent with no visual feedback — FR-014 requires a visual hint.

---

## R-004: Where should the session completion summary live?

**Decision**: Persist in the closed session's detail header (inline in `SessionsPlugin.tsx`), computed from task data on close.

**Rationale**:
- FR-007 requires the summary to be accessible from history, not only at close time.
- The simplest approach: store `totalRealTimeSecs` on `SessionIndexEntry` (computed when `closeSession()` is called), and render it in the "collapsible content" header for closed sessions alongside the already-shown `totalEstimatedDurationSecs`.
- A "modal at close time" was considered but rejected: users are often mid-flow and would dismiss it without reading it; having it persistent in the closed session satisfies both the immediate and historical requirements.

**Implementation**: 
- `SessionIndexEntry` gains `totalRealTimeSecs?: number`.
- `useSessionManager.closeSession()` computes the field from `session.tasks.flatMap(t => t.linkedPractices).reduce((sum, lp) => sum + lp.practiceTimeMs, 0) / 1000`.
- `SessionsPlugin.tsx` renders a `SessionTimeSummary` section inside the closed session detail header when both `totalRealTimeSecs` and `totalEstimatedDurationSecs` are available (or either alone when partially estimated).

---

## R-005: Should `SessionTimeSummary` be a separate component?

**Decision**: Yes — a small presentational component in its own file.

**Rationale**: The summary renders conditional colour styling (overrun vs. saving), partial-estimate footnotes, and formatted durations. Extracting it to `SessionTimeSummary.tsx` keeps `SessionsPlugin.tsx` uncluttered and makes the summary independently testable.

**Alternatives considered**: Inline JSX in `SessionsPlugin.tsx`. Rejected because the conditional logic (overrun/saving colours, partial estimate label) would add ~30 lines of JSX to an already large component and would be harder to test in isolation.

---

## R-006: Which locale files need updating?

**Decision**: Both `en.json` and `es.json` in `plugins-external/sessions-plugin/locales/` and in `frontend/src/i18n/locales/`.

**Rationale**:
- Sessions plugin uses its own `i18n.tsx` with `en.json` + `es.json` locale files.
- Frontend practice plugin uses `frontend/src/i18n/locales/en.json` + `es.json`.
- All new visible strings must be added to both language files. Spanish values can mirror English initially (marked TODO for translator).

---

## R-007: Does `SessionIndexEntry.allTasksDone` indicate terminal state for all tasks?

**Decision**: Partially — `allTasksDone` only checks `done`, not `done | failed`. New logic needed.

**Rationale**: `allTasksDone` is set when all tasks have `status === 'done'` (line 167 in `SessionsPlugin.tsx`). But FR-006 requires the summary when all tasks reach a **terminal** status (done OR failed). Need a separate derived check: `allTerminal = tasks.every(t => t.status === 'done' || t.status === 'failed')`.

**Consequence**: The `closeSession()` flow should compute `totalRealTimeSecs` unconditionally (any time a session is closed), since users can also close sessions manually before all tasks are terminal.

---

## R-008: Does the `handleRepractice` callback in `PracticeViewPlugin` correctly restore loopCount from the task after the pending refactor?

**Decision**: Partially — it restores `loopCount` from state, which after task launch is the task's value, but after user interaction it would be the modified value. Lock prevents modification (Story 3), so once the lock is in place, `handleRepractice` correctly re-uses the task's count.

**Rationale**: `handleRepractice` calls `setLoopCount(loopCount)` (line 789) where `loopCount` is the current React state. If the slider is locked (disabled), the state is never mutated from the task's initial value set in `pendingTaskConfigRef.current.loopCount` (line 348). So FR-012 is automatically satisfied once the lock is applied.

**Consequence**: No change to `handleRepractice` is needed — the lock in the overlay is sufficient.
