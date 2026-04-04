# Tasks: Warm-Up Goal Tasks for Sessions

**Input**: Design documents from `/specs/071-warmup-goal-tasks/`
**Feature Branch**: `071-warmup-goal-tasks`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/warm-up-task-launch-v1.md ✓, quickstart.md ✓

**Tests**: Included — mandated by Constitution Principle V (Test-First Development is NON-NEGOTIABLE, confirmed in plan.md Phase 2 Constitution Check). Tests must be written before implementation and must fail before the corresponding code is written.

**Organization**: Tasks grouped by user story (US1–US4) for independent implementation and testing. All file paths from repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unsatisfied dependencies)
- **[Story]**: User story label (US1–US4, maps to spec.md priorities P1–P4)
- Foundational and Setup phases have no story label

---

## Phase 1: Setup

**Purpose**: Baseline verification before any changes are made

- [X] T001 Verify existing test suite passes by running `pnpm test` in `plugins-external/sessions-plugin/` and recording the baseline pass count (10 files, 264 tests)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type extensions and pure engine functions that ALL user stories depend on. No UI work; no side effects.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend `ScoreRef.type` union with `'warmup-scale'` in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T003 [P] Extend `GoalType` union with `'warm-up-scales'` and add optional fields `warmUpScaleId?: string` and `warmUpSessionCount?: number` to the `Goal` interface in `plugins-external/sessions-plugin/goalTypes.ts`
- [X] T004 [P] Add `WarmUpGoalCreationFormParams` interface and `WarmUpTaskConfig` interface to `plugins-external/sessions-plugin/goalTypes.ts` per `specs/071-warmup-goal-tasks/data-model.md`
- [X] T005 [P] Write 5 failing tests for `createWarmUpGoal()` covering: creates goal with `type: 'warm-up-scales'`, creates task with `scoreRef.type: 'warmup-scale'`, sets `estimatedDurationSecs = 300`, populates `warmUpScaleId` from input, populates `warmUpSessionCount` from input in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T006 Implement `createWarmUpGoal(input: CreateWarmUpGoalInput): CreateWarmUpGoalResult` pure function in `plugins-external/sessions-plugin/goalEngine.ts` — all T005 tests must pass
- [X] T007 [P] Write 6 failing tests for `insertWarmUpTaskIntoSessions()` covering: injects task into sessions with sufficient free time, skips sessions with insufficient free time, respects maxCount limit, sorts sessions by targetDate ascending before selecting, prepends task at index 0 of session.tasks, treats availableTime = 0 as unlimited in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T008 Implement `insertWarmUpTaskIntoSessions(taskTemplate, sessions, maxCount, warmUpDurationSecs): Array<{ session: Session; task: SessionTask }>` pure function in `plugins-external/sessions-plugin/goalEngine.ts` — all T007 tests must pass

**Checkpoint**: Foundation ready — all engine tests pass; user story implementation can now begin

---

## Phase 3: User Story 1 — Create a Warm-Up Scale Goal (Priority: P1) 🎯 MVP

**Goal**: User opens Goals tab, selects "Warm-Up Tasks" goal type, configures a scale and session count, submits — the goal appears in the goal list, warm-up tasks are prepended to existing sessions with free time, and tapping a task opens the Train view with scale and tempo pre-set.

**Independent Test**: Create a warm-up goal using default settings (C Major, 100% tempo, 5 sessions target). Verify: goal appears in the goal list with status "active"; up to 5 existing sessions each contain a warm-up scale task as their first item; tapping a warm-up task calls `openPlugin('train-view', { warmUpTaskConfig })` with the correct `scaleId` and `tempoMultiplier`.

### Tests for User Story 1 — write BEFORE implementation, ensure they FAIL first

