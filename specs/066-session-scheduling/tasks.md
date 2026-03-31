# Tasks: Session Scheduling

**Input**: Design documents from `/specs/066-session-scheduling/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Unit tests for new functions, verification tests for existing behavior with new status.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Type system and storage layer extensions — additive, backward-compatible changes

- [X] T001 Add `'scheduled'` to status union and `targetDate?: string` field on `Session` interface in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T002 Add `'scheduled'` to status union and `targetDate?: string` field on `SessionIndexEntry` interface in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T003 Extend `updateSessionIndex` to accept `targetDate` in its `update` parameter type in `plugins-external/sessions-plugin/sessionStorage.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Storage normalization, date validation, and session manager functions that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `isValidTargetDate(targetDate: string): boolean` helper (returns true if date string is strictly after today) in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T005 [P] Add `sortSessions` comparator function: active first, then scheduled by targetDate ascending, then closed by createdAt descending, in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T006 Add `scheduleSession(targetDate: string, tasks?: SessionTask[])` function to `plugins-external/sessions-plugin/useSessionManager.ts` — validates targetDate > today, creates session with status `'scheduled'` and targetDate, persists to IndexedDB + index, does NOT set activeSessionId
- [X] T007 Add `activateScheduledSession(id: string)` function to `plugins-external/sessions-plugin/useSessionManager.ts` — guards on activeSessionIdRef.current, loads session from IndexedDB, verifies status === 'scheduled', sets status to 'active', persists, updates index, sets activeSessionId state and ref
- [X] T008 Return `scheduleSession` and `activateScheduledSession` from the `useSessionManager` hook's return object in `plugins-external/sessions-plugin/useSessionManager.ts`
- [X] T008a [P] Add unit tests for `isValidTargetDate`: today returns false, yesterday returns false, tomorrow returns true, invalid string returns false — in `plugins-external/sessions-plugin/sessions-plugin.test.tsx` (or new test file)
- [X] T008b [P] Add unit tests for `sortSessions`: verify active first, scheduled by targetDate ascending, closed by createdAt descending — in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`
- [X] T008c Add unit tests for `scheduleSession`: creates with 'scheduled' status and targetDate, rejects past dates, accepts optional tasks — in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`
- [X] T008d Add unit tests for `activateScheduledSession`: transitions scheduled→active, rejects when active session exists, rejects non-scheduled sessions, rejects closed sessions — in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`

**Checkpoint**: Foundation ready — type system extended, storage updated, manager functions available, unit tests passing

---

## Phase 3: User Story 1 — Schedule a Future Practice Session (Priority: P1) 🎯 MVP

**Goal**: Users can create a scheduled session by selecting a future date in the session creation flow. The date picker defaults to today; selecting today preserves existing immediate-start behavior.

**Independent Test**: Create a session with a future date → verify it appears in list with "Scheduled" badge and target date.

### Implementation for User Story 1

- [X] T009 [US1] Add date picker state (`selectedDate`, defaulting to today's date string) and `<input type="date">` element with `min` attribute set to today in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T010 [US1] Pass `selectedDate` to the `onCreateSession` callback in `plugins-external/sessions-plugin/TaskBuilder.tsx` — extend callback signature to `(tasks: SessionTask[], targetDate?: string) => Promise<void>`
- [X] T011 [US1] Update `handleCreateSessionWithTasks` in `plugins-external/sessions-plugin/SessionsPlugin.tsx` to receive `targetDate` from TaskBuilder — if target date equals today, call existing `createSessionWithTasks(tasks)`; if future date, call `scheduleSession(targetDate, tasks)`
- [X] T012 [US1] Update `handleShowTaskBuilder` flow in `plugins-external/sessions-plugin/SessionsPlugin.tsx` to also show the TaskBuilder when no active session exists (preserve current gating) and allow scheduled sessions to be created even when an active session exists
- [X] T013 [US1] Add "Scheduled" status badge variant (`sessions-plugin__status-badge--scheduled`) displaying target date in `plugins-external/sessions-plugin/SessionsPlugin.tsx` session list item rendering
- [X] T014 [US1] Apply `sortSessions` comparator to the sessions array before rendering the session list in `plugins-external/sessions-plugin/SessionsPlugin.tsx`

**Checkpoint**: Users can create scheduled sessions via date picker. Sessions persist and display with correct status. List sorted by three-tier ordering.

---

## Phase 4: User Story 2 — Activate a Scheduled Session (Priority: P1)

**Goal**: Users can activate a scheduled session, transitioning it to active. Activate button is disabled with tooltip when another session is already active.

**Independent Test**: Create a scheduled session → tap activate → verify it transitions to active and accepts activities.

### Implementation for User Story 2

- [X] T015 [US2] Add "▶ Activate" button to scheduled session items in `plugins-external/sessions-plugin/SessionsPlugin.tsx` — visible only when `entry.status === 'scheduled'`
- [X] T016 [US2] Disable the activate button and add `title="Only one active session can exist"` tooltip when `hasActiveSession` is true in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T017 [US2] Wire activate button's `onClick` to call `activateScheduledSession(entry.id)` then `refreshSessions()` in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T018 [US2] Make the "▶ New Session" button always visible regardless of active session state (users need it to schedule future sessions even when an active session exists) in `plugins-external/sessions-plugin/SessionsPlugin.tsx`

**Checkpoint**: Scheduled sessions can be activated. Single-active constraint enforced via disabled button + tooltip. List updates immediately after activation.

---

## Phase 5: User Story 3 — View Session Lifecycle States (Priority: P2)

**Goal**: Session list shows all three states with distinct visual indicators and correct ordering.

**Independent Test**: Create sessions in all three states → verify distinct badges and correct sort order (active → scheduled by date → closed by recency).

### Implementation for User Story 3

- [X] T019 [P] [US3] Add CSS styles for `.sessions-plugin__status-badge--scheduled` (distinct color from active/closed) and `.sessions-plugin__item--scheduled` background in `plugins-external/sessions-plugin/SessionsPlugin.tsx` (or associated CSS file)
- [X] T020 [US3] Display `targetDate` formatted as locale date string in the session item metadata line (next to created date) for scheduled and formerly-scheduled sessions in `plugins-external/sessions-plugin/SessionsPlugin.tsx`

**Checkpoint**: All three session states visually distinct. List ordering correct.

---

## Phase 6: User Story 4 — Enforce Closed Session Finality (Priority: P2)

**Goal**: Closed sessions cannot be reactivated or rescheduled. No activate/schedule actions visible for closed sessions.

**Independent Test**: Close a session → verify no activate button or date picker appears for it.

### Implementation for User Story 4

- [X] T021 [US4] Ensure the activate button is NOT rendered for sessions with `status === 'closed'` in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T022 [US4] Add guard in `activateScheduledSession` to reject sessions whose status is not `'scheduled'` (defense-in-depth) in `plugins-external/sessions-plugin/useSessionManager.ts`

**Checkpoint**: Closed sessions are fully sealed — no status change actions available.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [X] T023 [P] Verify backward compatibility: load app with existing sessions (no targetDate), confirm they display correctly with no errors in `plugins-external/sessions-plugin/`
- [X] T024 [P] Run TypeScript type check (`cd frontend && npx tsc --noEmit`) and fix any type errors
- [X] T025 [P] Run existing test suite (`cd frontend && npx vitest run`) and fix any regressions
- [X] T026 Update `FEATURES.md` to document session scheduling capability
- [X] T027 [P] Verify FR-011: delete a scheduled session via existing `deleteSession()` — confirm it is removed from IndexedDB and index in `plugins-external/sessions-plugin/`
- [X] T028 [P] Verify FR-012: rename a scheduled session via existing `renameSession()` — confirm it is removed from IndexedDB and index in `plugins-external/sessions-plugin/`
- [X] T029 [P] Verify FR-013: create sessions up to MAX_SESSIONS(50) cap with a mix of active, scheduled, and closed — confirm only closed sessions are evicted, scheduled sessions are preserved in `plugins-external/sessions-plugin/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (type definitions must exist first)
- **US1 (Phase 3)**: Depends on Phase 2 (`scheduleSession`, `sortSessions`, `isValidTargetDate` must exist)
- **US2 (Phase 4)**: Depends on Phase 2 (`activateScheduledSession` must exist). Can run in parallel with US1 if both use Phase 2 outputs.
- **US3 (Phase 5)**: Depends on Phase 3 (scheduled sessions must be creatable to see them in the list)
- **US4 (Phase 6)**: Depends on Phase 2 (guard in `activateScheduledSession`). Can run in parallel with US1/US2/US3.
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational phase. No dependency on other stories.
- **US2 (P1)**: Requires Foundational phase. Independent of US1 (can activate scheduled sessions created by US1 or test data).
- **US3 (P2)**: Requires US1 (needs scheduled sessions to exist for visual verification).
- **US4 (P2)**: Requires Foundational phase only. Independent of other stories.

