# Tasks: Fix Practice Mode MIDI Detection

**Feature**: `001-fix-practice-midi-detection`
**Branch**: `001-fix-practice-midi-detection`
**Input**: Design documents from `specs/001-fix-practice-midi-detection/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**MVP Scope**: Phase 3 (User Story 1) — fixes the session-ending HL+HR chord retry bug independently.

**Constitution Gates (Principles V & VII)**: Tasks T003, T004, and T008 MUST be written and verified FAILING before their corresponding implementation tasks (T006/T007 and T009) are started. Never skip the "confirm FAIL" step.

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before any changes are made. Any pre-existing test failures must be understood before proceeding.

- [x] T001 Run `npx vitest run` in `frontend/` and confirm all existing tests pass (baseline checkpoint before any code changes)

---

## Phase 2: Foundational — Type System Update

**Purpose**: Expand `NoteOutcome` to include `'auto-advanced'`. Unblocks the US1 test (T003) and implementation (T006) — TypeScript will reject the new literal until this union is expanded. US2 work can start in parallel immediately (fully independent).

**⚠️ CRITICAL**: T003 and T006 cannot start until T002 is complete.

- [x] T002 Expand `NoteOutcome` type union to add `'auto-advanced'` variant in `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

**Checkpoint**: Foundation ready — US1 and US2 can now proceed independently (in parallel if staffed).

---

## Phase 3: User Story 1 — HL+HR chord retry (Priority: P1) 🎯 MVP

**Goal**: A student can fail a two-hand chord beat and (a) retry it correctly as many times as needed, with still-held keys from the other hand counted towards the chord; and (b) auto-advance past the beat after 3 consecutive wrong presses, recorded as a failure.

**Independent Test**: Load a score with an HL+HR chord beat. Fail it intentionally (wrong notes → 3× WRONG_MIDI); verify auto-advance. Then fail it once with EARLY_RELEASE; keep LH held; re-press RH only; verify the chord is now accepted and the session advances.

### Tests for US1 ⚠️ Write FIRST — verify FAIL before T005–T007 (Principles V & VII)

- [x] T003 [P] [US1] Write failing regression test: `WRONG_MIDI` dispatched `MAX_CONSECUTIVE_WRONG` times produces `'auto-advanced'` outcome and advances `currentIndex` in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [x] T004 [P] [US1] Write failing regression test: after `EARLY_RELEASE`, re-pressing only the released note while remaining required notes are still held completes the chord in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for US1

- [x] T005 [P] [US1] Export `MAX_CONSECUTIVE_WRONG = 3` constant alongside `LATE_THRESHOLD_MS` in `frontend/plugins/practice-view-plugin/practiceEngine.ts`
- [x] T006 [US1] Add auto-advance logic to `WRONG_MIDI` reducer case: when `currentWrongAttempts + 1 >= MAX_CONSECUTIVE_WRONG`, append `{ outcome: 'auto-advanced', ... }` result and advance `currentIndex` in `frontend/plugins/practice-view-plugin/practiceEngine.ts`
- [x] T007 [US1] Fix `ChordDetector` pin logic in the `useEffect` (deps: `[practiceState.currentIndex, practiceState.mode]`): replace `prevPitches`-scoped loop with a loop over `[...onset, ...sustained]` that pins every pitch present in `heldMidiKeysRef.current` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: User Story 1 complete — retry and auto-advance both working. T003 and T004 must now pass green.

---

## Phase 4: User Story 2 — Staccato chord detection (Priority: P2)

**Goal**: Staccato-marked notes in any loaded score are extracted with `durationTicks = 0`, so the engine advances immediately on correct pitch detection without entering `'holding'` mode.

**Independent Test**: Call `extractPracticeNotes()` with a mock score containing staccato-marked notes; verify returned entries have `durationTicks === 0` (not the previously-halved positive value).

### Tests for US2 ⚠️ Write FIRST — verify FAIL before T009 (Principles V & VII)

- [x] T008 [US2] Write failing regression test: staccato-flagged note entries returned by `extractPracticeNotes()` have `durationTicks === 0` in `frontend/src/plugin-api/scorePlayerContext.test.ts`

### Implementation for US2

- [x] T009 [US2] Fix staccato extraction rule: replace `entry.durationTicks = Math.round(entry.durationTicks * 0.5)` with `entry.durationTicks = 0` for staccato entries in `frontend/src/plugin-api/scorePlayerContext.ts`

**Checkpoint**: User Story 2 complete — staccato chords advance immediately on correct pitch. T008 must now pass green.

---

## Phase 5: User Story 3 — Cross-articulation session continuity (Priority: P3)

**Goal**: Confirm the US1 and US2 fixes compose correctly with no regressions for single-note beats or sustained (non-staccato) chords.

**Independent Test**: Full Vitest suite passes green (T003, T004, T008 newly green; all pre-existing tests still green). TypeScript build completes with zero errors.

- [x] T010 [US3] Run `npx vitest run` in `frontend/` — all tests must pass including T003, T004, T008 newly green and zero pre-existing regressions
- [x] T011 [P] [US3] Run `npm run build` in `frontend/` — zero TypeScript errors (validates `NoteOutcome` expansion from T002 composes cleanly with all usages)

