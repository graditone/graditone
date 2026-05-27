# Tasks: Session Task Distribution

**Input**: Design documents from `/specs/070-session-task-distribution/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — Constitution Principle V (Test-First Development) and plan.md specify test coverage for all new modules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User stories are ordered by data-flow dependencies: US2 (difficulty/duration estimation) before US1 (multi-phrase task generation) because US1 needs difficulty/duration per task, then US3 (session distribution) which needs the task list from US1, then US4 (free-day scheduling) which needs the sessions from US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type changes and data model updates that underpin all user stories

- [X] T001 Add `difficulty?: DifficultyLevel` and `estimatedDurationSecs?: number` fields to `SessionTask` interface in plugins-external/sessions-plugin/sessionTypes.ts
- [X] T002 Add `availableTime?: number` field to `Session` interface in plugins-external/sessions-plugin/sessionTypes.ts
- [X] T003 Add `totalEstimatedDurationSecs?: number` field to `SessionIndexEntry` interface in plugins-external/sessions-plugin/sessionTypes.ts
- [X] T004 Replace `sessionId: string` with `sessionIds: string[]` in `Goal` interface in plugins-external/sessions-plugin/goalTypes.ts
- [X] T005 Add lazy migration in goal storage read path: if `sessionId` exists and `sessionIds` does not, set `sessionIds = [sessionId]` in plugins-external/sessions-plugin/goalEngine.ts (or relevant storage helper)
- [X] T006 Verify TypeScript compilation passes and all existing tests still pass after type changes

**Checkpoint**: All shared types updated — user story implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rust per-region difficulty computation — required by US2 (duration estimation) and US1 (task difficulty)

**⚠️ CRITICAL**: US1 and US2 cannot be completed without the WASM region difficulty function.

- [X] T007 Refactor `compute_instrument_difficulty()` in backend/src/domain/difficulty/density.rs to accept optional measure range parameters (`start_measure`, `end_measure`) while preserving existing whole-score behavior when range is None
- [X] T008 Add `compute_region_difficulty(score: &Score, start_measure: usize, end_measure: usize, staff_index: Option<usize>) -> Option<DifficultyRating>` public function in backend/src/domain/difficulty/density.rs per research.md Topic 1
- [X] T009 Add `compute_region_difficulty` WASM binding in backend/src/adapters/wasm/bindings.rs with signature: `fn compute_region_difficulty(score_js: JsValue, start_measure: usize, end_measure: usize, staff_index: i32) -> Result<JsValue, JsValue>` per contracts/wasm-difficulty-region.md
- [X] T010 Write Rust tests for `compute_region_difficulty` in backend/tests/difficulty_region_tests.rs: valid range returns rating, single-staff filtering, BH (staff_index -1) uses max across staves, invalid range errors, out-of-bounds errors, empty region returns None
- [X] T011 Verify Rust tests pass: `cargo test region_difficulty`
- [X] T012 Add `getRegionDifficulty(startMeasure: number, endMeasure: number, staffIndex: number): DifficultyRating | null` to `PluginScorePlayerContext` interface in frontend/src/plugin-api/types.ts (API version bump to v10)
- [X] T013 Implement `getRegionDifficulty()` in frontend/src/plugin-api/scorePlayerContext.ts — delegates to WASM `compute_region_difficulty`, catches errors and returns null
- [X] T014 Rebuild WASM module (`cd frontend && npm run build:wasm`) and verify `getRegionDifficulty` is callable from TypeScript

**Checkpoint**: WASM region difficulty available via Plugin API — US1 and US2 can proceed.

---

## Phase 3: User Story 2 — Task Difficulty and Duration Estimation (Priority: P1)

**Goal**: Each auto-generated task receives a computed difficulty rating and estimated practice duration in seconds using the formula from research.md Topic 2.

**Independent Test**: Call `estimateTaskDuration()` with known inputs (measures, loopCount, difficulty, minResult) and verify output matches expected formula: `numMeasures × 210 × difficultyMultiplier × loopMultiplier × resultMultiplier`.

### Tests for User Story 2

- [X] T015 [P] [US2] Write unit tests for `estimateTaskDuration()` in plugins-external/sessions-plugin/durationEstimation.test.ts: medium 4-measure phrase with defaults (loop=10, minResult=90) → ~798s, easy phrase → ~479s, hard phrase → ~1197s, varied loopCounts, varied minResults, edge case loopCount=1
- [X] T016 [P] [US2] Write unit tests for difficulty multiplier mapping in plugins-external/sessions-plugin/durationEstimation.test.ts: Easy→0.6, Medium→1.0, Hard→1.5

### Implementation for User Story 2

- [X] T017 [US2] Create `plugins-external/sessions-plugin/durationEstimation.ts` with constants `BASE_SECS_PER_MEASURE = 210`, difficulty multipliers `{1: 0.6, 2: 1.0, 3: 1.5}`, loop formula `0.3 + 0.7 × (loopCount / 10)`, result formula `0.5 + 0.5 × (minResult / 100)`
- [X] T018 [US2] Implement `estimateTaskDuration(numMeasures: number, loopCount: number, difficulty: DifficultyLevel, minResult: number): number` in plugins-external/sessions-plugin/durationEstimation.ts
- [X] T019 [US2] Verify all duration estimation tests pass: `npm test -- --filter durationEstimation`

**Checkpoint**: Duration estimation module ready — US1 can use it to compute `estimatedDurationSecs` for each task.

---

## Phase 4: User Story 1 — Goal Creates Tasks for Every Phrase (Priority: P1) 🎯 MVP

**Goal**: When a score play goal is created, 3 tasks per phrase (RH, LH, BH) are generated for piano scores, or 1 task per phrase (BH) for single-staff scores. Each task has difficulty and estimatedDurationSecs.

**Independent Test**: Create a goal for a known two-staff score with at least 3 detected phrases. Verify 9 tasks are generated (3 phrases × 3 hands) with correct measure ranges, staff indices, difficulty ratings, and positive estimated durations.

### Tests for User Story 1

- [X] T020 [P] [US1] Write unit tests in plugins-external/sessions-plugin/goalEngine.test.ts: two-staff score with 4 phrases → 12 tasks (3 per phrase), correct staffIndex per task (0=RH, 1=LH, -1=BH), correct measure ranges per phrase *(⚠️ Regression gap — does not cover silent-staff scenario; see T083)*
- [X] T021 [P] [US1] Write unit tests in plugins-external/sessions-plugin/goalEngine.test.ts: single-staff score with 3 phrases → 3 tasks (1 BH per phrase, staffIndex -1)
- [X] T022 [P] [US1] Write unit tests in plugins-external/sessions-plugin/goalEngine.test.ts: every task has difficulty (1|2|3) and estimatedDurationSecs > 0
- [X] T023 [P] [US1] Write unit tests in plugins-external/sessions-plugin/goalEngine.test.ts: tasks ordered by phrase progression (all hand variants of phrase 1 before phrase 2)

### Implementation for User Story 1

- [X] T024 [US1] Replace `selectFirstPhrase()` with a function that iterates ALL phrases for instrument 0 in plugins-external/sessions-plugin/goalEngine.ts
- [X] T025 [US1] ⚠️ Reopened — BUG-001 Modify task generation in `createGoal()` to generate 3 tasks per phrase (RH staffIndex 0, LH staffIndex 1, BH staffIndex -1) for multi-staff scores, and 1 task (BH staffIndex -1) for single-staff scores in plugins-external/sessions-plugin/goalEngine.ts — **must also implement the silent-region guard: change `taskDefs.map(...)` to `taskDefs.flatMap(...)` and return `[]` (skip) when `getRegionDifficulty()` returns `null` for a given (phrase, staffIndex) pair (FR-017)**
- [X] T026 [US1] For each generated task, call `getRegionDifficulty(startMeasure, endMeasure, staffIndex)` to compute difficulty and `estimateTaskDuration(numMeasures, loopCount, difficulty, minResult)` to compute estimatedDurationSecs in plugins-external/sessions-plugin/goalEngine.ts
- [X] T027 [US1] Return phrase groups (array of `{ phraseIndex, tasks, totalDuration }`) from the goal engine for downstream session distribution in plugins-external/sessions-plugin/goalEngine.ts
- [X] T028 [US1] Ensure tasks within each phrase are ordered: RH, LH, BH (or just BH for single-staff) in plugins-external/sessions-plugin/goalEngine.ts
- [X] T029 [US1] Verify all goal engine tests pass: `npm test -- --filter goalEngine`

### Bugfix Tasks for BUG-001 (Silent-Region Guard)

- [X] T083 [P] [US1] Write regression test in plugins-external/sessions-plugin/goalEngine.test.ts: two-staff score where `getRegionDifficulty()` returns `null` for staffIndex 1 (LH) in phrase 2 → verify phrase 2 produces only 2 tasks (RH + BH, no LH task), and total task count for 4 phrases is 11 (not 12)
- [X] T084 [US1] Fix `createGoal()` in plugins-external/sessions-plugin/goalEngine.ts: change `taskDefs.map(...)` to `taskDefs.flatMap(...)` in the phrase task loop; return `[]` (skip) when `getRegionDifficulty()` returns `null` for a given (phrase, staffIndex) pair — implements FR-017
- [X] T085 [US3] Update `PhraseGroup` handling in plugins-external/sessions-plugin/sessionDistribution.ts to support phrase groups with fewer than 3 tasks (e.g., 1 or 2 tasks when one or both individual-hand staves are silent); ensure `distributeTasks()` and the atomic-unit guarantee (FR-008/FR-015) still hold for variable-size groups
- [X] T086 [US1] Verify T083 regression test fails before T084 fix, passes after fix: `npm test -- --filter goalEngine`

**Checkpoint**: Goal creation generates all tasks with difficulty and duration — ready for session distribution.

**Bugfix**: 2026-06-07 — BUG-001 Reopened T025 (missing silent-region guard), flagged T020 as having a regression gap, added T083–T086 for fix and regression test.

---

## Phase 5: User Story 3 — Session Available Time and Task Accommodation (Priority: P2)

**Goal**: Tasks are distributed into time-limited sessions (default 3600s). When a session fills up, a new session is created. Phrase triplets are never split.

**Independent Test**: Distribute 12 tasks (from 4 phrase groups) with known durations into sessions with availableTime=1800s. Verify multiple sessions created, no session exceeds budget (except first phrase group per session), all phrase groups intact.

### Tests for User Story 3

- [X] T030 [P] [US3] Write unit tests for `distributeTasks()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: all tasks fit in one session when total < availableTime
- [X] T031 [P] [US3] Write unit tests for `distributeTasks()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: overflow creates multiple sessions, no session exceeds budget
- [X] T032 [P] [US3] Write unit tests for `distributeTasks()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: first phrase group always accepted even if it exceeds availableTime (FR-008)
- [X] T033 [P] [US3] Write unit tests for `distributeTasks()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: phrase triplet (RH+LH+BH) never split across sessions (FR-015)
- [X] T034 [P] [US3] Write unit tests for `distributeTasks()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: availableTime undefined or 0 means no limit — all tasks in one session

