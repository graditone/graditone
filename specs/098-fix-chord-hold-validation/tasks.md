---

description: "Task list template for feature implementation"
---

# Tasks: Fix Chord Hold Validation at the Measure Boundary

**Input**: Design documents from `specs/098-fix-chord-hold-validation/`
**Prerequisites**: plan.md, spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included — Constitution V (Test-First Development, NON-NEGOTIABLE) and VII (Regression Prevention) mandate red-regression tests before each behaviour change (see research.md → Test Strategy).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Plugin module root: `frontend/plugins/practice-view-plugin/` (all source under `frontend/` per plan.md)
- Contract references from: `specs/098-fix-chord-hold-validation/contracts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-good baseline before writing failing tests.

- [X] T001 Verify baseline test suite is green for the practice-view plugin. Run `npx vitest run plugins/practice-view-plugin/` from `frontend/` and confirm `useHoldProgress.test.ts`, `usePracticeMidi.test.ts`, `practiceEngine.test.ts` all pass with zero failures. Record output as the pre-fix baseline.
- [X] T002 Confirm `npm run typecheck` and `npm run lint` (from `frontend/`) pass against the current practice-view-plugin sources before any changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the single source of truth for the hold-acceptance rule (contracts/hold-validation.md). Blocks every user story — no user story work can begin until this phase is complete.

- [X] T003 Create pure helper module `frontend/plugins/practice-view-plugin/holdDuration.ts` exporting exactly: `HOLD_FLOOR_MS = 500`, `computeRequiredHoldMs(durationTicks: number, bpm: number): number` (`(durationTicks / ((bpm/60) * 960)) * 1000` or `0` when `bpm <= 0`), `computeHoldAcceptanceMs(requiredHoldMs)` = `requiredHoldMs − Math.min(requiredHoldMs * 0.1, 500)` (returns `0` when `requiredHoldMs <= 0`), and `isHoldAccepted(requiredHoldMs: number, elapsedMs: number): boolean` = `requiredHoldMs > 0 && elapsedMs >= computeHoldAcceptanceMs(requiredHoldMs)`. No React imports; pure TypeScript only (matches `contracts/hold-validation.md`).
- [X] T004 [P] Create `frontend/plugins/practice-view-plugin/holdDuration.test.ts` covering the full contract table in `contracts/hold-validation.md`: `computeRequiredHoldMs(3840,10)=24000`, `computeRequiredHoldMs(960,120)=500`, `computeRequiredHoldMs(3840,0)=0`, `computeHoldAcceptanceMs(2000)=1800`, `computeHoldAcceptanceMs(24000)=23500`, `computeHoldAcceptanceMs(1000)=900`, `isHoldAccepted(2000,1799)=false`, `isHoldAccepted(2000,1800)=true`, `isHoldAccepted(2000,4000)=true`, `isHoldAccepted(0,any)=false`. Run and confirm green.
- [X] T005 Migrate `HOLD_FLOOR_MS` and `computeRequiredHoldMs` OUT OF `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` into `holdDuration.ts`, re-exporting both from `usePracticeMidi.ts` with the SAME public names so existing imports and tests (including `usePracticeMidi.test.ts` importing `computeRequiredHoldMs`) keep compiling. Run the existing practice-view-plugin test suite again to confirm no behavioural change.
- [X] T006 Update `frontend/plugins/practice-view-plugin/useHoldProgress.ts` to import `computeHoldAcceptanceMs`/`isHoldAccepted` from `./holdDuration` and drive its rAF acceptance check from those helpers (Behaviour MUST be identical: 90% / 500 ms cap). Run `useHoldProgress.test.ts` — T002/T006/T014/T015 must remain green unchanged.

**Checkpoint**: Foundation ready — the acceptance rule is defined once, imported by all consumers.

---

## Phase 3: User Story 1 - Whole-Measure Chord Validated After a Full Measure Hold (Priority: P1) 🎯 MVP

**Goal**: A chord held for its full notated duration and changed on the next downbeat is validated as correct; the outcome depends on measured hold time, never event order.

**Independent Test**: `usePracticeMidi.test.ts` + `practiceEngine.test.ts` scenarios: whole-measure chord at 60 BPM (requiredHoldMs 4000) released at ≥3600 ms is accepted; no `WRONG_MIDI` when rolling to the next chord at the downbeat; `EARLY_RELEASE` with a full hold behaves like `HOLD_COMPLETE`.

### Tests for User Story 1 (write first, confirm RED)

- [X] T007 [P] [US1] Add failed-regression test to `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`: chord entry `{tick:0, durationTicks:3840, midiPitches:[60,64,67]}` at `bpm:60` state `holding` with `holdStartTimeMs` 4000 ms ago; simulate a `release` for pitch 60. Assert dispatch receives `HOLD_COMPLETE` (NOT `EARLY_RELEASE`). Confirm this fails on current code (release handler dispatches `EARLY_RELEASE` unconditionally).
- [X] T008 [P] [US1] Add failed-regression test to `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`: state `holding` with `requiredHoldMs:2000` (acceptance 1800), dispatch `EARLY_RELEASE` with `holdDurationMs:1900`. Assert resulting `noteResults[0].outcome === 'correct'` and `currentIndex` advanced (identical to `HOLD_COMPLETE(1900)`). Confirm fails on current code.
- [X] T009 [P] [US1] Add failed-regression test to `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`: while `mode==='holding'` for entry 1 (whole-measure chord), press a pitch belonging to entry 2 only, with entry-1 hold already past acceptance. Assert NO `WRONG_MIDI` is dispatched, `HOLD_COMPLETE` fires for entry 1, and the press is re-processed toward entry 2. Confirm fails on current code.

### Implementation for User Story 1

- [X] T010 [US1] Fix the release handler in `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` (release branch, `mode==='holding'`): compute `holdDurationMs = Date.now() - holdPs.holdStartTimeMs`; when `isHoldAccepted(holdPs.requiredHoldMs, holdDurationMs)` dispatch `HOLD_COMPLETE` (`{holdDurationMs}`), otherwise dispatch `EARLY_RELEASE`. Do not dispatch if mode already left `holding` (guard on the ref-read state).
- [X] T011 [US1] Fix the press-during-hold path in `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`: when `mode==='holding'` and the incoming pitch is not part of the current entry, first check `isHoldAccepted(...)`; if the current hold is complete, dispatch `HOLD_COMPLETE`, `reset` the `ChordDetector` to the NEXT entry's required pitches (onset + sustained), and re-run this same press through the standard chord-press completion routine (extract the completion block into a local helper so the normal path and this path share it). If not yet accepted, keep `WRONG_MIDI` behavior.
- [X] T012 [US1] Add the domain guard in `frontend/plugins/practice-view-plugin/practiceEngine.ts` `EARLY_RELEASE` case: if `isHoldAccepted(state.requiredHoldMs, action.holdDurationMs)`, route through the existing `HOLD_COMPLETE` completion logic (record `correct`/`correct-late` result, clear hold fields, advance `currentIndex` or `complete`); otherwise keep the current early-release behavior. Import from `./holdDuration`.
- [X] T013 [US1] Run `npx vitest run plugins/practice-view-plugin/` from `frontend/` — all new regression tests (T007–T009) now pass together with the pre-existing suite; no other story tests changed.

**Checkpoint**: US1 fully functional — full-measure chord changed at the downbeat is validated; suite green.

---

## Phase 4: User Story 2 - The Required Hold Never Exceeds the Notated Duration (Priority: P1)

**Goal**: Required hold is always ≤ notated duration at the session BPM; acceptance is stable regardless of `HOLD_COMPLETE`/`EARLY_RELEASE` event ordering.

**Independent Test**: `holdDuration.test.ts` + `usePracticeMidi.test.ts`/`practiceEngine.test.ts`: `requiredHoldMs` for a whole note equals one full measure at 40/60/120 BPM (never greater); concurrent completion + release does not double-advance.

### Tests for User Story 2 (write first, confirm RED)

- [X] T014 [P] [US2] Add contract tests to `frontend/plugins/practice-view-plugin/holdDuration.test.ts` asserting the rule holds: `computeRequiredHoldMs(3840,40)=6000`, `(3840,60)=4000`, `(3840,120)=2000` — each equal to one 4/4 measure at that BPM (assert exact equality) and `isHoldAccepted(required, required)` true (full hold always accepted).
- [X] T015 [P] [US2] Add failed-regression test to `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`: from `holding` with `requiredHoldMs:4000`, dispatch `EARLY_RELEASE(3800)` (>= acceptance 3600) AND verify no double-advance if a second `EARLY_RELEASE` arrives immediately (no-op outside `holding`). Assert `currentIndex` advances exactly once. Confirm behaviour safe on current code.
- [X] T016 [P] [US2] Add order-independence test to `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`: dispatch release at exactly the acceptance boundary for a whole note at 120 BPM (requiredHoldMs 2000, acceptance 1800); assert `HOLD_COMPLETE`(1800) dispatch regardless of simulated rAF frame timing.

### Implementation for User Story 2

- [X] T017 [US2] In `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` ensure `effectiveDurTicks` (gap-clipping before `computeRequiredHoldMs`) can never exceed the entry's notated `durationTicks` — add an explicit `Math.min(effectiveDurTicks, currentEntry.durationTicks)` clamp when `gap > 0` so `requiredHoldMs` is provably ≤ notated duration at the BPM. If current logic already guarantees it, add a comment and rely on T014 tests. No user-visible change.
- [X] T018 [US2] Run `npx vitest run plugins/practice-view-plugin/` from `frontend/` — T014–T016 pass; `useHoldProgress.ts` path (T006/T014/T015 firing windows) unchanged.

**Checkpoint**: US2 complete — hold requirement bounded and order-immune.

---

## Phase 5: User Story 3 - Genuine Early Releases Are Still Detected and Penalised (Priority: P1)

**Goal**: Sub-threshold releases STILL record `early-release`, block advancement, allow retry, and reduce the score — identical to pre-fix.

**Independent Test**: `usePracticeMidi.test.ts`/`practiceEngine.test.ts`: whole-note chord released at 50% of required → `EARLY_RELEASE` result, `currentIndex` unchanged, retry can complete; `computePracticeScore` applies the 0.5× credit path for `early-release`.

### Tests for User Story 3 (write first, confirm RED only if a pre-fix behavior broke)

- [X] T019 [P] [US3] Add test to `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`: `holding` with `requiredHoldMs:4000`, dispatch `EARLY_RELEASE(2000)` → `noteResults[0].outcome==='early-release'`, `mode==='active'`, `currentIndex` unchanged, hold fields cleared.
- [X] T020 [P] [US3] Add test to `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`: whole-note chord at 60 BPM (required 4000) released after ~2000 ms dispatches `EARLY_RELEASE` (NOT `HOLD_COMPLETE`), and a subsequent full retry press re-enters `holding` (no duplicate result).
- [X] T021 [P] [US3] Add/inspect score-penalty coverage: `frontend/src/plugin-api/computePracticeScore.ts` already multiplies `earlyReleaseCount` by 0.5 — extend `computePracticeScore.test.ts` so a result with `outcome:'early-release'` and `holdDurationMs < requiredHoldMs` produces the 0.5× credit and lowers the score vs. `correct`. If already covered, note the reference and leave unchanged.

### Implementation for User Story 3

- [X] T022 [US3] No new production code expected — verify the sub-threshold path in `frontend/plugins/practice-view-plugin/practiceEngine.ts` unchanged in effect (T012 guard only alters the ≥-threshold branch) and that `EARLY_RELEASE` still clears `holdStartTimeMs`/`requiredHoldMs` and stays on the same index. Fix anything the new tests surface.
- [X] T023 [US3] Run `npx vitest run plugins/practice-view-plugin/ src/plugin-api/computePracticeScore.test.ts` from `frontend/` — T019–T021 pass; early-release scoring regression-free.

**Checkpoint**: US3 complete — genuine early releases remain penalised.

---

## Phase 6: User Story 4 - No Regression for Short Notes and Normal Tempos (Priority: P2)

**Goal**: Quarters/eighths advance immediately; halves/longer still require holds; all tempos unchanged.

**Independent Test**: Full existing Feature 042 suite stays green (short-note immediate advance, normal-tempo hold thresholds).

### Tests for User Story 4

- [X] T024 [P] [US4] Confirm `usePracticeMidi.test.ts` regressions remain green: quarter note at 120 BPM (`requiredHoldMs===0`) and half note at 120 BPM (`requiredHoldMs===1000`) — no code change unless the new `isHoldAccepted` wiring altered dispatch payloads.
- [X] T025 [P] [US4] Confirm `useHoldProgress.test.ts` firing windows (T002/T006/T014/T015) unchanged — no edits expected.

### Implementation for User Story 4

- [X] T026 [US4] Run the complete `frontend` validation gate: `npm run typecheck && npm run lint && npm test -- --run` (from `frontend/`). Zero new failures; any pre-existing unrelated failures documented in this task's completion note.

**Checkpoint**: All user stories complete and regression-free.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation currency (Constitution "Documentation Currency") and spec closure.

- [X] T027 [P] Update `FEATURES.md` — under the Practice View plugin bullet, note that whole-measure/measure-boundary chord changes are now validated by actual hold duration (measure-boundary fix, feature 098).
- [X] T028 Update `specs/098-fix-chord-hold-validation/spec.md` Known Issues → Issue #1 `Resolution` from "Pending implementation; fix specified by FR-001..FR-004" to the implemented approach (single acceptance rule applied at release/press/reducer; regression tests listed), and mark Status as implemented.
- [X] T029 [P] Update `specs/098-fix-chord-hold-validation/plan.md` and `tasks.md` final state comments (mark completed checkboxes for tasks finished; add implementation notes where tasks deviated).
- [X] T030 Run the `specs/098-fix-chord-hold-validation/quickstart.md` manual scenarios A–D in the dev app (or document unrun-ability) and append results; any failures become follow-up tasks.

> **T030 note**: Automated validation (quickstart §1) ran green — the four
> practice-view suites (131 tests) plus the full frontend gate
> `typecheck && lint && test -- --run` (152 files, 2266 passed) and a production
> build. Manual scenarios A–D require a physical MIDI keyboard/device and are
> documented in quickstart.md for post-merge device validation; the scenarios
> are each covered by the corresponding automated regression tests (T007-red /
> T020 → scenarios A/D, T019 → B, T016 → C).

## Phase 8: Follow-up — Release Margin (device-tested adjustment)

**Purpose**: Tablet validation showed that holding a whole-measure chord to (nearly) its full
duration is uncomfortable when the player must reposition fingers for the next chord. Widened
the acceptance threshold so a chord is validated with a release margin.

- [X] T031 Widen the hold-acceptance margin in `frontend/plugins/practice-view-plugin/holdDuration.ts`:
      accept once the player has held ≥75% of `requiredHoldMs` (early margin = 25% of required,
      capped at 1500 ms), via exported `EARLY_ACCEPTANCE_RATIO = 0.25` / `EARLY_ACCEPTANCE_CAP_MS = 1500`.
      Whole-note chord at 60 BPM → accepted at 3000 ms of 4000 (3 of 4 beats, ~1 beat of margin).
      Update `holdDuration.test.ts`, `useHoldProgress.test.ts` (T002/T006/T014/T015), and the
      boundary test `usePracticeMidi.test.ts` T016 (1500 ms) accordingly. Genuine early releases
      (below the margin) still record `early-release` — T019/T020 unchanged and green.

---

## Dependencies (user story completion order)

```text
Phase2 (Foundation) ──► US1 (P1) ──► US2 (P1) ──► US3 (P1) ──► US4 (P2) ──► Phase7 (Polish)
       │                    ▲                 ▲
       └──────────────────US1-blocking     US2 needs only Foundation + US1 guard (T012)
                                             US3 needs Foundation + US1 (guard) — can run parallel to US2
                                             US4 needs all stories green
