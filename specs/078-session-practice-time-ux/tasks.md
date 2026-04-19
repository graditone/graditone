# Tasks: Session & Practice Goal Execution UX Improvements

**Branch**: `078-session-practice-time-ux`
**Input**: Design documents from `/specs/078-session-practice-time-ux/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

---

## Phase 1: Setup

**Purpose**: Clone `plugins-external/sessions-plugin` into the worktree so session-plugin files
are editable. Frontend files are available directly in the worktree.

- [X] T001 Clone plugins-external into worktree: `git clone git@github.com:aylabs/graditone-pro-plugins.git plugins-external` from `/Users/alvaro.delcastillo/devel/worktrees/078-session-practice-time-ux`
- [X] T002 Create feature branch in plugins-external: `cd plugins-external && git checkout -b 078-session-practice-time-ux`
- [X] T003 Install sessions-plugin dependencies: `cd plugins-external/sessions-plugin && npm install`

---

## Phase 2: Foundational

**Purpose**: No shared blocking prerequisites for this feature — all three user stories touch independent files and can begin immediately after setup.

**Checkpoint**: Setup complete. US3 (frontend) and US1 (sessions plugin) can proceed in parallel.

---

## Phase 3: User Story 3 — Lock Loop Count During Task-Linked Practice (Priority: P1) 🎯 MVP

**Goal**: When practice is launched from a session task, the loop count slider in the Results overlay is disabled (non-interactive). A tooltip explains the lock. Standalone practice is unaffected.

**Independent Test**: Launch practice from a task → complete one loop → check Results overlay → verify loop count slider has `disabled` attribute and `title` tooltip is shown → verify Repractice uses original task loop count → verify standalone practice overlay has no disabled slider.

### Tests for User Story 3

> **Write tests FIRST — verify they FAIL before implementation**

- [X] T004 [US3] Add failing test: loop slider disabled when `loopCountLocked=true` in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`
- [X] T005 [US3] Add failing test: loop slider enabled when `loopCountLocked` is absent/false in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`
- [X] T006 [US3] Add failing test: slider shows tooltip text when locked in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx`

### Implementation for User Story 3

- [X] T007 [P] [US3] Add `practice.results.loop_locked_hint` key to `frontend/src/i18n/locales/en.json`
- [X] T008 [P] [US3] Add `practice.results.loop_locked_hint` key to `frontend/src/i18n/locales/es.json`
- [X] T009 [US3] Add `loopCountLocked?: boolean` prop to `ResultsOverlayProps` interface in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`
- [X] T010 [US3] Apply `disabled={loopCountLocked}` and `title={loopCountLocked ? t('practice.results.loop_locked_hint') : undefined}` to loop count `<input type="range">` in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`
- [X] T011 [US3] Pass `loopCountLocked={!!taskIdRef.current}` to `<ResultsOverlay>` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: US3 is independently testable — loop slider locked in task practice, free in standalone practice.

---

## Phase 4: User Story 1 — Task-Level Time Progress: Invested vs. Estimated (Priority: P1)

**Goal**: Each task row in the session view shows accumulated invested practice time alongside the estimated duration in a clear `invested / estimated` format. Pure display change — reads existing `linkedPractices[*].practiceTimeMs` and `estimatedDurationSecs`.

**Independent Test**: Create a session with a task that has `estimatedDurationSecs`, link two practices to it, open the session view, verify the task meta row shows the combined invested time alongside the estimate. Also verify: zero-invested shows `0 min / Xm`, no-estimate shows only `Xm invested`, both-zero shows nothing.

### Tests for User Story 1

> **Write tests FIRST — verify they FAIL before implementation**

- [X] T012 [P] [US1] Add failing test: task with estimate + practices shows `invested / estimated` in `plugins-external/sessions-plugin/TaskRow.test.tsx`
- [X] T013 [P] [US1] Add failing test: task with estimate + zero practices shows `0 min / Xm` in `plugins-external/sessions-plugin/TaskRow.test.tsx`
- [X] T014 [P] [US1] Add failing test: task without estimate + practices shows `invested only` in `plugins-external/sessions-plugin/TaskRow.test.tsx`
- [X] T015 [P] [US1] Add failing test: task without estimate + no practices shows no time row in `plugins-external/sessions-plugin/TaskRow.test.tsx`

### Implementation for User Story 1

- [X] T016 [P] [US1] Add i18n keys `task_row.invested_estimate`, `task_row.invested_only`, `task_row.invested_aria` to `plugins-external/sessions-plugin/locales/en.json`
- [X] T017 [P] [US1] Mirror new i18n keys to `plugins-external/sessions-plugin/locales/es.json`
- [X] T018 [US1] Compute `investedTimeMs` inline in `TaskRow.tsx` from `task.linkedPractices.reduce((s, lp) => s + lp.practiceTimeMs, 0)` and render `invested / estimated` (or `invested only`) in the task meta row in `plugins-external/sessions-plugin/TaskRow.tsx`