### Implementation for User Story 3

- [X] T035 [US3] Create `PhraseGroup` type `{ phraseIndex: number, tasks: SessionTask[], totalDuration: number }` in plugins-external/sessions-plugin/sessionDistribution.ts
- [X] T036 [US3] Implement `distributeTasks(phraseGroups: PhraseGroup[], availableTime: number): DistributedSession[]` using greedy first-fit algorithm per research.md Topic 3 in plugins-external/sessions-plugin/sessionDistribution.ts
- [X] T037 [US3] Each `DistributedSession` has `tasks: SessionTask[]`, `totalEstimatedDurationSecs: number`, `availableTime: number` in plugins-external/sessions-plugin/sessionDistribution.ts
- [X] T038 [US3] Verify all distribution tests pass: `npm test -- --filter sessionDistribution`

**Checkpoint**: Session distribution algorithm ready — tasks correctly binned into time-limited sessions.

---

## Phase 6: User Story 4 — Sessions Scheduled on Free Days (Priority: P2)

**Goal**: Generated sessions are scheduled on consecutive free days (days without existing sessions). Goal references multiple sessions via `sessionIds`.

**Independent Test**: Pre-populate occupied dates (April 2, April 4). Request 3 free days starting from April 2. Verify returned dates are April 3, April 5, April 6.

