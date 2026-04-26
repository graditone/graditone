# Tasks: Fix Note Detection at Ultra-Low Tempos

**Branch**: `086-fix-note-detection-slow-tempo`
**Spec**: `specs/086-fix-note-detection-slow-tempo/spec.md`
**Stack**: TypeScript (React + Vitest), `frontend/plugins/practice-view-plugin/`

**Root Cause Summary** (identified via code reading before task generation):

Two tempo-unscaled thresholds in the hold-detection pipeline combine to violate the ≤ 500 ms acceptance tolerance at ultra-low tempos:

1. **Tick-based hold gate** (`usePracticeMidi.ts` line 284):
   `effectiveDurTicks > PPQ` — silently skips hold enforcement for any note ≤ 1 quarter-note in ticks.
   At 10 BPM a quarter note = 6 000 ms, but the gate returns `requiredHoldMs = 0` → note accepted
   immediately on press instead of after 6 seconds.

2. **Fixed 90 % hold-completion threshold** (`useHoldProgress.ts`):
   `progress >= 0.9` fires HOLD_COMPLETE 10 % early in relative terms. For a 24 000 ms whole note
   (10 BPM) that is 2 400 ms early — violating SC-001's ≤ 500 ms requirement. The same rule fires
   only 200 ms early at 120 BPM (fine), so the bug is invisible at normal tempos.

**Affected files**:
- `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` — hold gate + hold-ms calculation
- `frontend/plugins/practice-view-plugin/useHoldProgress.ts` — 90 % completion threshold
- Test files: `usePracticeMidi.test.ts`, `useHoldProgress.test.ts`

**Unchanged files**: `practiceEngine.ts`, `practiceEngine.types.ts` (no hold logic lives there)

---

## Phase 1: Setup

**Purpose**: Extract the hold-duration formula into a named export so it can be unit-tested in
isolation before its surrounding gate condition is changed.

- [ ] T001 Extract `computeRequiredHoldMs(durationTicks: number, bpm: number): number` and
  `HOLD_FLOOR_MS: number` as named exports from
  `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`;
  the function returns `(durationTicks / ((bpm / 60) * 960)) * 1000` when `bpm > 0`,
  else `0`; leave all existing behaviour intact

---

## Phase 2: Foundational (TDD RED Gate)

**Purpose**: Write the two key failing tests that prove the bugs are real and observable, before
changing any implementation code.

⚠️ **CRITICAL — TDD GATE**: Both tasks below MUST be committed as RED (failing) tests before
any implementation work begins in Phase 3. Do not proceed to Phase 3 until both tests fail.

- [ ] T002 [P] Write failing test in
  `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts`:
  mock `requestAnimationFrame` with `vi.useFakeTimers()`; for `requiredHoldMs = 24_000`
  (whole note at 10 BPM), assert HOLD_COMPLETE is dispatched only after ≥ 23 500 ms —
  the current 90 % rule dispatches at 21 600 ms so this test MUST be RED

- [ ] T003 [P] Write failing test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 10 BPM (`playerState.bpm = 10`), a quarter note (`durationTicks = 960`) should dispatch
  `CORRECT_MIDI` with `requiredHoldMs = 6_000`; the current `effectiveDurTicks > PPQ` gate
  returns `requiredHoldMs = 0` so this test MUST be RED

**Checkpoint**: Run `pnpm test --run` in `frontend/`. T002 and T003 are RED. Proceed to Phase 3.

---

## Phase 3: User Story 1 — Long Notes at Measure End Detected Promptly at Ultra-Low Tempo (Priority: P1) 🎯 MVP

**Goal**: At 10–20 BPM, whole and half notes (especially at measure end) are accepted within
≤ 500 ms of their theoretical musical end — no over-holding required.

**Independent Test**: `pnpm test --run` in `frontend/`; T002, T003, T004, T005, T006 are GREEN;
manual smoke test at 10 BPM: whole note accepted ≈ 23 500 ms after onset.

### Tests for User Story 1 ⚠️ Write FIRST — must be RED before T007/T008

