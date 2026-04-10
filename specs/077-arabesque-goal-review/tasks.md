# Tasks: Review Execution of Learning Arabesque Goal

**Branch**: `077-arabesque-goal-review` | **Worktree**: `../worktrees/077-arabesque-goal-review` | **Date**: 2026-04-08  
**Input**: Design documents from `/specs/077-arabesque-goal-review/`  
**Prerequisites**: plan.md ✓ | spec.md ✓ | research.md ✓ | data-model.md ✓ | contracts/ ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = Phrase detection, US2 = Timings, US3 = Session definitions, US4 = Reporting
- All paths are relative to worktree root: `../worktrees/077-arabesque-goal-review`

---

## Phase 1: Setup

**Purpose**: Verify baseline and confirm worktree readiness before any story implementation.

- [x] T001 Confirm worktree is at `../worktrees/077-arabesque-goal-review` and both `cargo test` and `npm test` (in `plugins-external/sessions-plugin/`) pass with zero failures
- [x] T002 Run `python3 scripts/analyze_arabesque_phrases.py` from worktree root and record the baseline phrase output (9 phrases with 1-measure fragments) to use as before/after reference

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: This feature has no shared infrastructure to build — but US1 (phrase detection) is the data foundation that US2 (timings) and US3 (sessions) depend on. US1 must be complete before US2 and US3 are testable end-to-end. US4 (reporting) can be developed in parallel with US2/US3 since it only reads already-persisted task state.

**⚠️ CRITICAL**: US2 and US3 depend on correct phrase counts from US1. Complete Phase 3 before Phases 4 and 5.

---

## Phase 3: User Story 1 — Phrases Align With Musical Structure (Priority: P1) 🎯 MVP

**Goal**: Eliminate 1-measure boundary fragments in Arabesque phrase detection. After this fix, Arabesque produces 5 coherent phrases per instrument instead of 9 jagged fragments.

**Independent Test**: Import `Burgmuller_Arabesque.mxl` and assert that `score.phrases` for instrument 0 contains no phrase shorter than 2 measures and exactly 5 phrases total.

### Tests for User Story 1

> **Write tests FIRST — verify they FAIL before implementing `merge_short_phrases`**

- [x] T003 [P] [US1] Extend `test_parse_arabesque_produces_phrases` (T026) in `backend/tests/phrase_detection_test.rs`: add assertion that no phrase for instrument 0 has length < 2 measures (i.e. `end_measure - start_measure + 1 >= 2` for all phrases), and assert exactly 5 phrases for instrument 0 — test must FAIL before T005
- [x] T004 [P] [US1] Add unit test `test_merge_short_phrases_merges_into_predecessor` in `backend/tests/phrase_detection_test.rs`: given sorted phrases [0,3],[4,4],[5,9], expect merge produces [0,4],[5,9] — test must FAIL before T005
- [x] T004b [P] [US1] Add unit test `test_merge_short_phrases_merges_into_successor_when_no_predecessor` in `backend/tests/phrase_detection_test.rs`: given sorted phrases [0,0],[1,5], expect merge produces [0,5] — test must FAIL before T005

### Implementation for User Story 1

- [x] T005 [US1] Add constant `MIN_PHRASE_MEASURES: usize = 4` and implement `pub fn merge_short_phrases(phrases: Vec<PhraseRegion>) -> Vec<PhraseRegion>` in `backend/src/domain/phrases.rs`: iteratively merge any phrase with length < MIN_PHRASE_MEASURES into its predecessor (fallback to successor if no predecessor), repeating until stable; single-phrase scores are never merged
- [x] T006 [US1] Call `merge_short_phrases(instrument_phrases)` at the end of the per-instrument loop in `detect_phrases()` in `backend/src/domain/phrases.rs`, just before the `sort_by_key` and `all_phrases.extend` calls
- [x] T007 [US1] Run `cargo test phrase_detection` in `backend/` and verify T003, T004, T004b all pass; verify no existing phrase detection tests regressed