### Tests for User Story 4

- [X] T039 [P] [US4] Write unit tests for `findFreeDays()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: no occupied days → consecutive days starting tomorrow
- [X] T040 [P] [US4] Write unit tests for `findFreeDays()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: occupied days are skipped, newly assigned days added to occupied set
- [X] T041 [P] [US4] Write unit tests for `getOccupiedDates()` in plugins-external/sessions-plugin/sessionDistribution.test.ts: reads from session index, excludes closed sessions without targetDate

### Implementation for User Story 4

- [X] T042 [US4] Add `getOccupiedDates(): Set<string>` helper in plugins-external/sessions-plugin/sessionStorage.ts — reads session index from localStorage, returns set of targetDate strings for non-closed sessions
- [X] T043 [US4] Implement `findFreeDays(numDays: number, occupiedDates: Set<string>): string[]` per research.md Topic 4 algorithm in plugins-external/sessions-plugin/sessionDistribution.ts
- [X] T044 [US4] Verify all free-day scheduling tests pass: `npm test -- --filter sessionDistribution`

**Checkpoint**: Free-day scheduling ready — sessions can be assigned target dates.

---

## Phase 7: Integration (Goal → Sessions → Calendar)

**Purpose**: Wire up all modules in the GoalsView orchestration flow and persist sessions