```

- **US1** requires Phase 2 (helpers + migration) and the reducer guard (T012) to complete its release fix.
- **US2** requires Phase 2 (helpers) and can proceed in parallel with US1 except where it asserts against US1's `usePracticeMidi` wiring (T016).
- **US3** depends on US1's reducer guard (T012) being correct; its test-only tasks (T019–T021) can start once Phase 2 is done.
- **US4** is a pure verification story — starts last, once all stories are green.

## Parallel Execution Examples

- **T003 + T004** (`holdDuration.ts` + `holdDuration.test.ts`): both new files, no interdependency — assign to two agents concurrently.
- **T007, T008, T009** (US1 red tests): three different test files — run in parallel as separate failing-test PRs before any implementation.
- **T010, T011, T012** (US1 implementation): three different files (`usePracticeMidi.ts` release branch, `usePracticeMidi.ts` press branch, `practiceEngine.ts`) — the two `usePracticeMidi.ts` edits share one file and must be sequential, but T012 (reducer) is independent and parallelisable.
- **T014, T015, T016** (US2 red tests): separate files — parallel.
- **T019, T020, T021** (US3): separate files — parallel.

## Implementation Strategy (MVP first, incremental delivery)

1. **MVP = User Story 1** (Phase 3) on top of the minimal Foundation (Phase 2). Delivers the reported defect fix: full-measure chords changed at the downbeat are validated. Independent test = T007/T009 (release + chord-roll) and T008 (reducer guard).
2. **Increment 2 = User Story 2**: prove the required hold never exceeds notation and completion is order-immune (pure logic, mostly contract tests + one clamp).
3. **Increment 3 = User Story 3**: prove genuine early-release scoring is untouched (guards on the single sub-threshold branch).
4. **Increment 4 = User Story 4 + Polish**: full-suite regression gate and documentation currency.

Each increment is independently testable via the tests listed in its checkpoint and via `quickstart.md` scenarios.