**Checkpoint**: `test_parse_arabesque_produces_phrases` passes with 5 phrases for instrument 0 and no 1-measure fragments. `scripts/analyze_arabesque_phrases.py` still runs cleanly.

---

## Phase 4: User Story 2 — Practice Time Estimates Feel Realistic (Priority: P2)

**Goal**: Reduce `BASE_SECS_PER_MEASURE` from 210 to 90 so that all Arabesque phrase-task estimates fall within the 3–15 minute range for medium difficulty at default parameters.

**Independent Test**: Call `estimateTaskDuration(9, 10, 2, 90)` (A-section, 9 measures) and assert the result is ≤ 900s (15 min); call `estimateTaskDuration(8, 10, 2, 90)` and assert ≤ 900s; sum all 5 phrase estimates × 3 tasks and assert the total is between 7200s (2h) and 36000s (10h).

### Tests for User Story 2

> **Write tests FIRST — verify they FAIL before changing BASE_SECS_PER_MEASURE**

- [x] T008 [P] [US2] Add test `arabesque_phrase_estimate_a_section_within_range` in `plugins-external/sessions-plugin/durationEstimation.test.ts`: assert `estimateTaskDuration(9, 10, 2, 90)` is between 150 and 900 (2.5–15 min) — must FAIL before T010
- [x] T009 [P] [US2] Add test `arabesque_total_estimated_time_within_range` in `plugins-external/sessions-plugin/durationEstimation.test.ts`: compute total for all 5 Arabesque phrase lengths [2,9,8,8,6] at medium difficulty defaults × 3 tasks, assert total between 7200 and 36000 — must FAIL before T010

### Implementation for User Story 2

- [x] T010 [US2] Change `export const BASE_SECS_PER_MEASURE = 210` to `export const BASE_SECS_PER_MEASURE = 90` in `plugins-external/sessions-plugin/durationEstimation.ts`
- [x] T011 [US2] Run `npm test -- durationEstimation` in `plugins-external/sessions-plugin/` and verify T008, T009 pass; verify all pre-existing duration estimation tests still pass (update any snapshot/hardcoded expected-value tests that legitimately need updating due to the calibration change)

**Checkpoint**: All Arabesque phrase estimates are ≤ 900s at medium difficulty. Total across 5 phrases × 3 tasks ≈ 8466s (2.35h).

---

## Phase 5: User Story 3 — Generated Session Plan Is Coherent (Priority: P3)

**Goal**: Increase `goalBudget` from `Math.round(3600 * 0.5)` to `3600` so that Arabesque sessions pack correctly and the plan produces 3 sessions (not 8), each within the 1-hour available time budget.

**Independent Test**: Call `createGoal` with a mock Arabesque score (5 phrases, piano) and default parameters; assert the returned sessions array has length ≤ 4; assert no session's `totalEstimatedDurationSecs` exceeds 3600; assert all phrase groups (RH+LH+BH triplets for the same measures) are co-located in the same session.

### Tests for User Story 3

> **Write tests FIRST — verify they FAIL before changing goalBudget**

- [x] T012 [P] [US3] Add test `arabesque_goal_creates_at_most_4_sessions` in `plugins-external/sessions-plugin/goalEngine.test.ts`: build a mock score with 5 Arabesque phrase groups (durations matching BASE=90 calibration), call `createGoal`, assert `sessions.length <= 4` — must FAIL before T014
- [x] T013 [P] [US3] Add test `arabesque_goal_sessions_do_not_exceed_available_time` in `plugins-external/sessions-plugin/goalEngine.test.ts`: using the same mock, assert every session's `totalEstimatedDurationSecs <= 3600` — must FAIL before T014
- [x] T013b [P] [US3] Add test `arabesque_phrase_group_triplets_colocated` in `plugins-external/sessions-plugin/sessionDistribution.test.ts`: given 3 phrase groups (RH/LH/BH for measures 3–11) and budget=3600, assert all three tasks appear in the same session object — should already pass (validates existing atomicity), document result