- [X] T045 Update `processScoreSelection()` in plugins-external/sessions-plugin/GoalsView.tsx to: call `getRegionDifficulty()` for each phrase × staff, call `estimateTaskDuration()` for each task, call `distributeTasks()` to get session groups, call `findFreeDays()` for scheduling
- [X] T046 Add eviction warning check in plugins-external/sessions-plugin/GoalsView.tsx: if `currentSessionCount + newSessionCount > MAX_SESSIONS`, show confirm dialog with eviction impact per research.md Topic 5 (FR-016)
- [X] T047 Create and persist multiple sessions with assigned targetDates and `availableTime=3600` in plugins-external/sessions-plugin/GoalsView.tsx
- [X] T048 Set `goal.sessionIds` to array of all created session IDs in plugins-external/sessions-plugin/GoalsView.tsx
- [X] T049 Update `checkGoalCompletion()` to iterate all `sessionIds` and verify all tasks across all linked sessions are 'done' in plugins-external/sessions-plugin/goalEngine.ts (FR-013, SC-006)
- [X] T050 Write integration test in plugins-external/sessions-plugin/GoalsView.test.tsx: create a goal for a multi-phrase piano score → verify multiple sessions created, tasks distributed, sessions scheduled on free days
- [X] T051 Write integration test in plugins-external/sessions-plugin/GoalsView.test.tsx: verify eviction warning appears when session count would exceed cap
- [X] T052 Verify all GoalsView tests pass: `npm test -- --filter GoalsView`

**Checkpoint**: Full pipeline working — goal creation produces distributed, scheduled sessions.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: UI display updates and final validation

- [X] T053 [P] Display `totalEstimatedDurationSecs` on session cards in plugins-external/sessions-plugin/SessionsPlugin.tsx (SC-005, FR-012)
- [X] T054 [P] Display remaining available time (`availableTime - totalEstimatedDurationSecs`) on session cards in plugins-external/sessions-plugin/SessionsPlugin.tsx (FR-012)
- [X] T055 [P] Display task difficulty badge (Easy/Medium/Hard) on task items in plugins-external/sessions-plugin/SessionsPlugin.tsx
- [X] T056 [P] Show session target dates on CalendarView in plugins-external/sessions-plugin/CalendarView.tsx
- [X] T057 Run full test suite: `cargo test` (Rust) + `cd frontend && npm test` (TypeScript) — verify zero regressions
- [X] T058 Run quickstart.md smoke test: build WASM, build app, create a goal for Burgmuller Arabesque, verify multi-phrase tasks, session distribution, free-day scheduling

---

## Phase 9: Cleanup & UX Polish

**Purpose**: Remove debug artifacts, dead CSS, and improve TaskBuilder usability

