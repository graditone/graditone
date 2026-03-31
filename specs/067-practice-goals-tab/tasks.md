# Tasks: Practice Goals View Tab

**Input**: Design documents from `/specs/067-practice-goals-tab/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — spec references Test-First Development (Constitution Principle V) and plan includes explicit test files.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Plugin**: `plugins-external/sessions-plugin/`
- **Frontend API**: `frontend/src/plugin-api/`
- **Frontend Storage**: `frontend/src/services/storage/`
- **Frontend Types**: `frontend/src/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: IndexedDB schema upgrade, type definitions, and plugin API extension — shared by all user stories.

- [X] T001 Bump DB_VERSION from 3 to 4 and add `goals` object store in `frontend/src/services/storage/local-storage.ts`
- [X] T002 [P] Create goal type definitions (Goal, GoalIndexEntry, GoalType, GoalStatus) in `plugins-external/sessions-plugin/goalTypes.ts`
- [X] T003 [P] Add optional `goalId` field to SessionTask, Session, and SessionIndexEntry in `plugins-external/sessions-plugin/sessionTypes.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plugin API extension and goal storage layer — MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add `getPhrases(): ReadonlyArray<PhraseRegion> | null` to `PluginScorePlayerContext` interface in `frontend/src/plugin-api/types.ts`
- [X] T005 Implement `getPhrases()` in score player context bridge in `frontend/src/plugin-api/scorePlayerContext.ts`
- [X] T006 Add contract test for `getPhrases()` in `frontend/src/plugin-api/scorePlayerContext.test.ts`
- [X] T007 Implement goal storage CRUD (saveGoal, loadGoal, deleteGoal, listGoalsIndex, updateGoalIndex, loadAllGoals, hasGoalForScore) in `plugins-external/sessions-plugin/goalStorage.ts`

**Checkpoint**: Foundation ready — plugin can access phrases, store goals, and link goals to sessions.

---

## Phase 3: User Story 1 — Create a Practice Goal from a Score (Priority: P1) 🎯 MVP

**Goal**: User selects a score in the Goals tab, system creates a goal with 3 tasks (LH, RH, TH) for the first phrase, and schedules a session for tomorrow.

**Independent Test**: Select a score → goal appears with 3 tasks → scheduled session for tomorrow visible in Sessions tab.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Unit test: first phrase selection (phrases present, no phrases fallback to 4 measures, fewer than 4 measures fallback) in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T009 [P] [US1] Unit test: task generation for multi-staff score (3 tasks: RH/LH/TH, correct staffIndex, loopCount=10, minResult=90, tempoMultiplier=1.0) in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T010 [P] [US1] Unit test: task generation for single-staff score (1 task: TH only, staffIndex=-1) in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T011 [P] [US1] Unit test: session targetDate is tomorrow (ISO 8601 date string, day after creation) in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T012 [P] [US1] Unit test: duplicate goal warning (hasGoalForScore returns true) in `plugins-external/sessions-plugin/goalEngine.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement goal engine: first phrase selection, task generation, and session creation logic in `plugins-external/sessions-plugin/goalEngine.ts`
- [X] T014 [US1] Extend `TabId` type from `'sessions' | 'calendar'` to `'sessions' | 'calendar' | 'goals'` and add Goals tab button in `plugins-external/sessions-plugin/SessionsPlugin.tsx`
- [X] T015 [US1] Create GoalsView component with "Create Goal" button, score picker overlay, goal creation flow, and goal list rendering in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T016 [US1] Add goals tab CSS styles (tab button, goal list, create button, score picker overlay) in `plugins-external/sessions-plugin/SessionsPlugin.css`
- [X] T017 [US1] Wire GoalsView into SessionsPlugin: conditional rendering when `activeTab === 'goals'`, pass context and scheduleSession in `plugins-external/sessions-plugin/SessionsPlugin.tsx`

**Checkpoint**: User can create a goal from a score, see it in the Goals tab, and find the scheduled session in the Sessions tab.

---

## Phase 4: User Story 2 — View Practice Goals and Progress (Priority: P2)

**Goal**: User sees a list of goals with progress summaries and can expand each to view individual task statuses.

**Independent Test**: Create a goal → practice a task → reopen Goals tab → progress count updated, task status reflects linked practice result.

### Tests for User Story 2