### Implementation for User Story 3

- [x] T014 [US3] In `plugins-external/sessions-plugin/GoalsView.tsx`, find the `goalBudget` constant (currently `Math.round(3600 * 0.5)`) and change its value to `3600`
- [x] T015 [US3] Run `npm test -- goalEngine sessionDistribution` in `plugins-external/sessions-plugin/` and verify T012, T013, T013b all pass; verify all pre-existing goal creation and session distribution tests still pass

**Checkpoint**: A freshly created Arabesque learning goal produces exactly 3 sessions, each ≤ 3600s, with all phrase group triplets (RH+LH+BH) co-located in the same session.

---

## Phase 6: User Story 4 — Goal Progress Is Clearly Reported (Priority: P4)

**Goal**: Add `PhraseProgress` type to `goalTypes.ts`, implement `computeGoalProgress()` in `goalEngine.ts`, render a per-phrase mastery section with overall completion % in `GoalsView.tsx`, and ensure the goal auto-completes when all tasks are `done`.

**Independent Test**: Simulate 5 phrases × 3 tasks in the sessions store; mark all tasks for one phrase as `done`; mount GoalsView; assert it renders a "Phrase Progress" section containing 5 rows, where the completed phrase shows "mastered" and the rest show "pending", and overall percentage = 20%.

### Tests for User Story 4

> **Write tests FIRST — verify they FAIL before implementing computeGoalProgress and GoalsView changes**

- [x] T016 [P] [US4] Add tests in `plugins-external/sessions-plugin/goalEngine.test.ts`: `computeGoalProgress_all_done_returns_100_percent` (all tasks done → completionPercentage = 100, all phrases mastered), `computeGoalProgress_partial_returns_correct_percent` (2 of 5 phrases done → 40%), `computeGoalProgress_any_failed_marks_phrase_failed` (one task failed → phrase status = 'failed') — all must FAIL before T018
- [x] T017 [P] [US4] Add tests in `plugins-external/sessions-plugin/GoalsView.test.tsx`: `renders_phrase_progress_section_for_arabesque_goal` (assert 5 phrase rows visible), `renders_mastery_percentage` (assert "20%" text when 1 of 5 phrases mastered), `failed_task_shows_failed_badge` (assert task with status failed renders visually distinct element) — all must FAIL before T019

### Implementation for User Story 4

- [x] T018 [P] [US4] Add `PhraseMasteryStatus`, `PhraseProgress`, `GoalProgressSummary` types and export `computeGoalProgress(goalId, tasks)` pure function in `plugins-external/sessions-plugin/goalTypes.ts` and/or `goalEngine.ts` per the contract in `specs/077-arabesque-goal-review/contracts/goal-progress-view.ts`: group tasks by `${startMeasure}-${endMeasure}` key, derive mastery status per derivation rules, compute completionPercentage = round(mastered/total * 100)
- [x] T019 [US4] In `plugins-external/sessions-plugin/GoalsView.tsx`, within the expanded goal section: call `computeGoalProgress(goalId, goalTasks)`, render a "Phrase Progress" subsection with one row per phrase showing measure range label, mastery status badge (mastered/in-progress/failed/pending), and `doneCount/totalCount`; render overall completion percentage (e.g. "2 / 5 phrases mastered — 40%")
- [x] T020 [US4] In `plugins-external/sessions-plugin/GoalsView.tsx`, add a `useEffect` that runs when task statuses change (triggered by any session update event) and calls `checkGoalCompletionAcrossSessions` for every active goal, updating goal status to `completed` when all tasks are `done` — so completion does not require a manual goal expand to trigger
- [x] T021 [US4] Run `npm test -- goalEngine GoalsView` in `plugins-external/sessions-plugin/` and verify T016, T017 all pass; verify all pre-existing GoalsView and goalEngine tests still pass