- [X] T059 [P] Remove temporary `console.log` debug statement from plugins-external/sessions-plugin/TaskRow.tsx (line 74: `[TaskRow] task: ...`)
- [X] T060 [P] Remove temporary `console.log` debug statement from frontend/src/services/wasm/music-engine.ts (line 138: `[WASM] compute_region_difficulty result: ...`)
- [X] T061 [P] Remove temporary `console.log` debug statement from frontend/src/plugin-api/scorePlayerContext.ts (line 566: `[scorePlayer] getRegionDifficulty: ...`)
- [X] T062 [P] Remove dead CSS class `.sessions-plugin__task-builder-row` and unused `flex: 1` from `.sessions-plugin__task-add-btn` in plugins-external/sessions-plugin/SessionsPlugin.css
- [X] T063 Move TaskBuilder reset button from bottom (next to "+ Add Task") to header top-right for reachability with many tasks — update `.sessions-plugin__task-builder-header` to flex layout in plugins-external/sessions-plugin/TaskBuilder.tsx and SessionsPlugin.css
- [X] T064 Add inline SessionsGuide overlay component (plugins-external/sessions-plugin/SessionsGuide.tsx) with Quick Start, Goals, Sessions, Tasks, Difficulty, Duration, Calendar, Tips sections — wired to "?" help button in toolbar
- [X] T065 Show task difficulty badge in practice view toolbar after "Session Task N" label in frontend/plugins/practice-view-plugin/practiceToolbar.tsx
- [X] T066 Limit play-score goal available time to 50% of total session time (1800s of 3600s) in plugins-external/sessions-plugin/GoalsView.tsx
- [X] T067 Show total session time (⏱ 60 min) in sessions toolbar in plugins-external/sessions-plugin/SessionsPlugin.tsx
- [X] T068 Adjust duration and meta font size to 0.85rem to match task title in plugins-external/sessions-plugin/SessionsPlugin.css

**Checkpoint**: All debug artifacts removed, UX improvements applied, code production-ready.

---

## Phase 10: Session UX — Duration, Editing, Reopen & Difficulty

**Purpose**: Session creation UX (duration sliders, budget bar, validation), session editing (add/remove tasks), reopen closed sessions, and manual task difficulty computation

- [X] T069 Add duration sliders (session default 60 min, task default 5 min) with snap-to-10 on mouseup/touchend and max 120 min to TaskBuilder in plugins-external/sessions-plugin/TaskBuilder.tsx and SessionsPlugin.css
- [X] T070 Add time budget bar showing busy/free time in TaskBuilder; block task add if insufficient free time; disable Create button when over budget in plugins-external/sessions-plugin/TaskBuilder.tsx and SessionsPlugin.css
- [X] T071 Fix blue focus/hover ring on all buttons and tab bar in plugins-external/sessions-plugin/SessionsPlugin.css (global `button:focus { outline: none }` + `button:focus-visible` rule)
- [X] T072 Add per-field error highlighting with `ERROR_FIELD_MAP` and inline error messages under specific fields in plugins-external/sessions-plugin/TaskBuilder.tsx and SessionsPlugin.css
- [X] T073 Remove total session time display (⏱ 60 min) from sessions toolbar in plugins-external/sessions-plugin/SessionsPlugin.tsx and SessionsPlugin.css
- [X] T074 Change help button icon from `?` to `📖` and push to right side of toolbar with `margin-left: auto` in plugins-external/sessions-plugin/SessionsPlugin.tsx and SessionsPlugin.css
- [X] T075 Add `addTaskToSession` and `removeTaskFromSession` to `useSessionManager` hook with guards (no remove for goal-linked or tasks with linkedPractices) in plugins-external/sessions-plugin/useSessionManager.ts
- [X] T076 Build session edit mode UI: toggle button, per-task remove buttons, "+ Add Task" flow with `availableTimeSecs` and `existingBusySecs` props on TaskBuilder in plugins-external/sessions-plugin/SessionsPlugin.tsx and SessionsPlugin.css
- [X] T077 Move Edit button from progress bar row into session header row before delete button in plugins-external/sessions-plugin/SessionsPlugin.tsx
- [X] T078 Limit goal available time to 50% of total session time (1800s); store `availableTime: totalSessionTime` (3600s full budget) for manual tasks in plugins-external/sessions-plugin/GoalsView.tsx
- [X] T079 Add `reopenSession(id)` to `useSessionManager` hook: set closed session back to active if no other session is active in plugins-external/sessions-plugin/useSessionManager.ts
- [X] T080 Add "▶ Reopen" button on closed sessions when no active session exists in plugins-external/sessions-plugin/SessionsPlugin.tsx and SessionsPlugin.css
- [X] T081 Add `getRegionDifficultyForScore(catalogueId, startMeasure, endMeasure, staffIndex)` async method to plugin API that loads a catalogue score ad-hoc (no React state change) and computes difficulty in frontend/src/plugin-api/types.ts and frontend/src/plugin-api/scorePlayerContext.ts
- [X] T082 Compute difficulty for manually-created tasks in `handleCreate` (async) using `getRegionDifficultyForScore` for both `measures` and `all` region types in plugins-external/sessions-plugin/TaskBuilder.tsx