- [X] T009 [P] [US1] Write 4 failing RTL tests for `WarmUpGoalCreationForm`: renders scale dropdown defaulting to C Major, renders sessions count input defaulting to 5, calls `onSubmit` with correct `WarmUpGoalCreationFormParams` shape on submit, renders a cancel button in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.test.tsx`
- [X] T010 [P] [US1] Write 3 failing RTL tests for `GoalsView` warm-up branch: goal-type selector renders with "Warm-Up Tasks" option, `WarmUpGoalCreationForm` renders when warm-up-scales is selected, `handleWarmUpGoalSubmit` calls `insertWarmUpTaskIntoSessions` and persists goal to IndexedDB on submit in `plugins-external/sessions-plugin/GoalsView.test.tsx`
- [X] T011 [P] [US1] Write 2 failing unit tests for `TaskRow`: `handlePractice()` calls `context.openPlugin('train-view', { warmUpTaskConfig })` for a task with `scoreRef.type === 'warmup-scale'`, score-unavailable warning is not shown for warmup-scale tasks in `plugins-external/sessions-plugin/TaskRow.test.tsx`

### Implementation for User Story 1

- [ ] T012 [US1] Create `WarmUpGoalCreationForm.tsx` with: scale dropdown importing all 24 scales from `SCALE_OPTIONS` in `frontend/plugins/train-view/exerciseGenerator.ts` defaulting to C Major, sessions count integer input defaulting to 5, submit and cancel buttons in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`
- [X] T012 [US1] Create `WarmUpGoalCreationForm.tsx` with: scale dropdown importing all 24 scales from `SCALE_OPTIONS` in `frontend/plugins/train-view/exerciseGenerator.ts` defaulting to C Major, sessions count integer input defaulting to 5, submit and cancel buttons in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`
- [X] T013 [US1] Add goal-type selector to `GoalsView.tsx` ("Play Score" / "Warm-Up Tasks") and conditionally render `WarmUpGoalCreationForm` when goal type is `'warm-up-scales'` in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T014 [US1] Implement `handleWarmUpGoalSubmit()` in `GoalsView.tsx`: call `createWarmUpGoal()`, load all sessions from IndexedDB, call `insertWarmUpTaskIntoSessions()`, persist each modified session via `saveSessionToIndexedDB` and update session index, save goal with populated `sessionIds` and `taskIds` in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T015 [US1] Add warmup-scale launch branch in `TaskRow.tsx` `handlePractice()`: call `context.openPlugin('train-view', { warmUpTaskConfig: { taskId, sessionId, sessionName, scaleId: task.scoreRef.id, tempoMultiplier, loopCount, minResult } })` per `specs/071-warmup-goal-tasks/contracts/warm-up-task-launch-v1.md` in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T016 [US1] Update the main train-view plugin component to read `warmUpTaskConfig` from `context.getNavigationData()` on mount and pre-set scale selector and tempo state when payload is present in `frontend/plugins/train-view/` (locate main entry component via `frontend/plugins/train-view/plugin.json`)

**Checkpoint**: US1 is fully functional — warm-up goal creation works end-to-end; tapping a warm-up task opens Train view with correct scale and tempo pre-set

---

## Phase 4: User Story 2 — Scale Selector and Tempo Configuration (Priority: P2)

**Goal**: The scale dropdown lists all 24 scales in circle-of-fifths order identical to the Train view. The tempo slider (50%–200%, step 5%) visually matches the Train view toolbar tempo slider component. Selecting any scale and moving the slider is reflected correctly in the saved goal.

**Independent Test**: Open the warm-up goal creation form; confirm scale dropdown contains exactly 24 entries in the same order as `SCALE_OPTIONS` from `exerciseGenerator.ts`; confirm tempo slider accepts values from 50% to 200% and the saved goal's `tempoMultiplier` reflects the slider's value.

### Tests for User Story 2

- [X] T017 [P] [US2] Write 3 failing RTL tests for `WarmUpGoalCreationForm`: scale dropdown renders exactly 24 options matching `SCALE_OPTIONS` order by index, selecting a non-default scale updates the submitted `scaleId`, tempo slider emits values in the 0.5–2.0 range in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.test.tsx`

### Implementation for User Story 2

- [X] T018 [US2] Verify `WarmUpGoalCreationForm.tsx` maps `SCALE_OPTIONS` array directly (no re-sorting) for the scale dropdown options; add `data-testid` attributes to each scale option for test selection in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`
- [X] T019 [US2] Implement tempo slider in `WarmUpGoalCreationForm.tsx` using the same slider component or CSS class as the Train view toolbar tempo slider (range 50%–200%, step 5%, displays current percentage value) in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`

**Checkpoint**: Scale selector and tempo slider pass visual and behavioral parity checks with the Train view

---

## Phase 5: User Story 3 — Session Distribution of Warm-Up Tasks (Priority: P3)

**Goal**: Warm-up tasks are inserted only into existing sessions with ≥300 s of free time, up to the configured session count, in target-date ascending order. Sessions without sufficient free time are skipped. No new sessions are created. The form shows a warning when no sessions are available.

**Independent Test**: With 5 existing sessions (3 with sufficient free time, 2 without), create a warm-up goal with session count = 3. Verify: exactly 3 sessions (those with free time) have the warm-up task as their first task; the 2 sessions without free time are unchanged; no new sessions have been created.

### Tests for User Story 3

- [X] T020 [P] [US3] Write 4 failing RTL/integration tests for `GoalsView` distribution behavior: sessions count input caps injection to configured value, sessions where `availableTime - usedTime < 300` are skipped, warm-up task is at index 0 of modified session's task list, no new sessions are created on submit in `plugins-external/sessions-plugin/GoalsView.test.tsx`

### Implementation for User Story 3

- [X] T021 [US3] Verify `handleWarmUpGoalSubmit()` in `GoalsView.tsx` passes `params.sessionCount` as `maxCount` to `insertWarmUpTaskIntoSessions()` and does not invoke `findFreeDays()` or `distributeTasks()` for warm-up goals in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T022 [P] [US3] Add post-submit informational message in `GoalsView.tsx`: when `insertWarmUpTaskIntoSessions()` returns fewer sessions than requested, display "Warm-up added to N of M requested sessions" in the goal confirmation state in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T023 [P] [US3] Add zero-sessions guard to `WarmUpGoalCreationForm.tsx`: when `existingSessionCount` prop is 0, display "No scheduled sessions available for warm-up tasks" message and disable the submit button in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`

**Checkpoint**: Session distribution behavior matches FR-010 and FR-013 exactly — skipping, ordering, and count-capping all verified

---

## Phase 6: User Story 4 — Iterations and Min Score on Warm-Up Goals (Priority: P4)

**Goal**: Users configure iterations (how many times the scale must be played) and minimum score (accuracy threshold) on the warm-up goal form. When the user completes a warm-up exercise in Train view, the result is fed back to sessions-plugin, which marks the task done when both criteria are met. The goal auto-completes when all its targeted tasks are done.

**Independent Test**: Create a warm-up goal with iterations = 3, min score = 85%. Feed 2 completion callbacks from train-view (result = 90%). Verify task status is still "in progress" (only 2 of 3 required). After a 3rd callback at 90%, verify task status = "done" and goal status = "completed".

### Tests for User Story 4

- [X] T024 [P] [US4] Write 2 failing RTL tests for `WarmUpGoalCreationForm`: iterations slider renders with default 10 and range 1–20, min score slider renders with default 90 and range 0–100 in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.test.tsx`
- [X] T025 [P] [US4] Write 3 failing tests for completion callback handling: receiving `completedWarmUpTask` nav data appends a `linkedPractice` entry to the task, task status becomes "done" only after required iterations are met, `checkGoalCompletionAcrossSessions()` is called and goal status updates to "completed" when all tasks are done in `plugins-external/sessions-plugin/GoalsView.test.tsx`

### Implementation for User Story 4

- [X] T026 [US4] Add iterations slider (default 10, range 1–20) and min score slider (default 90, range 0–100) to `WarmUpGoalCreationForm.tsx` in `plugins-external/sessions-plugin/WarmUpGoalCreationForm.tsx`
- [X] T027 [US4] Update the train-view main component to call `context.openPlugin('sessions-plugin', { completedWarmUpTask: { taskId, sessionId, result, completedAt: Date.now() } })` on exercise completion when a `warmUpTaskConfig` was received from nav data in `frontend/plugins/train-view/` (main plugin component)
- [X] T028 [US4] Handle `completedWarmUpTask` nav data in `GoalsView.tsx` on plugin mount: load session from IndexedDB by `sessionId`, find task by `taskId`, append `linkedPractice` entry `{ id, ts, result }`, save updated session, call `checkGoalCompletionAcrossSessions()` for the task's `goalId`, update goal status to `"completed"` if the function returns `"completed"` in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T029 [US4] Write integration test simulating full completion flow: create warm-up goal with 1 session → receive `completedWarmUpTask` callback sufficient times to meet iterations + minResult → verify goal status transitions to `"completed"` in `plugins-external/sessions-plugin/goalEngine.test.ts`

**Checkpoint**: Completion criteria (iterations, min score) are enforced; goal auto-completes when all sessions' warm-up tasks are marked done

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression verification and cleanup across all stories