- [ ] T004 [P] [US1] Write failing test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 10 BPM, whole note (`durationTicks = 3_840`, no next-note gap clipping) →
  `CORRECT_MIDI` dispatched with `requiredHoldMs = 24_000`
  (currently passes only if the tick-gate allows it; create a note entry where
  `durationTicks = 3_840` so `effectiveDurTicks = 3_840 > PPQ` — this test IS currently green;
  confirms the formula is correct and must stay green after T008)

- [ ] T005 [P] [US1] Write failing test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 15 BPM, half note at measure end (`durationTicks = 1_920`) →
  `requiredHoldMs = 8_000` (= `1920 / ((15/60)*960) * 1000`)

- [ ] T006 [P] [US1] Write failing test in
  `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts`:
  for `requiredHoldMs = 24_000`, advance fake timers to 21_600 ms and assert
  `HOLD_COMPLETE` has NOT yet fired; advance to 23_500 ms and assert it HAS fired
  (this test is RED because the current 90 % rule fires at 21 600 ms)

### Implementation for User Story 1

- [ ] T007 [US1] Fix hold-completion threshold in
  `frontend/plugins/practice-view-plugin/useHoldProgress.ts`:
  replace `if (progress >= 0.9)` with
  ```
  const acceptanceMs = required - Math.min(required * 0.1, 500);
  if (elapsed >= acceptanceMs)
  ```
  This keeps the 90 % rule for short notes (< 5 000 ms) where 10 % < 500 ms,
  and caps the early-acceptance at 500 ms for long notes (≥ 5 000 ms);
  update the `progress` computation accordingly (`elapsed / required` can stay for the UI bar)