**Checkpoint**: Session creation fully polished with duration controls, budget management, editing, reopen, and automatic difficulty for manual tasks.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 type changes — BLOCKS all user stories
- **Phase 3 (US2 — Duration)**: Depends on Phase 2 (needs `DifficultyLevel` type from Setup + region difficulty for testing context)
- **Phase 4 (US1 — Multi-phrase)**: Depends on Phase 2 (WASM region difficulty) + Phase 3 (duration estimation)
- **Phase 5 (US3 — Distribution)**: Depends on Phase 4 (needs phrase groups with tasks)
- **Phase 6 (US4 — Scheduling)**: Can start in parallel with Phase 5 (`findFreeDays` is independent); integrates in Phase 7
- **Phase 7 (Integration)**: Depends on Phases 4, 5, and 6
- **Phase 8 (Polish)**: Depends on Phase 7

### User Story Dependencies

```
Phase 1 (Setup) ─────────────► Phase 2 (Foundational: Rust WASM)
                                        │
                                        ▼
                                Phase 3 (US2: Duration Estimation)
                                        │
                                        ▼
                                Phase 4 (US1: Multi-phrase Tasks) ◄── 🎯 MVP
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                   Phase 5 (US3: Distribution)  Phase 6 (US4: Scheduling) ← [P] parallel
                              │                   │
                              └─────────┬─────────┘
                                        ▼
                                Phase 7 (Integration)
                                        │
                                        ▼
                                Phase 8 (Polish)
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle V)
- Pure functions before orchestration
- Core logic before UI integration

### Parallel Opportunities

**Phase 2**: T007 and T012 can be developed in parallel (Rust refactor + TypeScript interface)
**Phase 3**: T015 and T016 (tests) can run in parallel
**Phase 4**: T020, T021, T022, T023 (tests) can all run in parallel  
**Bugfix Wave (Phase 4 patch — BUG-001)**: T083 (regression test, `[P]`) can be written in parallel with T020–T023; T084 + T085 can run in parallel after T083; T086 runs last (depends on T083 + T084)
**Phase 5**: T030–T034 (tests) can all run in parallel
**Phase 6**: T039–T041 (tests) can all run in parallel; **Phase 6 itself can run in parallel with Phase 5**
**Phase 8**: T053, T054, T055, T056 (UI tasks) can all run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (type changes)
2. Complete Phase 2: Foundational (Rust WASM region difficulty)
3. Complete Phase 3: US2 (duration estimation)
4. Complete Phase 4: US1 (multi-phrase task generation)
5. **STOP and VALIDATE**: Create a goal and verify tasks have difficulty + duration
6. Deploy/demo if ready — tasks exist but go into a single session

### Incremental Delivery

1. Setup + Foundational → Types and WASM ready
2. Add US2 (Duration) + US1 (Multi-phrase) → MVP: all tasks generated with estimates
3. Add US3 (Distribution) + US4 (Scheduling) → Full: tasks distributed into time-limited, scheduled sessions
4. Integration + Polish → Production-ready with UI display and eviction warnings
