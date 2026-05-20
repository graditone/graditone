# Tasks: Goal Creation Form

**Input**: Design documents from `/specs/068-goal-creation-form/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Implementation state** (2026-04-01): 266/266 tests pass. Two gaps identified: (1) no test for `checkDuplicate` prop behavior — Constitution Principle V violation; (2) pre-existing TypeScript typecheck failures in test files. Tasks T001–T019 and T017 implementation are complete. Remaining: T020 test + T021–T026 typecheck + final validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are included per Constitution Principle V (Test-First Development — MANDATORY for this codebase).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — user story phase tasks only
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before any changes.

- [X] T001 Verify existing test suite passes with `npm test` in plugins-external/sessions-plugin/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Engine extension and shared type export that ALL user story phases depend on. Must be complete before Phase 3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Write failing tests for parameterised `createGoal()` — custom loopCount/tempoMultiplier/minResult and default fallback — in plugins-external/sessions-plugin/goalEngine.test.ts
- [X] T003 [P] Export `GoalCreationFormParams` interface (scoreRef, scoreTitle, loopCount, minResult, tempoMultiplier) in plugins-external/sessions-plugin/goalTypes.ts
- [X] T004 Extend `CreateGoalInput` with optional `loopCount?`, `tempoMultiplier?`, `minResult?` fields and replace hardcoded values with `input.loopCount ?? 10` / `input.tempoMultiplier ?? 1.0` / `input.minResult ?? 90` in plugins-external/sessions-plugin/goalEngine.ts

**Checkpoint**: Engine accepts custom params with backward-compatible defaults. `npm test` — T002 tests must now pass.

---

## Phase 3: User Story 1 — Create Goal with Custom Parameters (Priority: P1) 🎯 MVP

**Goal**: The form opens immediately on "Create Goal" tap — showing all fields at once — and creates a goal whose tasks carry the user-specified iterations, min result, and tempo values.

**Independent Test**: Tap "Create Goal" → form opens with all fields visible → select a score, set iterations=5, minResult=80%, tempo=75% → submit → verify created goal's tasks have `loopCount: 5`, `minResult: 80`, `tempoMultiplier: 0.75`.

### Tests for User Story 1 (write FIRST — must FAIL before T007/T008/T009)

- [X] T005 [P] [US1] Write failing tests for `GoalCreationForm` rendering: read-only "Play Score" / "Phrases" labels, score selector button, three sliders visible, submit fires `onSubmit` with user-provided values in plugins-external/sessions-plugin/GoalCreationForm.test.tsx
- [X] T006 [P] [US1] Write failing tests for `GoalsView` form-first flow: "Create Goal" tap opens form (not score picker), goal created on submit, form closes and goals list refreshes in plugins-external/sessions-plugin/GoalsView.test.tsx
- [X] T020 [P] [US1] Write test describe block for `checkDuplicate` prop: given `checkDuplicate` resolves `true` after score selection, dismissible duplicate-goal warning renders; given dismiss is clicked, warning disappears; given `checkDuplicate` resolves `false`, no warning renders in plugins-external/sessions-plugin/GoalCreationForm.test.tsx

### Implementation for User Story 1

- [X] T007 [US1] Create `GoalCreationForm.tsx`: read-only "Type of goal" and "Score breakdown" fields, score selector button that opens `ScoreSelector` overlay, three `<input type="range">` sliders (iterations 1–20 step 1, minResult 0–100 step 5, tempo 50–200 step 5), cancel and submit buttons in plugins-external/sessions-plugin/GoalCreationForm.tsx
- [X] T008 [US1] Replace `showScoreSelector` state with `showCreationForm: boolean` in `GoalsView`; update `handleCreateGoal` to set `showCreationForm = true`; render `<GoalCreationForm>` instead of full-screen `<ScoreSelector>` overlay in plugins-external/sessions-plugin/GoalsView.tsx
- [X] T009 [US1] Wire `GoalCreationForm.onSubmit(params: GoalCreationFormParams)` into `processScoreSelection`: pass `params.loopCount`, `params.minResult`, `params.tempoMultiplier` into `createGoal()` call; close form and call `refreshGoals()` on success in plugins-external/sessions-plugin/GoalsView.tsx

**Checkpoint**: US1 fully functional. Form opens on "Create Goal" tap. Submitting with custom slider values produces tasks with matching `loopCount`, `minResult`, `tempoMultiplier`. `npm test` — T005 and T006 tests must pass.

---

## Phase 4: User Story 2 — Form Defaults Match Current Behavior (Priority: P2)

**Goal**: The form opens with sliders pre-set to the same values that the previous auto-generation flow used (iterations=10, minResult=90, tempo=100%). Submitting without changes produces an identical goal to the old flow.

**Independent Test**: Open form → verify iterations slider shows 10, minResult shows 90%, tempo shows 100% → select a score, submit without changing sliders → verify created `SessionTask` has `loopCount: 10`, `minResult: 90`, `tempoMultiplier: 1.0` (same as old behavior).

### Tests for User Story 2 (write FIRST — must FAIL before T012)

- [X] T010 [P] [US2] Write failing tests that `GoalCreationForm` mounts with `iterations=10`, `minResult=90`, `tempoPercent=100` as initial slider values in plugins-external/sessions-plugin/GoalCreationForm.test.tsx
- [X] T011 [P] [US2] Write failing tests that `createGoal()` called without the three new optional fields produces tasks with `loopCount: 10`, `tempoMultiplier: 1.0`, `minResult: 90` (unchanged from pre-feature output) in plugins-external/sessions-plugin/goalEngine.test.ts

### Implementation for User Story 2

- [X] T012 [US2] Set `GoalCreationForm` initial React state to `{ iterations: 10, minResult: 90, tempoPercent: 100 }` so sliders are pre-populated on mount in plugins-external/sessions-plugin/GoalCreationForm.tsx

**Checkpoint**: US2 fully functional. Users who accept defaults get identical goal output to the old flow. `npm test` — T010 and T011 tests must pass.

---

## Phase 5: User Story 3 — Form Validation (Priority: P3)

**Goal**: Submit is blocked when no score is selected (with inline error) and when the selected score becomes unavailable (warning icon + disabled button). A duplicate active goal for the selected score shows a dismissible inline warning that does NOT block submission.

**Independent Test**: (a) Open form → tap submit without selecting score → error appears, submit stays disabled. (b) Select a score → make score unavailable → warning icon appears, submit disabled. These validations work independently of US1/US2.

### Tests for User Story 3 (write FIRST — must FAIL before T015/T016/T017)

- [X] T013 [US3] Write failing tests that submit button is disabled and error message shown when no score is selected; submit button is enabled when a valid score is selected in plugins-external/sessions-plugin/GoalCreationForm.test.tsx
- [X] T014 [US3] Write failing tests that when selected score is marked unavailable: warning icon renders on score selector and submit button is disabled in plugins-external/sessions-plugin/GoalCreationForm.test.tsx

### Implementation for User Story 3

- [X] T015 [US3] Implement submit guard: disable submit button when `selectedScore === null`; show inline error "Please select a score to continue" in plugins-external/sessions-plugin/GoalCreationForm.tsx
- [X] T016 [US3] Fix unavailable score detection: add `selectedScore.ref.type === 'preloaded'` guard so only preloaded catalogue scores are checked against `getCatalogue()`; user-uploaded scores (`type: 'user'`) MUST never set `scoreUnavailable = true`. Show `sessions-plugin__task-score-warning` and disable submit only for preloaded scores absent from the catalogue. (fixed — BUG-001)
- [X] T017 [US3] Implement duplicate active goal inline warning: call `hasGoalForScoreAsync()` after score selection; if duplicate found set `duplicateWarning = true`; render dismissible warning using `goals-view__form-warning` CSS class; warning does NOT disable submit in plugins-external/sessions-plugin/GoalCreationForm.tsx

**Checkpoint**: US3 fully functional. All three validation behaviors work. `npm test` — T013 and T014 tests must pass.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T018 [P] Add `goals-view__form-warning` and `goal-creation-form__*` CSS classes to plugins-external/sessions-plugin/SessionsPlugin.css
- [X] T019 Run full test suite: 266/266 pass with `npm test` in plugins-external/sessions-plugin/
- [X] T021 [P] Fix pre-existing TypeScript spread-argument errors (TS2556) on GoalsView.test.tsx lines 32–46 in plugins-external/sessions-plugin/GoalsView.test.tsx
- [X] T022 [P] Fix pre-existing `DaySummary` type-not-found errors (TS2304) on calendarUtils.test.ts lines 533 and 577 in plugins-external/sessions-plugin/calendarUtils.test.ts
- [X] T023 Run `npm run typecheck` in plugins-external/sessions-plugin/ and confirm zero errors
- [X] T024 Run `npm test` in plugins-external/sessions-plugin/ and confirm all tests pass — 395/395 (fixed — BUG-001)
- [X] T025 Run quickstart.md validation per specs/068-goal-creation-form/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Requires Phase 2 complete — no dependency on US2 or US3
- **Phase 4 (US2)**: Requires Phase 2 complete — US2 tests/implementation build on the `GoalCreationForm` component created in US1
- **Phase 5 (US3)**: Requires Phase 2 complete — US3 adds validation to the `GoalCreationForm` component from US1
- **Final Phase**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Phase 2 — self-contained MVP
- **US2 (P2)**: Shares `GoalCreationForm.tsx` with US1 — start after T007 is complete
- **US3 (P3)**: Shares `GoalCreationForm.tsx` with US1 — start after T007 is complete; US2 default tests must pass first to avoid regressions

### Within Each Phase

- Tests MUST be written and confirmed FAILING before implementation (Constitution Principle V)
- T005 and T006 can be written in parallel (different files: `GoalCreationForm.test.tsx` vs `GoalsView.test.tsx`)
- T007 must complete before T008 and T009 (GoalsView imports `GoalCreationForm`)
- T008 must complete before T009 (state flow change must exist before wiring `onSubmit`)
- T010 and T011 can be written in parallel (different files)
- T013 and T014 are sequential (same file, added in order)
- T015, T016, T017 are sequential (same file: `GoalCreationForm.tsx`)
- **Remaining work**: T020 (checkDuplicate test) is independent of T021/T022 (typecheck fixes); all can run in parallel
- T023 depends on T020 + T021 + T022 (all three files clean before typecheck)
- T024 depends on T023 (clean typecheck then full test run)
- T025 (quickstart) depends on T024
- T026 must be written and confirmed FAILING before T027 (Constitution Principle V)
- T027 depends on T026

---

## Bugfix Tasks (BUG-001)

**Purpose**: Fix the `scoreUnavailable` type-guard omission that blocks user-uploaded scores from goal creation.

- [X] T026 [P] [US3] Write failing regression test: given a user-uploaded score (`type: 'user'`) is selected in `GoalCreationForm`, no unavailability warning is rendered and the submit button is enabled in plugins-external/sessions-plugin/GoalCreationForm.test.tsx
- [X] T027 [US3] Fix `GoalCreationForm.tsx`: replace `const scoreUnavailable = selectedScore !== null && !catalogue.some(c => c.id === selectedScore.ref.id)` with `const scoreUnavailable = selectedScore !== null && selectedScore.ref.type === 'preloaded' && !catalogue.some(c => c.id === selectedScore.ref.id)` in plugins-external/sessions-plugin/GoalCreationForm.tsx

**Checkpoint**: T026 regression test passes. User-uploaded scores no longer blocked. Re-run `npm test` for T024.

**Bugfix**: 2026-05-20 — BUG-001 Updated from bugfix patch

## Parallel Execution Examples

### Parallel example: Phase 2 (Foundational)

```
T002 (goalEngine.test.ts)     T003 (goalTypes.ts)
         ↓