- [X] T018 [P] [US2] Component test: GoalsView renders goal list with score title and progress summary ("0/3 tasks done") in `plugins-external/sessions-plugin/GoalsView.test.tsx`
- [X] T019 [P] [US2] Component test: expanding a goal shows individual tasks (LH, RH, TH) with their statuses in `plugins-external/sessions-plugin/GoalsView.test.tsx`
- [X] T020 [P] [US2] Component test: goal progress updates when task status changes to "done" in `plugins-external/sessions-plugin/GoalsView.test.tsx`

### Implementation for User Story 2

- [X] T021 [US2] Add goal expansion state and task detail rendering (task name, staffIndex label, status badge, linked practice results) in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T022 [US2] Implement goal progress refresh: on Goals tab activation, load full session data for each goal's sessionId and compute tasksDone/tasksTotal from actual task statuses in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T023 [US2] Add expanded goal and task detail CSS styles (task row, status badges, progress indicator) in `plugins-external/sessions-plugin/SessionsPlugin.css`

**Checkpoint**: User can view all goals, see per-goal progress, and inspect individual task statuses.

---

## Phase 5: User Story 3 — Goal Completion (Priority: P3)

**Goal**: When all tasks in a goal reach "done" status, the goal automatically transitions to "completed" with a visual indicator.

**Independent Test**: Mark all tasks as done → goal status transitions to "completed" → visual checkmark/distinction appears.

### Tests for User Story 3

- [X] T024 [P] [US3] Unit test: goal status transitions to "completed" when all taskIds map to tasks with status "done" in `plugins-external/sessions-plugin/goalEngine.test.ts`
- [X] T025 [P] [US3] Component test: completed goal renders with visual distinction (checkmark, different styling) vs active goals in `plugins-external/sessions-plugin/GoalsView.test.tsx`

### Implementation for User Story 3

- [X] T026 [US3] Implement goal completion check: after refreshing goal progress, if all tasks are "done", update goal status to "completed" in goalStorage and goalIndex in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T027 [US3] Add completed goal visual styling (checkmark icon, muted/success color, distinction from active goals) in `plugins-external/sessions-plugin/SessionsPlugin.css`

**Checkpoint**: Goals automatically complete when all tasks are done, with clear visual feedback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Goal deletion, edge case handling, and final validation.

- [X] T028 [P] Implement goal deletion with confirmation dialog in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T029 [P] Add duplicate goal warning: when user selects a score that already has an active goal, show confirmation before creating in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T030 Add empty state for Goals tab ("No goals yet — create one to start practicing!") in `plugins-external/sessions-plugin/GoalsView.tsx`
- [X] T031 Run quickstart.md manual validation (3-tab navigation, goal creation, session verification, task parameters check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - US1 (P1) first — MVP
  - US2 (P2) depends on US1 (needs goals to exist for viewing)
  - US3 (P3) depends on US2 (needs progress tracking to detect completion)
- **Polish (Phase 6)**: Can start after US1, but T031 requires all phases complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Engine/storage logic before UI components
- UI components before CSS styling
- Verify tests pass after implementation before moving to next phase

### Parallel Opportunities

- T002 + T003 can run in parallel (different files)
- T008 + T009 + T010 + T011 + T012 can all run in parallel (same test file, different test cases)
- T018 + T019 + T020 can run in parallel (same test file, different test cases)
- T024 + T025 can run in parallel (different test files)
- T028 + T029 can run in parallel (same file but independent features)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task T008: "Unit test: first phrase selection in goalEngine.test.ts"
Task T009: "Unit test: task generation multi-staff in goalEngine.test.ts"
Task T010: "Unit test: task generation single-staff in goalEngine.test.ts"
Task T011: "Unit test: session targetDate is tomorrow in goalEngine.test.ts"
Task T012: "Unit test: duplicate goal warning in goalEngine.test.ts"

# After tests written and failing, implement sequentially:
Task T013: "Implement goal engine in goalEngine.ts"
Task T014: "Extend TabId and add Goals tab button in SessionsPlugin.tsx"
Task T015: "Create GoalsView component in GoalsView.tsx"
Task T016: "Add goals tab CSS in SessionsPlugin.css"
Task T017: "Wire GoalsView into SessionsPlugin in SessionsPlugin.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007)
3. Complete Phase 3: User Story 1 (T008–T017)
4. **STOP and VALIDATE**: Create a goal from a score, verify 3 tasks + scheduled session
5. Deploy/demo if ready — this is the core value delivery

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Deploy/Demo (progress tracking)
4. Add US3 → Test independently → Deploy/Demo (goal completion)
5. Add Polish → Final validation → Complete feature

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