- [ ] T008 [US1] Fix hold-gate condition in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`:
  replace `bpm > 0 && effectiveDurTicks > PPQ` with
  `computeRequiredHoldMs(effectiveDurTicks, bpm) > HOLD_FLOOR_MS`
  so the gate is time-based rather than tick-based;
  set `HOLD_FLOOR_MS = 500` (notes whose wall-clock duration ≤ 500 ms need no hold)

**Checkpoint**: T002 – T006 are GREEN. US1 is independently testable.

---

## Phase 4: User Story 2 — Consistent Detection Across All Note Values at Ultra-Low Tempos (Priority: P2)

**Goal**: Quarter notes, half notes, and whole notes all enforce proportional holds at 10 BPM —
not just notes longer than 1 quarter-note in ticks.

**Independent Test**: `pnpm test --run` in `frontend/`; T009 and T010 are GREEN.

### Tests for User Story 2 ⚠️ Write FIRST — must be RED before T011

- [ ] T009 [P] [US2] Write failing test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 10 BPM, eighth note (`durationTicks = 480`) →
  `CORRECT_MIDI` dispatched with `requiredHoldMs = 3_000`
  (currently the tick-gate gives `requiredHoldMs = 0`; RED until T008 is implemented)

- [ ] T010 [P] [US2] Write failing test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 10 BPM, quarter note (`durationTicks = 960`) next to another note (gap = 960 ticks) →
  `effectiveDurTicks` stays 960 (no clipping since gap == duration) →
  `requiredHoldMs = 6_000`
  (verifies the gap-clipping logic does not accidentally suppress the hold for measure-end notes)

### Implementation for User Story 2

- [ ] T011 [US2] Verify `HOLD_FLOOR_MS = 500` (set in T008) is sufficient for sub-quarter-note
  durations at ultra-low tempos — eighth note @ 10 BPM = 3 000 ms > 500 ms → hold required;
  no additional code change required if T008 used the correct constant;
  confirm by running T009 which must now be GREEN

**Checkpoint**: T009 and T010 are GREEN. All note values at 10 BPM enforce proportional holds.

---

## Phase 5: Polish & Regression Tests

**Goal**: Zero regressions at 120 BPM and edge cases from spec covered.

- [ ] T012 [P] Write regression test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 120 BPM, quarter note (`durationTicks = 960`) → `requiredHoldMs = 0`
  (500 ms is NOT > `HOLD_FLOOR_MS` = 500 ms using strict `>`; behaviour unchanged)

- [ ] T013 [P] Write regression test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 120 BPM, half note (`durationTicks = 1_920`) → `requiredHoldMs = 1_000`
  (1 000 ms > 500 ms → hold required; formula unchanged from before)

- [ ] T014 [P] Write regression test in
  `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts`:
  for `requiredHoldMs = 2_000` (120 BPM whole note), HOLD_COMPLETE fires between
  1 800 ms and 1 850 ms (90 % rule still binds for T < 5 000 ms; no change)

- [ ] T015 [P] Write regression test in
  `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts`:
  for `requiredHoldMs = 1_000` (120 BPM half note), HOLD_COMPLETE fires between
  900 ms and 950 ms (90 % rule: `1000 - min(100, 500) = 900 ms`)

- [ ] T016 [P] Write edge-case test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  `computeRequiredHoldMs(3_840, 0)` returns 0 (BPM ≤ 0 guard, no division by zero)

- [ ] T017 [P] Write edge-case test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at exactly 20 BPM (spec boundary), quarter note (960 ticks) →
  `requiredHoldMs = 3_000` (= `(960 / ((20/60)*960)) * 1000`; > 500 ms → hold required)

- [ ] T018 [P] Write edge-case test in
  `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts`:
  at 10 BPM, note with next-entry gap smaller than duration (e.g., `durationTicks = 3_840`,
  `gapTicks = 1_920`) → `effectiveDurTicks = 1_920` (gap-clipped),
  `requiredHoldMs = 12_000`; confirms clipping still works after T008

- [ ] T019 [P] Write integration smoke test in
  `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`:
  dispatch `CORRECT_MIDI` with `requiredHoldMs = 24_000` → engine mode becomes `'holding'` →
  dispatch `HOLD_COMPLETE` → engine advances with outcome `'correct'`;
  validates the pipeline end-to-end (no code change to `practiceEngine.ts` needed)

**Checkpoint**: Run `pnpm test --run` in `frontend/`. All tests GREEN. Zero regressions.

---

## Dependencies

```
T001 (export helpers)
  └─> T002, T003 (foundational RED tests — require exported symbols)
        └─> T004, T005, T006 (US1 RED tests)
              └─> T007 (fix useHoldProgress)
              └─> T008 (fix usePracticeMidi gate)
                    └─> T009, T010 (US2 RED tests — depend on new gate logic)
                          └─> T011 (US2 confirm)
                                └─> T012–T019 (regression + edge cases)
```

Stories US1 and US2 share the same two implementation tasks (T007, T008) because the root causes
are the same two thresholds. US2 adds tests for shorter note values (quarter, eighth) to confirm
the time-based gate catches them correctly.

## Parallel Execution Examples

Within each story phase, all `[P]`-marked test-writing tasks can run in parallel (different test
files). Implementation tasks T007 (useHoldProgress.ts) and T008 (usePracticeMidi.ts) touch
different files and can also be implemented in parallel.

```
Phase 2 parallel:  T002 ‖ T003
Phase 3 parallel:  T004 ‖ T005 ‖ T006 → T007 ‖ T008
Phase 4 parallel:  T009 ‖ T010
Phase 5 parallel:  T012 ‖ T013 ‖ T014 ‖ T015 ‖ T016 ‖ T017 ‖ T018 ‖ T019
```

## Implementation Strategy

**MVP scope (just US1 = T001 → T008)**: Fixes the P1 reported bug — whole/half notes at measure
end at ultra-low tempos are accepted within ≤ 500 ms of their musical end. Already fixes
most of US2 as a side effect (half notes and whole notes also get the fix via T007).

**US2 addition (T009–T011)**: Adds test coverage for quarter and eighth note hold requirements
at ultra-low tempos, which the time-based gate in T008 already handles. No new code — only
test confirmation.

**Phase 5 confirms** no regressions at 120 BPM and covers all spec edge cases.
