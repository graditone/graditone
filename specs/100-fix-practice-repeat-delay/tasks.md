---

description: "Task list template for feature implementation"
---

# Tasks: Fix Delayed Chord Detection on Phrase Repeat

**Input**: Design documents from `specs/100-fix-practice-repeat-delay/`
**Prerequisites**: plan.md, spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included — Constitution V (Test-First Development, NON-NEGOTIABLE) and VII (Regression Prevention) mandate a red regression test before the behaviour change (see `research.md`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Plugin module root: `frontend/plugins/practice-view-plugin/` (all source under `frontend/` per plan.md)
- Contract reference: `specs/100-fix-practice-repeat-delay/contracts/computeExpectedTimeMs.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-good baseline.

- [X] T001 Verify baseline test suite is green for the practice-view plugin. Run `npx vitest run plugins/practice-view-plugin/` from `frontend/` and confirm `usePracticeMidi.test.ts`, `practiceEngine.test.ts`, `usePracticeLoop.test.ts` all pass with zero failures. Record output as the pre-fix baseline.
- [X] T002 Confirm `npm run typecheck` and `npm run lint` (from `frontend/`) pass against the current practice-view-plugin sources before any changes.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Create the single pure helper that owns expected-onset-time computation. Blocks US1 — no US1 work begins until it exists (red tests only after the helper contract is pinned).

- [X] T003 Add pure exported helper `computeExpectedTimeMs` to `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` per `contracts/computeExpectedTimeMs.md` (do NOT yet wire it in): signature `(params: { tick: number; bpm: number; loopRegion: { startTick: number; endTick: number } | null; loopIteration: number }) => number`. Rules: `bpm <= 0 → 0`; non-loop or `loopIteration <= 0 → tick/PPQ*1000`; else `baseExpectedTimeMs + loopIteration * loopPeriodMs` with `PPQ = 960` and `loopPeriodMs = ((endTick − startTick)/((bpm/60)*960))*1000`. Pure TypeScript, no React imports (matches `computeRequiredHoldMs` convention).
- [X] T004 [P] Create `frontend/plugins/practice-view-plugin/computeExpectedTimeMs.test.ts` covering the full contract test-vector table in `contracts/computeExpectedTimeMs.md`: at `bpm=120`, `{tick:0,loopRegion:{0,1920},loopIteration:0}→0`, `{tick:960,…,0}→500`, `{tick:0,…,1}→1000`, `{tick:960,…,1}→1500`, `{tick:0,…,2}→2000`, `{tick:0,loopRegion:null,loopIteration:1}→0`, `{tick:0,loopRegion:{0,960},loopIteration:1}→500`, `{tick:0,bpm:0,…}→0`. Run and confirm green.

**Checkpoint**: `computeExpectedTimeMs` is pure, exported, and its contract tests pass.

---

## Phase 3: User Story 1 - First Chord of a Repeated Phrase Recorded On-Time (Priority: P1) 🎯 MVP

**Goal**: In a loop-count practice, the first chord of each iteration ≥ 2 is recorded on-time when struck accurately; `expectedTimeMs` is anchored to the musical loop period, not the previous iteration's completion timestamp.

**Independent Test**: `usePracticeMidi.test.ts` regression (T005) + `computeExpectedTimeMs.test.ts` contract. An accurate second-iteration first attack yields `relativeDeltaMs ≈ 0`; a forced accurate sequence under the old formula would exceed `LATE_THRESHOLD_MS` (> 600 ms).

### Tests for User Story 1 (write first — RED)

- [X] T005 Add failed-regression test to `usePracticeMidi.test.ts`: render the hook with `loopRegionRef = {startTick:0, endTick:1920}`, `loopIterationRef.current = 1`, `loopStartTimesRef.current = [0, 1250]` (completion timestamp 1250 ms), a single-chord note at `tick:0` `bpm:120`, and `practiceStartTimeRef.current` set so the attack occurs exactly one loop period (1000 ms) after the session start. Simulate the chord attack; assert the dispatched `CORRECT_MIDI` has `expectedTimeMs === 1000` (the loop period) — NOT `1250` (the completion timestamp). Confirm this fails on current code (which would dispatch `expectedTimeMs === 1250`).

### Implementation (after RED confirmed)

- [X] T006 Update `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` lines ~299-312: replace the inline `loopStartBaseMs`/`timeWithinLoop`/`loopStartMs` computation with a call to `computeExpectedTimeMs({ tick: currentEntry.tick, bpm, loopRegion: loopRegionRef.current, loopIteration: loopIterationRef.current })`. Remove the read of `loopStartTimesRef` for the timing path. Preserve the `responseTimeMs` and hold-duration logic exactly. Run T005 → GREEN.

**Checkpoint**: US1 code complete — loop-boundary `expectedTimeMs` is period-anchored and the regression is green.

---

## Phase 4: User Story 2 - Correct Timing Across Iterations and Tempos (Priority: P2)

**Goal**: The fix holds across multiple loop iterations and the tested tempo range without regressing non-loop correctness.

**Independent Test**: `computeExpectedTimeMs.test.ts` multi-iteration vectors (loopIteration 0,1,2) plus the existing practice-engine loop tests; non-loop/`loopIteration≤0` remain identical to `baseExpectedTimeMs`.

### Tests for User Story 2 (write first — RED)

- [X] T007 Add to `computeExpectedTimeMs.test.ts`: 3-iteration monotonicity — `expectedTimeMs(iter2) > expectedTimeMs(iter1) > expectedTimeMs(iter0)` at `bpm=60` and `bpm=120` for the same tick, and iteration-1 parity (`loopIteration:0` equals `loopRegion:null` result). Confirm any failing on current understanding before the helper existed (these test pure output parity; once the helper exists they assert the fix).

### Implementation (after RED confirmed)

- [X] T008 [P] Confirm `frontend/plugins/practice-view-plugin/practiceEngine.ts` needs no change — the existing loop-boundary guard (`expectedTimeMs` going backwards → delta 0, practiceEngine.ts:654-666) remains a safety net. Run `practiceEngine.test.ts` and confirm all loop timing tests still pass unchanged.

**Checkpoint**: US2 complete — multi-iteration/tempo correctness and non-loop parity verified.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T009 Run the full practice-view plugin suite `npx vitest run plugins/practice-view-plugin/` from `frontend/` — all green, zero failures.
- [X] T010 Run `npm run typecheck` and `npm run lint` (from `frontend/`) — clean.
- [X] T011 Confirm `loopStartTimesRef` is no longer read for timing in `usePracticeMidi.ts` (the write in `usePracticeLoop.ts:141-143` may remain for loop bookkeeping); if it becomes fully write-only and ESLint flags it, add a short comment explaining the remaining purpose rather than deleting (out-of-scope prune avoided).
- [X] T012 Update `specs/100-fix-practice-repeat-delay/spec.md` — Known Issues Issue #1 Root Cause / Resolution / Regression Test / Lessons Learned with the confirmed analysis from `research.md` and the regression test reference (`usePracticeMidi.test.ts` T005, `computeExpectedTimeMs.test.ts` T004).

## Dependencies

- US1 (Phase 3) depends on the `computeExpectedTimeMs` helper (T003/T004, Phase 2).
- US2 (Phase 4) depends on US1 (T006).
- Polish (Phase 5) depends on US1 + US2.

No cross-file parallel conflicts: T003/T004 (helper + helper tests) are [P]; T005..T008 are sequential within the plugin files.

## Implementation Strategy

- **MVP first**: Ship US1 only (helper + regression + wiring) as the deployable increment. US2 and polish are hardening/verification on top of the same change.