- [X] T030 [P] Run full `pnpm test` in `plugins-external/sessions-plugin/` and verify all pre-existing tests (baseline from T001) still pass alongside the new test suite
- [X] T031 [P] Run `pnpm test` in `frontend/` to verify train-view changes (T016, T027) have not broken any existing train-view tests
- [ ] T032 Run quickstart.md manual validation: exercise all 4 acceptance scenarios from spec.md User Story 1 in a local dev environment and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 completion — ⭐ MVP
- **Phase 4 (US2)**: Depends on Phase 3 (requires `WarmUpGoalCreationForm.tsx` to exist) — can run concurrently with Phase 5 and Phase 6 after Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 (requires `GoalsView.tsx` warm-up integration)
- **Phase 6 (US4)**: Depends on Phase 3 (requires `TaskRow.tsx` warmup-scale launch branch and T016 train-view read)
- **Phase 7 (Polish)**: Depends on all desired user story phases

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — no dependency on US2/US3/US4
- **US2 (P2)**: Depends on US1 — independently testable once form exists
- **US3 (P3)**: Depends on US1 — independently testable once GoalsView integration exists
- **US4 (P4)**: Depends on US1 and US3 (needs warm-up tasks in sessions to complete them)

### Within Each Phase

- Tests MUST be written first and MUST FAIL before implementation begins
- Type changes (T002–T004) before engine functions (T005–T008)
- Engine functions (T006, T008) before any UI work (Phase 3+)
- Form creation (T012) before GoalsView integration (T013–T014)
- GoalsView integration (T014) before TaskRow launch (T015) before train-view read (T016)

---

## Parallel Execution

### Phase 2 Parallel Opportunities

```
T002 (sessionTypes.ts)
T003 (goalTypes.ts — GoalType + Goal)    ← parallel with T002 and T004
T004 (goalTypes.ts — new interfaces)     ← parallel with T002 and T003
T005 (tests: createWarmUpGoal)           ← parallel with T002/T003/T004
T007 (tests: insertWarmUpTaskIntoSessions) ← parallel with T005
```

### Phase 3 — Write all tests first, in parallel

```
T009 (WarmUpGoalCreationForm.test.tsx)   ← parallel
T010 (GoalsView.test.tsx)                ← parallel
T011 (TaskRow.test.tsx)                  ← parallel
```

Then implement sequentially: T012 → T013 → T014 → T015 → T016

### Phases 4–6 — Can run in parallel after Phase 3

```
Dev A: US2 → T017 → T018 → T019
Dev B: US3 → T020 → T021 → T022 → T023
Dev C: US4 → T024 → T025 → T026 → T027 → T028 → T029
```

### Phase 7 Parallel

```
T030 (sessions-plugin test suite)        ← parallel
T031 (frontend test suite)               ← parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T008) — cannot skip
3. Complete Phase 3: User Story 1 (T009–T016)
4. **STOP and VALIDATE**: End-to-end warm-up goal creation → sessions populated → Train view opens correctly
5. Demo / review before continuing to US2–US4

### Incremental Delivery

1. Phase 1 + Phase 2 → Tested engine functions, extended types
2. Phase 3 (US1) → **MVP**: complete creation flow, Train view launch
3. Phase 4 (US2) → Full scale selector fidelity and styled tempo slider
4. Phase 5 (US3) → Robust distribution with edge-case handling and UI feedback
5. Phase 6 (US4) → Completion criteria + goal auto-complete via train-view callback

Each phase is independently releasable without breaking prior phases.

---

## Notes

- **[P] tasks** operate on different files — safe to parallelize, no merge conflicts
- **TDD**: Every test task must FAIL before its corresponding implementation task is started (Constitution Principle V)
- **`SCALE_OPTIONS` import path**: verify the exact relative import path from `plugins-external/sessions-plugin/` to `frontend/plugins/train-view/exerciseGenerator.ts` before implementing T012 — the monorepo structure may use path aliases
- **`WarmUpTaskConfig` type**: define once in `goalTypes.ts` and import it in both `TaskRow.tsx` (sender) and the train-view component (receiver) to avoid type duplication
- **Task count per user story**: Foundational (7) | US1 (8) | US2 (3) | US3 (4) | US4 (6) | Polish (3) | Setup (1) = **32 tasks total**
- **Estimated new tests**: ~25 (5 + 6 engine + 4 + 3 + 2 form/view/row + 3 + 4 + 2 + 3 + 1 integration)