**Checkpoint**: GoalsView expanded goal section shows 5 Arabesque phrase rows with mastery badges and an overall completion %, failed tasks are visually distinct, and goal auto-completes when last task is done.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression check, WASM rebuild, and end-to-end verification.

- [x] T022 [P] Run full Rust test suite in `backend/`: `cargo test` — all tests pass with no regressions across phrase detection, score parsing, difficulty, and layout tests
- [x] T023 [P] Run full sessions-plugin test suite: `cd plugins-external/sessions-plugin && npm test` — all pre-existing tests pass; new tests all pass
- [x] T024 Rebuild WASM from `backend/` (`wasm-pack build --target web --out-dir pkg`) to ensure updated `detect_phrases` with `merge_short_phrases` is compiled into the WASM module used by the frontend
- [x] T025 Start the dev stack (`docker-compose up` or local dev server) and manually create an Arabesque learning goal: verify 5 phrase sections visible in session tasks, 3 sessions generated, estimates in 3–15 min range, and GoalsView phrase progress section renders correctly

---

## Dependencies

```
T001 → T002 (baseline capture)
T002 → T003–T004b (test writing uses baseline)
T003–T004b → T005–T006 (tests must fail before implementation)
T005–T006 → T007 (run tests)
T007 → T008–T009 (US2 tests need correct phrase lengths from US1)
T008–T009 → T010–T011 (tests must fail before calibration change)
T010–T011 → T012–T013b (US3 tests need calibrated durations from US2)
T012–T013b → T014–T015 (tests must fail before goalBudget change)
T016–T017 [parallel with T003–T015] → T018–T019–T020 → T021
T022, T023 [parallel] → T024 → T025
```

### Parallel Execution Per Story

| Story | Parallelisable pairs | Rationale |
|-------|----------------------|-----------|
| US1 | T003, T004, T004b | Three independent test additions in the same file (non-conflicting functions) |
| US2 | T008, T009 | Two independent test additions in the same file |
| US3 | T012, T013, T013b | Three independent test additions in two files |
| US4 | T016, T017 | Test additions in two different files (goalEngine.test.ts, GoalsView.test.tsx) |
| US4 impl | T018 [P] | `goalTypes.ts`/`goalEngine.ts` changes independent of `GoalsView.tsx` changes (T019, T020) |
| Polish | T022, T023 | Backend and plugin test suites independent |

**US4 can begin test writing (T016, T017) in parallel with US1/US2/US3 implementation** — it reads only already-persisted task state and does not depend on corrected phrase detection or duration values.

---

## Implementation Strategy

**MVP**: Complete Phase 3 (US1 — phrase detection fix) first. This is the foundation: wrong phrases cascade into wrong estimates, wrong sessions, and wrong progress reports. All other phases stack on this.

**Increment 2**: Phase 4 (US2 — duration calibration). A one-line constant change with broad impact on all goal-related UX.

**Increment 3**: Phase 5 (US3 — session budget). A one-line constant change that resolves session overflow.

**Increment 4**: Phase 6 (US4 — progress reporting). The largest implementation change (new type + function + UI section + effect). Develop test-first with T016, T017 written after Phase 3 tests pass.

**Suggested commit order**:
1. `test: expand T026 Arabesque phrase assertions + merge_short_phrases unit tests`
2. `fix: add merge_short_phrases post-step to detect_phrases in phrases.rs`
3. `test: add Arabesque duration range tests to durationEstimation.test.ts`
4. `fix: calibrate BASE_SECS_PER_MEASURE from 210 to 90`
5. `test: add Arabesque session count and budget tests`
6. `fix: align goalBudget with availableTime (1800 → 3600) in GoalsView`
7. `test: add computeGoalProgress and GoalsView phrase mastery tests`
8. `feat: add PhraseProgress type and computeGoalProgress function`
9. `feat: render phrase mastery section and completion % in GoalsView`
10. `feat: auto-trigger goal completion check on task state changes`
11. `chore: rebuild WASM, regression check`