### Within Each User Story

- UI rendering tasks depend on their data-layer prerequisites
- CSS tasks marked [P] can run in parallel with logic tasks

### Parallel Opportunities

- T004 and T005 can run in parallel (different functions, same file)
- T019 (CSS) can run in parallel with any non-CSS task
- T023, T024, T025, T026 (Polish) can all run in parallel
- US2 and US4 can be worked in parallel after Phase 2

---

## Parallel Example: After Phase 2

```
# These can run simultaneously:
T009 [US1] Date picker in TaskBuilder
T015 [US2] Activate button in SessionsPlugin
T019 [US3] CSS styles for scheduled badge
T021 [US4] Guard closed sessions from activate button
```

---

## Implementation Strategy

### MVP Scope
User Story 1 (Schedule a Future Practice Session) is the minimum viable increment. After Phase 3, users can create and view scheduled sessions. User Story 2 (Activate) is co-priority P1 and should follow immediately.

### Incremental Delivery
1. **Phase 1–2**: Foundation (types + storage + manager functions)
2. **Phase 3**: MVP — scheduling works end-to-end
3. **Phase 4**: Activation — scheduled sessions become usable
4. **Phase 5**: Visual polish — three-state distinction
5. **Phase 6**: Safety — closed session finality enforced
6. **Phase 7**: Validation — backward compat, types, tests, docs
