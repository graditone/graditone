# Tasks: Sessions Rescheduling

**Input**: Design documents from `/specs/087-sessions-rescheduling/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no deps on incomplete tasks)
- **[Story]**: User story label — US1 or US2
- All paths relative to repo root

---

## Phase 1: Setup

**Purpose**: Create new file skeleton before any implementation begins.

- [x] T001 Create `plugins-external/sessions-plugin/rescheduleEngine.ts` with exported function stubs matching `contracts/reschedule-engine-api.ts` (all functions throw `'not implemented'`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities required by both user stories. All tasks touch different files and can run in parallel.

**⚠️ CRITICAL**: Both user stories depend on these. Complete Phase 2 before starting Phase 3 or 4 implementation.

- [x] T002 [P] Add `findFreeDaysFrom(startISO: string, numDays: number, occupiedDates: Set<string>): string[]` to `plugins-external/sessions-plugin/sessionDistribution.ts` alongside the existing `findFreeDays()` (keep existing function unchanged)
- [x] T003 [P] Add `findFreeDaysFrom` unit tests to `plugins-external/sessions-plugin/sessionDistribution.test.ts`: start-from-today, skip occupied days, stop when enough days found
- [x] T004 [P] Add `updateSessionTargetDate(id: string, newDate: string): Promise<void>` helper to `plugins-external/sessions-plugin/sessionStorage.ts` — writes `targetDate` + `status: 'scheduled'` to both localStorage index (`updateSessionIndex`) and IndexedDB (`loadSessionFromIndexedDB` + `saveSessionToIndexedDB`)
- [x] T005 [P] Add 5 i18n keys to `plugins-external/sessions-plugin/i18n.tsx` and all locale files in `plugins-external/sessions-plugin/locales/`: `sessions.reschedule_dialog_title`, `sessions.reschedule_dialog_body` (with `goalCount`/`isolatedCount` placeholders), `sessions.reschedule_dialog_accept`, `sessions.reschedule_dialog_dismiss`, `sessions.change_date_aria`

**Checkpoint**: Shared utilities ready — both user story phases can now proceed.

---

## Phase 3: User Story 1 — Auto-Reschedule Past Sessions on View Open (Priority: P1) 🎯 MVP

**Goal**: When the Sessions view opens with overdue scheduled sessions, show a one-time dialog (per app session) summarising goal-linked and isolated counts; on accept, bulk-reschedule all pending sessions using `findFreeDaysFrom`.

**Independent Test**: Create sessions in the past (one with `goalId`, one without), open the Sessions view, verify the dialog appears with correct counts; accept — verify all sessions have future `targetDate` values; dismiss — verify no sessions changed. Reload Sessions view after dismiss — verify no dialog.

### Tests for User Story 1

> **Write these FIRST — verify they FAIL before implementing (Constitution Principle V)**

- [x] T006 [P] [US1] Write failing unit tests for `detectOverdueSessions` (no overdue, some overdue, today boundary — today is NOT overdue) and `classifyOverdueSessions` (all goal-linked, all isolated, mixed) in `plugins-external/sessions-plugin/rescheduleEngine.test.ts`
- [x] T007 [P] [US1] Write failing unit tests for `rescheduleGoalSessions` (2 pending sessions redistributed from today; occupied dates skipped; goal's own dates excluded from occupied set; ordering preserved) in `plugins-external/sessions-plugin/rescheduleEngine.test.ts`
- [x] T008 [P] [US1] Write failing unit tests for `rescheduleIsolatedSession` (placed on first free day; occupied set updated after assignment) and `applyAutoReschedule` (end-to-end: mocked storage, mixed summary, both strategies applied) in `plugins-external/sessions-plugin/rescheduleEngine.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement `detectOverdueSessions` and `classifyOverdueSessions` in `plugins-external/sessions-plugin/rescheduleEngine.ts` — verify T006 tests pass
- [x] T010 [US1] Implement `rescheduleGoalSessions` in `plugins-external/sessions-plugin/rescheduleEngine.ts` — loads Goal from IndexedDB, filters pending sessionIds, builds adjustedOccupied (excluding goal's own current targetDates), calls `findFreeDaysFrom`, updates index + IndexedDB for each session — verify T007 tests pass
- [x] T011 [US1] Implement `rescheduleIsolatedSession` and `applyAutoReschedule` in `plugins-external/sessions-plugin/rescheduleEngine.ts` — verify T008 tests pass
- [x] T012 [US1] Add `reschedulePromptDismissedRef` (useRef\<boolean\>), `showRescheduleDialog` (useState), `rescheduleSummary` (useState\<RescheduleSummary | null\>), and a mount-only `useEffect` that synchronously checks `listSessionsIndex()` for overdue sessions (using `detectOverdueSessions` + `classifyOverdueSessions`) and sets dialog state in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [x] T013 [US1] Add auto-reschedule dialog JSX to `plugins-external/sessions-plugin/SessionsPlugin.tsx` — rendered above the session list; includes `role="dialog"`, `aria-modal="true"`, summary paragraph using `rescheduleSummary` (unique goal count + isolated count), Accept and Skip buttons
- [x] T014 [US1] Add `handleRescheduleAccept` (calls `applyAutoReschedule`, then `refreshSessions`, then closes dialog) and `handleRescheduleDismiss` (sets `reschedulePromptDismissedRef.current = true`, closes dialog without modifying sessions) in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [x] T015 [P] [US1] Add `.sessions-plugin__reschedule-dialog` CSS rules (modal overlay positioning, dialog card styling, button row) to `plugins-external/sessions-plugin/SessionsPlugin.css`
- [x] T016 [P] [US1] Add `SessionsPlugin` tests to `plugins-external/sessions-plugin/SessionsPlugin.test.tsx`: dialog renders when past sessions exist; dialog does NOT render when no past sessions; clicking Skip closes dialog and leaves sessions unchanged; clicking Reschedule triggers `applyAutoReschedule`

**Checkpoint**: User Story 1 fully functional. Auto-reschedule dialog shows, dismisses (suppressed for session), and applies bulk rescheduling correctly.

---

## Phase 4: User Story 2 — Manual Reschedule via In-Session Date Picker (Priority: P2)

**Goal**: When a `'scheduled'` session is in edit mode, the `targetDate` label becomes a clickable `DatePicker` (min=today). Selecting a date updates `targetDate` + confirms `'scheduled'` status.

**Independent Test**: Open a scheduled session in edit mode, click the date label, verify `DatePicker` opens with today as minimum. Select a future date — verify the session's `targetDate` updates and status remains `'scheduled'`. Exit edit mode — verify date label is no longer interactive (click has no effect).

### Tests for User Story 2

> **Write these FIRST — verify they FAIL before implementing (Constitution Principle V)**

- [x] T017 [P] [US2] Write failing unit tests for `updateSessionDate` in `plugins-external/sessions-plugin/rescheduleEngine.test.ts`: updates targetDate in index and IndexedDB; sets status to `'scheduled'`; handles session not found gracefully
- [x] T018 [P] [US2] Write failing `SessionsPlugin` tests in `plugins-external/sessions-plugin/SessionsPlugin.test.tsx`: `DatePicker` is visible for a `'scheduled'` session in edit mode; `DatePicker` is NOT visible when session is not in edit mode; selecting a date via `DatePicker` triggers the update handler

### Implementation for User Story 2

- [x] T019 [US2] Implement `updateSessionDate` in `plugins-external/sessions-plugin/rescheduleEngine.ts` — calls `updateSessionTargetDate(id, newDate)` from `sessionStorage.ts` — verify T017 tests pass
- [x] T020 [US2] Replace static `targetDate` span in `plugins-external/sessions-plugin/SessionsPlugin.tsx` with conditional: when `entry.status === 'scheduled' && editingSessionId === entry.id`, render `<DatePicker value={entry.targetDate} min={todayISO} onChange={handleManualReschedule} />` with `aria-label` from `sessions.change_date_aria`; otherwise render the existing static `📅 …` span — verify T018 tests pass
- [x] T021 [US2] Add `handleManualReschedule(sessionId: string, newDate: string)` callback to `plugins-external/sessions-plugin/SessionsPlugin.tsx` — calls `updateSessionDate`, then `refreshSessions`, then reloads the expanded session if it is in `loadedSessions`

**Checkpoint**: User Stories 1 and 2 are both independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T022 [P] Run `npm run typecheck` in `plugins-external/sessions-plugin/` — fix any TypeScript errors introduced by new types/imports
- [x] T023 [P] Run `npm test` in `plugins-external/sessions-plugin/` — all tests (rescheduleEngine, sessionDistribution, SessionsPlugin) must pass
- [x] T024 Run `npm run build` in `plugins-external/sessions-plugin/` — verify ZIP artifact builds without errors

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─> Phase 2 (Foundational) — T002–T005 in parallel
        └─> Phase 3 (US1) — tests T006–T008 in parallel, then implementation T009→T010→T011→T012→T013→T014, T015/T016 parallel
        └─> Phase 4 (US2) — tests T017–T018 in parallel, then T019→T020→T021
              └─> Phase 5 (Polish) — T022/T023 in parallel, then T024
```

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only. Independent — no dep on US2.
- **US2 (P2)**: Depends on Phase 2 (`updateSessionTargetDate` from T004) and US1 completion (`updateSessionDate` extends `rescheduleEngine.ts`). Can begin test writing (T017–T018) in parallel with US1 implementation.

### Within Each User Story

- Tests (T006–T008, T017–T018) must be written and failing **before** implementation starts.
- Engine implementations (T009, T010, T011, T019) must be sequential — each adds functions to `rescheduleEngine.ts`.
- `SessionsPlugin.tsx` changes (T012, T013, T014, T020, T021) must be sequential — same file.
- CSS (T015) and test additions (T016, T018) are parallel to each other and to `SessionsPlugin.tsx` changes.

### Parallel Execution Examples

**Phase 2** (all parallel):
```
T002 (sessionDistribution.ts) ‖ T003 (sessionDistribution.test.ts) ‖ T004 (sessionStorage.ts) ‖ T005 (i18n)
```

**Phase 3 tests** (all parallel, start after T001):
```
T006 ‖ T007 ‖ T008
```

**Phase 3 implementation** (sequential for same file, parallel for different files):
```
T009 → T010 → T011 → T012 → T013 → T014
T015 ‖ T016  (parallel to T012–T014)
```

**Phase 4**:
```
T017 ‖ T018  (parallel, write before T019)
T019 → T020 → T021
```

---

## Implementation Strategy

### MVP Scope (Phase 1 + 2 + 3 only)

Complete Phase 3 (US1) first — it delivers the primary value (auto-reschedule on view open). This can ship independently before the manual date picker (US2).

### Incremental Delivery Order

1. Phase 1 + 2: File skeleton + shared utilities (no visible change to users)
2. Phase 3: Auto-reschedule dialog fully working ← **shippable MVP**
3. Phase 4: Manual date picker added ← **full feature**
4. Phase 5: Final verification pass

---

## Format Validation

- Total tasks: **24**
- US1 tasks: 11 (T006–T016)
- US2 tasks: 5 (T017–T021)
- Foundational tasks: 4 (T002–T005)
- Setup tasks: 1 (T001)
- Polish tasks: 3 (T022–T024)
- All tasks: ✅ checkbox + ID + [P/Story labels] + file path
- Parallel opportunities identified: Phase 2 (4-way), Phase 3 tests (3-way), Phase 4 tests (2-way), Phase 5 (2-way)
- Independent test criteria: defined per story
- MVP scope: Phase 1 + 2 + 3 (US1 auto-reschedule dialog)