**Checkpoint**: US1 independently testable — task rows show correct invested/estimated time in all four display states.

---

## Phase 5: User Story 2 — Session Completion Summary: Real vs. Estimated Time (Priority: P2)

**Goal**: When a session is closed, store `totalRealTimeSecs` on the index entry. Render a `SessionTimeSummary` component in the closed session detail header showing real time, estimated time, and the signed delta (overrun styled as warning, saving as neutral/positive). Summary persists in session history.

**Independent Test**: Create a session with tasks having `estimatedDurationSecs`, link practices totalling a known real time, close the session, expand it in the sessions list, verify the summary shows correct real/estimated/delta values with correct delta styling.

### Tests for User Story 2

> **Write tests FIRST — verify they FAIL before implementation**

- [X] T019 [P] [US2] Add failing test: `closeSession()` computes and stores `totalRealTimeSecs` from task linked practices in `plugins-external/sessions-plugin/sessions-plugin.test.tsx`
- [X] T020 [P] [US2] Create `plugins-external/sessions-plugin/SessionTimeSummary.test.tsx` with failing tests for: real-only display, real+estimate display, overrun styling, saving styling, partial-estimate footnote

### Implementation for User Story 2

- [X] T021 [US2] Add `totalRealTimeSecs?: number` field to `SessionIndexEntry` interface in `plugins-external/sessions-plugin/sessionTypes.ts`
- [X] T022 [P] [US2] Add i18n keys `session_summary.real_time`, `session_summary.real_vs_estimated`, `session_summary.overrun`, `session_summary.saving`, `session_summary.partial_estimate`, `session_summary.section_label` to `plugins-external/sessions-plugin/locales/en.json`
- [X] T023 [P] [US2] Mirror new i18n keys to `plugins-external/sessions-plugin/locales/es.json`
- [X] T024 [US2] Compute `totalRealTimeSecs` in `closeSession()` and persist via `updateSessionIndex(id, { totalRealTimeSecs })` in `plugins-external/sessions-plugin/useSessionManager.ts`
- [X] T025 [US2] Create `SessionTimeSummary.tsx` pure presentational component with overrun/saving CSS modifier classes in `plugins-external/sessions-plugin/SessionTimeSummary.tsx`
- [X] T026 [US2] Add CSS rules for `.sessions-plugin__time-summary`, `.sessions-plugin__time-summary--overrun`, `.sessions-plugin__time-summary--saving` to `plugins-external/sessions-plugin/SessionsPlugin.css`
- [X] T027 [US2] Render `<SessionTimeSummary>` inside the closed session collapsible detail header in `plugins-external/sessions-plugin/SessionsPlugin.tsx`, passing `realTimeSecs={entry.totalRealTimeSecs}`, `estimatedTimeSecs={entry.totalEstimatedDurationSecs}`, and partial-coverage counts computed from `fullSession.tasks`

**Checkpoint**: US2 independently testable — closed sessions show real vs. estimated time summary with correct styling and partial-estimate footnote.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] Run full sessions-plugin test suite and confirm all new and existing tests pass: `cd plugins-external/sessions-plugin && npx vitest run`
- [X] T029 [P] Run full practice-view-plugin test suite and confirm all new and existing tests pass: `cd frontend && npx vitest run frontend/plugins/practice-view-plugin/`

---

## Dependency Graph

```
T001 → T002 → T003              (setup — serial)

T003 → T012–T015  (US1 tests)
T003 → T019–T020  (US2 tests)
T016–T017 → T018  (US1 i18n before render)
T007–T008 (US3 i18n — parallel)

T009 → T010 → T011              (US3 — serial within story)
T004–T006 ← T009–T011          (US3 tests red → implementation green)
T012–T015 ← T016–T018           (US1 tests red → implementation green)
T021 → T024 → T027              (US2 type → close logic → render — serial)
T019–T020 ← T021–T027           (US2 tests red → implementation green)
T022–T023 → T025 → T027
T025 → T026

T027 → T028
T011 → T029
```

## Parallel Execution Examples

**US3 and US1 can be implemented completely in parallel** — they touch zero shared files:
- Developer A works on T004–T011 (practice plugin — frontend)
- Developer B works on T012–T018 (TaskRow — sessions plugin)
- US2 begins after T021 (type change) is in place

**Within US2**: T022/T023 (i18n) and T019/T020 (tests) can run in parallel before T024–T027.

## Implementation Strategy

**MVP**: US3 alone (T004–T011, T029) — delivers the loop-lock fix that prevents data integrity
issues for task-linked practices. Can be shipped independently.

**Full P1 delivery**: US3 + US1 (all tasks through T018 + T028/T029).

**Full feature**: all tasks T001–T029.
