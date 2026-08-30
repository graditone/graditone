# Tasks: Fix Tempo Display on Metronome Slider

**Input**: Design documents from `/specs/093-fix-tempo-display/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Branch**: `093-fix-tempo-display`

**Tests**: ✅ Tests ARE included — REQUIRED by Constitution V (Test-First) and VII (Regression Prevention). This feature is a bug fix; the spec's Known Issues #1 mandates a regression test written before the fix.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project**: Web app monorepo — all source under `frontend/plugins/practice-view-plugin/` (see plan.md Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a green baseline before any change

- [X] T001 Run the existing practice-view-plugin test suite to confirm the current GREEN baseline: `cd frontend && npm test -- plugins/practice-view-plugin` — record pass/fail count; no baseline failures must be present before starting TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain contract that the user-story implementation depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `frontend/plugins/practice-view-plugin/useFreePractice.test.ts` with RED tests for the new effective-BPM contract: (a) `setFreeTempo(1.25)` with base 80 → `freeEffectiveBpm` === 100; (b) floor clamp — base 40 with multiplier 0.25 → `freeEffectiveBpm` === 10 (ABSOLUTE_BPM_FLOOR); (c) stopping a session writes `FreeMidiRecord.bpm` === round(base × multiplier at stop), NOT the base — these tests MUST fail against current `useFreePractice.ts` (does not yet expose `setFreeTempo`/`freeEffectiveBpm`)

**Checkpoint**: Red tests in place — the failing contract defines the implementation target

---

## Phase 3: User Story 1 - Tempo Number Updates When the Metronome Slider Is Used (Priority: P1) 🎯 MVP

**Goal**: During a Free Practice session, dragging the metronome tempo slider updates the numeric BPM readout in real time AND keeps the measure clock, staff renderer, and saved `FreeMidiRecord.bpm` consistent with the audible beat.

**Independent Test**: Start a Free Practice session (`PracticeViewPlugin` render with free practice active) → `fireEvent.change` on the tempo slider (1.0 → 1.25) → assert the toolbar BPM text updates to `round(base × 1.25)` immediately and differs from the initial readout. Suite: `npm test -- plugins/practice-view-plugin`.

### Tests for User Story 1 (REQUIRED — write FIRST, ensure they FAIL before implementation) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Add regression test to `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`: enter free practice (click Free Practice in mocked ScoreSelector) → `fireEvent.change` the tempo slider to 1.25 → assert toolbar readout (`practice-plugin__toolbar-bpm`) shows `round(base × 1.25)` and differs from the initial `round(base × 1.0)` value — MUST FAIL against current code (readout stays frozen at base)
- [X] T004 [P] [US1] Add guard test to `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`: render `PracticeToolbar` with `isFreePractice`, arbitrary `bpm={137}`, and assert the readout renders the passed `bpm` prop verbatim ("137") — documents that the toolbar is orchestrator-driven and prevents a cosmetic render-time workaround from hiding the real fix

### Implementation for User Story 1

- [X] T005 [US1] Implement `setFreeTempo(multiplier: number)` and expose `freeEffectiveBpm` in `frontend/plugins/practice-view-plugin/useFreePractice.ts`: `freeEffectiveBpm = Math.round(baseBpm × multiplier)`, clamped to `≥ ABSOLUTE_BPM_FLOOR`; keep `freeStaffBpm`/`freeStaffBpmRef` as the base (dataset: `data-model.md` Free-Practice Tempo State) — depends on T002
- [X] T006 [US1] Make the measure clock use the effective BPM in `frontend/plugins/practice-view-plugin/useFreePractice.ts`: quantize `startMeasureClock` using the unrounded effective BPM (avoid drift — mirror `useMetronomeBridge` exactBpm split), and write `FreeMidiRecord.bpm` = rounded effective BPM at stop time in `handleFreeToggle` — depends on T005
- [X] T007 [US1] Wire the slider into free-practice state in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` `handleTempoChange`: keep `setTempoMultiplier(m)` + `context.scorePlayer.setTempoMultiplier(m)`; when `freePractice.isFreePractice`, ALSO call `freePractice.setFreeTempo(m)` in the same handler — depends on T005
- [X] T008 [US1] Drive the free-practice consumers from the effective BPM in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: pass `bpm={freePractice.freeEffectiveBpm}` to `PracticeToolbar`, derive the toolbar `currentTick` from `freeEffectiveBpm`, and pass `freeEffectiveBpm` to the free-canvas `StaffViewer` `bpm` prop — depends on T005, T007
- [X] T009 [US1] Verify ALL tests pass after implementation: run `cd frontend && npm test -- plugins/practice-view-plugin` (T002, T003, T004 plus full existing suite green) and `npm run typecheck` — depends on T008

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — the readout tracks the slider, and record.bpm/measure clock/staff renderer all agree

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verification and documentation across the feature

