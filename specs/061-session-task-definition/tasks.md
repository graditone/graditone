# Tasks: Tasks-Based Session Definition

**Input**: Design documents from `/specs/061-session-task-definition/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US5) — omitted for setup/foundational/polish phases
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Type definitions and pure logic before any UI work

- [X] T001 Add `TaskStatus`, `TaskLinkedPractice`, and `SessionTask` types to `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T002 Extend `Session` interface with `tasks: SessionTask[]` field in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T003 Extend `SessionActivity` interface with optional `taskId?: string` field in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T004 Extend `SessionIndexEntry` interface with `taskCount: number` field in `plugins-external/sessions-plugin/sessionTypes.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Task status engine, plugin API extension, and storage layer — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

> **TDD Note**: Each implementation/test pair in this phase follows Red-Green-Refactor: write the failing test first (Red), then implement the function to make it pass (Green).

- [X] T005 Create unit tests for `computeTaskStatus` covering all transitions (todo→in-progress→done, todo→in-progress→failed, failed→in-progress retry with round increment) in `plugins-external/sessions-plugin/taskStatusEngine.test.ts` — tests will fail (Red)
- [X] T006 Create `TaskStatusEngine.ts` with `computeTaskStatus(task): TaskStatus` pure function in `plugins-external/sessions-plugin/TaskStatusEngine.ts` — tests pass (Green)
- [X] T007 Add `taskId?: string` to `PracticeSavedEvent` interface in `frontend/src/plugin-api/types.ts`
- [X] T008 Add unit tests for `validateSessionTask` covering all validation rules (missing score, invalid measure range, out-of-range tempo/minResult/loopCount) in `plugins-external/sessions-plugin/taskStatusEngine.test.ts` — tests will fail (Red)
- [X] T009 Add task validation function `validateSessionTask(task): string[]` (returns error messages) in `plugins-external/sessions-plugin/TaskStatusEngine.ts` — tests pass (Green)
- [X] T010 Extend `addActivityToActiveSession()` to accept optional `taskId` from `PracticeSavedEvent` and set it on the created `SessionActivity` in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T011 Add `loadTasksFromLastSession(): Promise<SessionTask[] | null>` to `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T012 Extend `computeProtectedPracticeIds()` to include `savedPracticeId` values from `task.linkedPractices[]` in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T013 Add backward-compatibility normalization: when loading a `Session` from IndexedDB, default `tasks` to `[]` if `undefined`; when reading `SessionIndexEntry`, default `taskCount` to `0` if `undefined` in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T014 Add unit tests for backward compatibility (legacy session without tasks loads correctly, legacy index entry without taskCount normalizes to 0) in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`

**Checkpoint**: Foundation ready — types, status engine, storage, and plugin API extended. User story work can begin.

---

## Phase 3: User Story 1 — Define Tasks When Creating a Session (Priority: P1) 🎯 MVP

**Goal**: Users can define one or more tasks with full configuration when creating a new session

**Independent Test**: Create a session with multiple tasks → verify all tasks appear with correct config and "todo" status

### Implementation for User Story 1

- [X] T015 [US1] Create `TaskBuilder.tsx` component with task form (score picker trigger, region selector, hand selector, iterations input, tempo slider, min result input) and "Add Task"/"Remove Task" buttons in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T016 [US1] Integrate `context.components.ScoreSelector` into TaskBuilder for score selection (both preloaded and user-uploaded scores), capturing `ScoreRef` and `scoreTitle` in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T017 [US1] Implement default values for empty task rows (score blank, region "all", hands "both", iterations 3, tempo 100%, min result 70%) in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T017b [US1] Implement tempo display conversion in TaskBuilder: percentage slider (50%–200%) mapped to `tempoMultiplier` (0.5–2.0); when a score is selected, show derived BPM as `baseBPM × multiplier` for reference in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T018 [US1] Add session-level validation in TaskBuilder: at least one task, all tasks pass `validateSessionTask`, display validation errors per field in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T019 [US1] Replace `startSession()` with `createSessionWithTasks(tasks: SessionTask[])` in `useSessionManager` — creates a `Session` with `tasks` array and `taskCount` in index entry in `plugins-external/sessions-plugin/useSessionManager.ts`
- [X] T020 [US1] Update `SessionsPlugin.tsx` to show TaskBuilder when user taps "New Session" (instead of immediately creating an empty session), and wire "Create Session" button to `createSessionWithTasks` in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T020b [US1] Add persistence verification test: create session with tasks → simulate IndexedDB reload → assert all task fields (including scoreRef, tempoMultiplier, linkedPractices) are intact with zero data loss in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`
- [X] T021 [US1] Add task builder CSS styles (form layout, task rows, add/remove buttons, validation error highlights) in `plugins-external/sessions-plugin/SessionsPlugin.css`

**Checkpoint**: User Story 1 complete — users can create sessions with defined tasks

---

## Phase 4: User Story 3 — Launch Task Practice from Active Session (Priority: P1)

**Goal**: Each task's "Practice" link opens the practice view pre-configured with the task's settings; saved practices link back to the task

**Independent Test**: Create session with a task → tap Practice link → verify practice view opens with correct score/region/hand/tempo/iterations → save practice → verify practice linked to task and session

### Implementation for User Story 3

- [X] T022 [US3] Create `TaskRow.tsx` component displaying task config summary (score title, region, hand, tempo, iterations, min result), status badge, and "Practice" link button in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T023 [US3] Implement practice launch in `TaskRow.tsx`: build `TaskPracticeNavData` from task config and call `context.openPlugin('practice-view-plugin', { taskConfig: {...} })` in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T024 [US3] Disable "Practice" link on tasks with status "done" or when the session is closed in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T025 [US3] Extend `usePracticeLoop` hook to accept optional `initialStartTick` and `initialEndTick` parameters for programmatic loop region setup on mount in `frontend/plugins/practice-view-plugin/usePracticeLoop.ts`
- [X] T026 [US3] Add `navData.taskConfig` handling in `PracticeViewPlugin.tsx` mount effect: load score via `scoreRef`, set `staffIndex`, `tempoMultiplier`, `loopCount`, and compute loop region from `startMeasure`/`endMeasure` using `measure_end_ticks` after score loads in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T027 [US3] Create measure-to-tick utility function `measureRangeToTicks(startMeasure, endMeasure, measureEndTicks): { startTick, endTick }` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T028 [US3] Store `taskId` from `navData.taskConfig` in a ref and include it in the `broadcastPracticeSaved()` call in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T029 [US3] Wire task list display in `SessionsPlugin.tsx`: render `TaskRow` for each task in active and expanded closed sessions in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T030 [US3] Add task row CSS styles (config summary layout, status badges, practice link button, disabled state) in `plugins-external/sessions-plugin/SessionsPlugin.css`

**Checkpoint**: User Story 3 complete — users can launch pre-configured practice from tasks and practices link back

---

## Phase 5: User Story 2 — Inherit Task Structure from Previous Session (Priority: P2)

**Goal**: New sessions pre-populate the task builder with task definitions from the most recent session

**Independent Test**: Create session with tasks → close it → tap "New Session" → verify task builder pre-populated with previous session's task definitions

### Implementation for User Story 2

- [X] T031 [US2] Call `loadTasksFromLastSession()` when TaskBuilder mounts and pre-populate the task form with inherited definitions (stripping status, linkedPractices, currentRound) in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T032 [US2] Show empty single-task row when no previous session exists (fall back to defaults) in `plugins-external/sessions-plugin/TaskBuilder.tsx`
- [X] T033 [US2] Mark inherited tasks referencing unavailable scores with a warning indicator in `plugins-external/sessions-plugin/TaskBuilder.tsx`

**Checkpoint**: User Story 2 complete — task inheritance streamlines repeated session creation

---

## Phase 6: User Story 4 — Track Task Status Based on Practice Results (Priority: P2)

**Goal**: Task status transitions automatically (todo→in-progress→done/failed) when practices are saved; failed tasks allow retry

**Independent Test**: Create session with task (min result 70%, 3 iterations) → complete practices with varying scores → verify status transitions correctly

### Implementation for User Story 4

- [X] T034 [US4] Add `linkPracticeToTask()` function in `sessionStorage.ts`: receives `PracticeSavedEvent` with `taskId`, appends `TaskLinkedPractice` to the task, calls `computeTaskStatus`, persists updated session in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T035 [US4] Extend `addActivityToActiveSession()` (see also T010 for taskId param) to call `linkPracticeToTask()` when `event.taskId` is present in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T036 [US4] Implement retry logic in `TaskRow.tsx`: when user taps "Practice" on a failed task, increment `currentRound` on the task and reset status to "in-progress" before launching practice in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T037 [US4] Update `TaskRow.tsx` to show visual status indicators: checkmark for "done" with achieving score, X for "failed", spinner/progress for "in-progress", empty circle for "todo" in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T038 [US4] Refresh task statuses in `SessionsPlugin.tsx` when sessions data changes (reload expanded session data to pick up new linked practices and status changes) in `plugins-external/sessions-plugin/SessionsPlugin.tsx`

**Checkpoint**: User Story 4 complete — task statuses reflect practice results automatically

---

## Phase 7: User Story 5 — View Session Progress Overview (Priority: P3)

**Goal**: Sessions display a progress summary and expandable task details with linked practices

**Independent Test**: Create session with tasks in mixed statuses → verify progress summary ("2 of 5 completed") and expandable practice details

### Implementation for User Story 5

- [X] T039 [US5] Add progress summary bar to session view showing "X of Y tasks completed" (count of "done" tasks / total tasks) in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T040 [US5] Implement expandable task detail in `TaskRow.tsx`: toggle to show linked practices list with scores, timestamps, completion status, and round number in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T041 [US5] Add closed-session visual styling to TaskRow (greyed-out appearance, no hover effects) — practice link disabling already handled by T024 in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T042 [US5] Add progress bar and expandable detail CSS styles (progress indicator, practice list layout, closed-session styling) in `plugins-external/sessions-plugin/SessionsPlugin.css`

**Checkpoint**: User Story 5 complete — full session progress visibility

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, documentation, and final validation

- [X] T043 [P] Add unavailable-score detection to `TaskRow.tsx`: check if `scoreRef` points to an existing score, show warning and disable practice link if not in `plugins-external/sessions-plugin/TaskRow.tsx`
- [X] T044 [P] Handle race condition: practice saved after session closed — skip task linkage, save practice as standalone, log warning in `plugins-external/sessions-plugin/sessionStorage.ts`
- [X] T045 [P] Add unit tests for task inheritance (pre-population from last session, empty when no previous session) and protected practice IDs (includes task-linked practices) in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`
- [X] T046 Run quickstart.md validation: verify dev setup, build, and test commands work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — task creation is prerequisite for all other stories
- **Phase 4 (US3)**: Depends on Phase 3 — needs tasks to exist to launch practice
- **Phase 5 (US2)**: Depends on Phase 3 — needs task builder to add inheritance
- **Phase 6 (US4)**: Depends on Phase 4 — needs practice linkage to track status
- **Phase 7 (US5)**: Depends on Phase 6 — needs status tracking for progress display
- **Phase 8 (Polish)**: Depends on all user stories complete

### User Story Dependencies

```
Phase 1 → Phase 2 → Phase 3 (US1: Define Tasks) → Phase 4 (US3: Launch Practice)
                                    ↓                        ↓
                              Phase 5 (US2: Inherit)   Phase 6 (US4: Track Status)
                                                             ↓
                                                       Phase 7 (US5: Progress)
                                                             ↓
                                                       Phase 8 (Polish)
```

- **US1 (P1)**: Blocking — must complete before US2, US3
- **US3 (P1)**: Depends on US1 — must complete before US4
- **US2 (P2)**: Depends on US1 — can run in parallel with US3
- **US4 (P2)**: Depends on US3 — must complete before US5
- **US5 (P3)**: Depends on US4

### Within Each Phase

- Tasks marked [P] can run in parallel within their phase
- Tasks without [P] should run sequentially in order listed

### Parallel Opportunities

**Within Phase 1**: T001–T004 all modify the same file (`sessionTypes.ts`) — apply sequentially

**Within Phase 2**:
- T005 + T006 (status engine + tests) → sequential
- T007 (plugin API) — independent, can parallel with T005/T006
- T008 + T009 (validation + tests) → after T005
- T010–T013 (storage extensions) → after T005
- T014 (backward compat tests) → after T013

**Phases 3 + 5 can partially overlap**: US2 (inheritance) only touches `TaskBuilder.tsx` internals — can start once T015–T017 are done

---

## Parallel Example: Phase 2 (Foundational)

```
Batch 1 (parallel):
  T005: Create TaskStatusEngine.ts with computeTaskStatus
  T007: Add taskId to PracticeSavedEvent in types.ts

Batch 2 (after T005):
  T006: Unit tests for computeTaskStatus
  T008: Add validateSessionTask to TaskStatusEngine.ts

Batch 3 (after T008):
  T009: Unit tests for validateSessionTask
  T010: Extend addActivityToActiveSession with taskId
  T011: Add loadTasksFromLastSession
  T012: Extend computeProtectedPracticeIds

Batch 4 (after T010–T012):
  T013: Add backward-compatibility normalization
  T014: Unit tests for backward compatibility
```

---

## Implementation Strategy

### MVP Scope

**User Story 1 (Phase 3)** alone delivers a viable MVP: users can create task-based sessions. The tasks appear in the session view with their configuration and "todo" status. Even without practice linking (US3), this is immediately useful as a practice planning tool.

### Incremental Delivery

1. **Phase 1–2**: Foundation (types + engine + storage) — no UI yet
2. **Phase 3 (US1)**: Task creation UI — first user-facing deliverable
3. **Phase 4 (US3)**: Practice execution — tasks become actionable
4. **Phase 5 (US2)**: Inheritance — quality-of-life for repeated sessions
5. **Phase 6 (US4)**: Status tracking — automated progress
6. **Phase 7 (US5)**: Progress overview — full visibility
7. **Phase 8**: Polish — edge cases and robustness