**Checkpoint**: All three user stories independently functional and composed correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Manual acceptance validation against the full acceptance checklist.

- [x] T012 [P] Execute all 7 manual acceptance checklist items in `specs/001-fix-practice-midi-detection/quickstart.md` — verify staccato, HL+HR retry, auto-advance, regression, and build scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: No dependencies — can run in parallel with T001.
- **User Story 1 (Phase 3)**: T002 must complete before T003 and T006. T005 and T004 have no dependency on T002 and can start in parallel.
- **User Story 2 (Phase 4)**: Fully independent — can start immediately after T001 (no dependency on US1 or T002).
- **User Story 3 (Phase 5)**: T006, T007, and T009 must all complete before T010/T011.
- **Polish (Phase 6)**: T010 and T011 must both pass before T012.

### Detailed Task Dependencies

| Task | Depends On | Reason |
|------|-----------|--------|
| T001 | — | Baseline |
| T002 | T001 ✓ | Type union expansion |
| T003 | T002 | Test references `'auto-advanced'` TypeScript literal — needs union expanded |
| T004 | T001 ✓ | PracticeViewPlugin test; independent of NoteOutcome type change |
| T005 | T001 ✓ | Constant-only export; no type dependency |
| T006 | T002, T005; T003 FAIL confirmed | Needs type + constant; test-first gate must be observed |
| T007 | T001 ✓; T004 FAIL confirmed | Test-first gate must be observed |
| T008 | T001 ✓ | scorePlayerContext is fully independent of practice engine |
| T009 | T008 FAIL confirmed | Test-first gate must be observed |
| T010 | T006, T007, T009 | Full suite pass only after all three fixes |
| T011 | T002, T006, T007, T009 | Build validation after all changes |
| T012 | T010, T011 | Manual acceptance after all automated gates pass |

### User Story Dependencies

- **US1 (P1)**: Depends on T002 (type expansion). Independent of US2.
- **US2 (P2)**: Fully independent — no dependency on US1 or T002.
- **US3 (P3)**: Depends on US1 (T006, T007) and US2 (T009) completion.

---

## Parallel Execution Examples

### Phase 2 + Phase 4 startup in parallel (different files, no shared deps)

```
T002  — Expand NoteOutcome type in practiceEngine.types.ts
T008  — Write failing staccato test in scorePlayerContext.test.ts
```

### Phase 3 tests in parallel (after T002; different test files)

```
T003  — Write failing auto-advance test in practiceEngine.test.ts
T004  — Write failing pin retry test in PracticeViewPlugin.test.tsx
T005  — Export MAX_CONSECUTIVE_WRONG in practiceEngine.ts
```

### Phase 3 + Phase 4 implementation in parallel (after respective tests fail)

```
T006  — Add auto-advance to WRONG_MIDI case in practiceEngine.ts      (after T003 FAILS)
T007  — Fix pin logic in PracticeViewPlugin.tsx                        (after T004 FAILS)
T009  — Fix staccato extraction in scorePlayerContext.ts               (after T008 FAILS)
```

### Phase 5 validation in parallel

```
T010  — Run full Vitest suite
T011  — Run npm run build
```

---

## Implementation Strategy

### MVP Scope (Phase 3 only — US1)

After T001 + T002, deliver US1 independently:

```
T003 + T004 + T005  [parallel] → T006 + T007  [T006 depends on T003/T005, T007 depends on T004]
```

This fixes the session-ending HL+HR chord retry bug (SC-001, SC-004) and adds auto-advance exit (FR-003a, SC-006). A student can complete a two-hand practice session without getting stuck. Sufficient for a first deployment.

### Incremental Delivery

1. **Iteration 1 (MVP)**: T001 → T002 → T003+T004+T005 → T006+T007 → partial T010
2. **Iteration 2**: T008 → T009 → T010 full + T011
3. **Iteration 3**: T012 (acceptance handoff)

### Test-First Discipline (non-negotiable — Principles V & VII)

For each implementation task, strictly observe:

```
1. Write test  →  2. Confirm test FAILS  →  3. Implement fix  →  4. Confirm test PASSES
```

A test that passes before the fix is written wrong. Do not skip step 2.

---

## Format Validation

All tasks follow the required checklist format:

- ✅ `- [ ] T001 …` — checkbox + ID + description + implied file path
- ✅ `- [ ] T003 [P] [US1] …` — checkbox + ID + parallel marker + story label + description + explicit file path
- ✅ `- [ ] T008 [US2] …` — checkbox + ID + story label + description + explicit file path

**Task count summary**:

| Scope | Tasks | Notes |
|-------|-------|-------|
| Setup | 1 (T001) | No story label |
| Foundational | 1 (T002) | No story label |
| US1 (P1 — MVP) | 5 (T003–T007) | 2 tests [P], 1 constant [P], 2 impl |
| US2 (P2) | 2 (T008–T009) | 1 test, 1 impl |
| US3 (P3) | 2 (T010–T011) | 1 suite run, 1 [P] build check |
| Polish | 1 (T012) | [P] manual acceptance |
| **Total** | **12** | **6 parallelisable [P]** |