T004 (goalEngine.ts — both T002 tests and T003 type must be ready)
```

### Parallel example: Phase 3 test writing

```
T005 (GoalCreationForm.test.tsx)     T006 (GoalsView.test.tsx)
                  ↓
              T007 (GoalCreationForm.tsx)
                  ↓
              T008 → T009 (GoalsView.tsx)
```

### Parallel example: Phase 4 test writing

```
T010 (GoalCreationForm.test.tsx)     T011 (goalEngine.test.ts)
                  ↓
              T012 (GoalCreationForm.tsx defaults)
```

### Parallel example: Remaining work (Final Phase)

```
T020 (GoalCreationForm.test.tsx — checkDuplicate tests)
T021 (GoalsView.test.tsx — TS2556 spread fix)
T022 (calendarUtils.test.ts — DaySummary type fix)
               ↓  (all three complete)
T023 (npm run typecheck — zero errors)
               ↓
T024 (npm test — 270+ pass)
               ↓
T025 (quickstart.md validation)
```

---

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) delivers a fully working goal creation form. Users can open the form, set custom parameters, and create a goal. This is the minimum shippable increment.

**Incremental delivery**:
1. Phase 1–3: Working form with configurable parameters (MVP)
2. + Phase 4: Defaults match old behavior — zero regression risk
3. + Phase 5: Full validation — submit guard + unavailable score + duplicate warning
4. + Final Phase: Polish and clean typecheck

**Total tasks**: 25
- Setup: 1 task ✅
- Foundational: 3 tasks ✅
- US1: 8 tasks (7 ✅, T020 remaining)
- US2: 3 tasks ✅
- US3: 5 tasks ✅
- Final Phase: 5 tasks (T018–T019 ✅, T021–T025 remaining)

**Completed**: 25/25 | **Remaining**: 0 tasks — DONE ✅