- [X] T010 Run the validation scenarios in `specs/093-fix-tempo-display/quickstart.md`: automated suite (`npm test -- plugins/practice-view-plugin`, `npm run typecheck`) plus the manual end-to-end free-practice slider check (readout tracks slider at rest, number == audible beat, replay/save use stop-time tempo)
- [X] T011 [P] Update `frontend/plugins/practice-view-plugin/ARCHITECTURE.md`: document the effective-BPM semantics for `freeStaffBpm`/`freeStaffBpmRef` (base vs effective) and the new `setFreeTempo(multiplier)` API on `useFreePractice`
- [X] T012 [P] Update `specs/093-fix-tempo-display/spec.md` Known Issues #1: mark **Resolution** (effective-BPM single source of truth) and **Regression Test** (reference T003 in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`); set `[x]` requirement checkboxes as completed per Constitution VII closure

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — defines the failing contract
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **Polish (Final Phase)**: Depends on User Story 1 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — sole story; no other story dependencies

### Within the User Story

- Tests (T003, T004) MUST be written and FAIL before implementation (T005–T008) — Constitution V/VII
- Domain contract (T005) before consumers (T006, T007, T008)
- Implementation before verification (T009)
- Story complete before moving to Polish

### Parallel Opportunities

- T002, T003, T004 are all RED tests on different files (`useFreePractice.test.ts`, `PracticeViewPlugin.test.tsx`, `practiceToolbar.test.tsx`) — fully parallel
- T005 must precede T006/T007/T008 (they depend on its API)
- T011, T012 can run in parallel during Polish

---

## Parallel Example: User Story 1

```bash
# Launch all RED tests together (different files):
Task: "Add regression test to PracticeViewPlugin.test.tsx (T003)"
Task: "Add guard test to practiceToolbar.test.tsx (T004)"

# After T005 lands, consumers can proceed:
Task: "Measure clock + record.bpm effective semantics in useFreePractice.ts (T006)"
Task: "Wire handleTempoChange → setFreeTempo in PracticeViewPlugin.tsx (T007)"
Task: "Drive toolbar/staffViewer bpm from freeEffectiveBpm in PracticeViewPlugin.tsx (T008)"
```

---

## Bug Fixes and Regression Prevention

**Purpose**: Document the bug being fixed and ensure it never recurs

**Constitution Requirement**: Principle VII (Regression Prevention) REQUIRES creating a test that reproduces the error BEFORE implementing the fix.

### Issue #1: Tempo Number Does Not Update When Slider Is Moved (this feature)

- [X] (Documented) Spec `specs/093-fix-tempo-display/spec.md` Known Issues #1:
  - **Symptom**: Dragging the metronome tempo slider during Free Practice beats at the new tempo but the numeric BPM readout stays frozen at the session-start value
  - **Root Cause**: The readout is fed by `useFreePractice.freeStaffBpm`, which is only written at session boundaries; the slider path (`handleTempoChange`) updates only `tempoMultiplier` + `scorePlayer.setTempoMultiplier` and never feeds back into free-practice state. Same root cause leaves the measure clock and saved `FreeMidiRecord.bpm` stale.
  - **Affected Area**: `frontend/plugins/practice-view-plugin/useFreePractice.ts`, `PracticeViewPlugin.tsx` (free practice only)
- [X] (Regression test) **T003** in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — reproduces the stale-readout error; MUST fail before the fix (per Constitution VII test-first), stays in the suite permanently
- [X] (Fix) **T005/T006/T007/T008** — effective-BPM single source of truth in `useFreePractice.ts` + orchestrator wiring
- [X] (Verify) **T009** — full plugin suite + typecheck green; regression test passes

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline green)
2. Complete Phase 2: Foundational (RED contract tests — T002)
3. Complete Phase 3: User Story 1 (RED tests T003/T004 → implement T005–T008 → verify T009)
4. **STOP and VALIDATE**: run quickstart.md automated + manual scenarios (T010)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → failing contract defined (test-first guarantee)
2. Add User Story 1 → test independently → verify (MVP!)
3. Polish: documentation + spec closure (T011, T012)

### Parallel Team Strategy (optional)

With multiple developers:

1. Team completes Phase 1 + Phase 2 together (baseline + contract tests)
2. Once Foundational is done:
   - Developer A: US1 implementation (T005 → T008)
   - The RED tests T002/T003/T004 can be authored in parallel by a second developer beforehand
3. Story integrates and is verified independently (T009)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to the user story for traceability ([US1] = the sole story)
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Constitution V/VII)
- Commit after each task or logical group
- Stop at the checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence