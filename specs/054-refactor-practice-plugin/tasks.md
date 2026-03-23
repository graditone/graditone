# Tasks: Refactor Practice Plugin into Modular Architecture

**Input**: Design documents from `/specs/054-refactor-practice-plugin/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Smoke tests included per FR-015 — one `renderHook()` test per extracted hook verifying return type shape.

**Organization**: Tasks grouped by user story (spec.md priorities P1→P2→P3). Each extraction is one commit with full test suite verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Move shared types out of monolith and prepare the extraction foundation

- [ ] T001 Move `PerformanceRecord` and `PartialPerformanceRecord` type definitions from `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (L46-61) to `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` and update imports in PracticeViewPlugin.tsx
- [ ] T002 Run full test suite (`cd frontend && npx vitest run`) to confirm type move introduces no regressions

---

## Phase 2: User Story 2 - Isolated Loop Region Logic (Priority: P1)

**Goal**: Extract `usePracticeLoop` hook containing loop pin state, loop region memos, multi-loop counters, and `handleNoteLongPress` into a dedicated file.

**Independent Test**: `usePracticeLoop` can be tested with `renderHook()` in isolation; all existing loop-related test cases still pass.

### Implementation for User Story 2

- [ ] T003 [US2] Create `frontend/plugins/practice-view-plugin/usePracticeLoop.ts` with `UsePracticeLoopParams` / `UsePracticeLoopReturn` interfaces per contracts/usePracticeLoop.d.ts. Extract from PracticeViewPlugin.tsx: state (`loopCount`, `remainingLoopsRef`, `loopIterationRef`, `loopStartTimesRef`, `loopStart`, `loopEndPin` — L207-216, L283-284), memos (`pinnedNoteIds`, `loopRegion`, `loopPracticeRange` — L286-322), refs (`loopRegionRef`, `loopPracticeRangeRef` — L303, L325), effect (loop-restart on complete — L219-243), callback (`handleNoteLongPress` — L1012-1051). Add `resetLoopTracking()` callback per R-005.
- [ ] T004 [US2] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import and call `usePracticeLoop()`, replacing all extracted inline state/memos/effects/callbacks with destructured return values. Wire `onComplete` and `onResultsShow` callbacks to set `performanceRecord` and `resultsOverlayVisible`.
- [ ] T005 [US2] Create smoke test in `frontend/plugins/practice-view-plugin/usePracticeLoop.test.ts` using `renderHook()` — verify all return keys present (`loopRegion`, `loopRegionRef`, `pinnedNoteIds`, `loopPracticeRange`, `handleNoteLongPress`, `resetLoopTracking`, `loopCount`, `setLoopCount`, `loopStart`, `loopEndPin`, `loopIterationRef`, `loopStartTimesRef`, `remainingLoopsRef`, `loopPracticeRangeRef`)
- [ ] T006 [US2] Run full test suite (`cd frontend && npx vitest run`) — all 1636+ tests must pass. Commit: `refactor(practice): extract usePracticeLoop hook`

**Checkpoint**: Loop logic isolated. `usePracticeLoop` produces refs consumed by next extraction.

---

## Phase 3: User Story 1 - Focused MIDI Logic Module (Priority: P1)

**Goal**: Extract `usePracticeMidi` hook containing MIDI subscription, chord detector management, and all MIDI-related state into a dedicated file.

**Independent Test**: All existing MIDI-related test cases pass without modification to test logic.

### Implementation for User Story 1

- [X] T007 [US1] Create `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` with `UsePracticeMidiParams` / `UsePracticeMidiReturn` interfaces per contracts/usePracticeMidi.d.ts. Extract from PracticeViewPlugin.tsx: state (`midiPressedNoteIds`, `midiEventTick` — L568, L571), refs (`chordDetectorRef`, `prevPracticeIndexRef`, `heldMidiKeysRef`, `allNotesRef`, `prevLoadKeyRef` — L478-479, L544-548, L577), effects (chord detector reset — L481-538, all-notes rebuild — L549-565, teardown — L580-591, MIDI subscription — L594-801, staff count reset — L804-808). Accept loop refs from usePracticeLoop via params.
- [X] T008 [US1] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import and call `usePracticeMidi()`, replacing all extracted inline state/refs/effects with destructured return values. Thread `loopRegionRef`, `loopPracticeRangeRef`, `loopIterationRef`, `loopStartTimesRef` from usePracticeLoop, and `practiceStateRef`, `playerStateRef`, `practiceStartTimeRef` from orchestrator.
- [X] T009 [US1] Create smoke test in `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts` using `renderHook()` — verify all return keys present (`midiPressedNoteIds`, `midiEventTick`, `heldMidiKeysRef`, `chordDetectorRef`)
- [X] T010 [US1] Run full test suite (`cd frontend && npx vitest run`) — all 1636+ tests must pass. Commit: `refactor(practice): extract usePracticeMidi hook`

**Checkpoint**: MIDI logic isolated. Both P1 hooks extracted. MIDI state (`midiPressedNoteIds`, `midiEventTick`, `heldMidiKeysRef`) now available as return values for downstream consumers.

---

## Phase 4: User Story 3 - Separated Results Overlay (Priority: P2)

**Goal**: Extract `ResultsOverlay` component containing practice report memos, results JSX, replay callbacks, and error flash logic into a dedicated file.

**Independent Test**: `ResultsOverlay` can be rendered in isolation with mock props; all existing results-display and replay tests pass.

### Implementation for User Story 3

- [X] T011 [US3] Create `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` per contracts/ResultsOverlay.d.ts. Move from PracticeViewPlugin.tsx: helpers (`midiToLabel` L68-72, `formatTimeMs` L74-78), state (`errorNoteIds`, `errorFlashTimerRef` — L194-195), memos (`practiceReport` — L1286-1321, `partialReport` — L1324-1365), effect (error flash auto-advance — L246-263), callbacks (`handleReplayStop` — L1070-1076, `handleReplay` — L1078-1145, `handleRepractice` — L1147-1159), JSX (complete results overlay — L1494-1807, partial results overlay — L1808-1893). Accept replay state (`isReplaying`, `replayHighlightedNoteIds`, `setIsReplaying`, `setReplayHighlightedNoteIds`) as props from orchestrator.
- [X] T012 [US3] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import `ResultsOverlay` and replace inline results JSX with `<ResultsOverlay ... />` component usage. Keep `isReplaying` and `replayHighlightedNoteIds` state in orchestrator, pass as props. Wire `onRepractice` to `handlePracticeToggle` and `onDismiss` to close overlay.
- [X] T013 [US3] Create smoke test in `frontend/plugins/practice-view-plugin/ResultsOverlay.test.tsx` — render with mock props and verify it mounts without errors, renders results container element
- [X] T014 [US3] Run full test suite (`cd frontend && npx vitest run`) — all tests must pass. Commit: `refactor(practice): extract ResultsOverlay component`

**Checkpoint**: Results overlay isolated. ~400 lines of JSX + logic moved out of orchestrator.

---

## Phase 5: User Story 4 - Focused Highlight Computation (Priority: P2)

**Goal**: Extract `usePracticeHighlights` hook containing target/confirmed note ID computation, confirmed index tracking, and pitch label memos into a dedicated file.

**Independent Test**: `usePracticeHighlights` can be tested with `renderHook()` given mock practice/player state; all existing highlight tests pass.

### Implementation for User Story 4

- [ ] T015 [US4] Create `frontend/plugins/practice-view-plugin/usePracticeHighlights.ts` with `UsePracticeHighlightsParams` / `UsePracticeHighlightsReturn` interfaces per contracts/usePracticeHighlights.d.ts. Extract from PracticeViewPlugin.tsx: refs (`prevCompletedEntryRef`, `confirmedIndexRef` — L471-472), derived (`practiceActive`, `practiceWaiting` — L1165-1166), memos (`targetNoteIds` — L1185-1190, `confirmedNoteIds` — L1196-1267, `pressedPitchLabels` — L1271-1275, `expectedPitchLabels` — L1277-1281), derived (`highlightedNoteIds` — L1168-1176). Accept `midiPressedNoteIds`, `midiEventTick`, `heldMidiKeysRef` from usePracticeMidi and `phantomIndex` from usePhantomTempo and `isReplaying`, `replayHighlightedNoteIds` from orchestrator via params.
- [ ] T016 [US4] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import and call `usePracticeHighlights()`, replacing all extracted inline refs/memos/derived values with destructured return values
- [ ] T017 [US4] Create smoke test in `frontend/plugins/practice-view-plugin/usePracticeHighlights.test.ts` using `renderHook()` — verify all return keys present (`targetNoteIds`, `confirmedNoteIds`, `pressedPitchLabels`, `expectedPitchLabels`, `highlightedNoteIds`, `practiceActive`, `practiceWaiting`)
- [ ] T018 [US4] Run full test suite (`cd frontend && npx vitest run`) — all tests must pass. Commit: `refactor(practice): extract usePracticeHighlights hook`

**Checkpoint**: Highlight computation isolated. Both P2 modules extracted.

---

## Phase 6: User Story 5 - Isolated Phantom Tempo and Hold Progress (Priority: P3)

**Goal**: Extract `usePhantomTempo` and `useHoldProgress` hooks — the smallest extraction targets (~70 and ~55 lines respectively) — completing the decomposition.

**Independent Test**: Each hook can be tested with `renderHook()` in isolation. Existing phantom tempo and hold progress tests pass unchanged.

### Implementation for User Story 5

- [ ] T019 [US5] Create `frontend/plugins/practice-view-plugin/usePhantomTempo.ts` with `UsePhantomTempoParams` / `UsePhantomTempoReturn` interfaces per contracts/usePhantomTempo.d.ts. Extract from PracticeViewPlugin.tsx: state (`phantomIndex` — L395), refs (`phantomTimerRef`, `phantomStartTimeRef`, `phantomNotesRef`, `phantomBpmRef`, `phantomBaseTickRef` — L396-400), effects (start/stop timer — L404-454, cleanup — L457-464). Accept `practiceState`, `practiceStateRef`, `playerStateRef` as params.
- [ ] T020 [US5] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import and call `usePhantomTempo()`, replacing all extracted inline state/refs/effects with destructured return value (`phantomIndex`)
- [ ] T021 [P] [US5] Create smoke test in `frontend/plugins/practice-view-plugin/usePhantomTempo.test.ts` using `renderHook()` — verify return type shape (`phantomIndex` is a number)
- [ ] T022 [US5] Run full test suite (`cd frontend && npx vitest run`) — all tests must pass. Commit: `refactor(practice): extract usePhantomTempo hook`
- [ ] T023 [US5] Create `frontend/plugins/practice-view-plugin/useHoldProgress.ts` with `UseHoldProgressParams` / `UseHoldProgressReturn` interfaces per contracts/useHoldProgress.d.ts. Extract from PracticeViewPlugin.tsx: state (`holdProgress`, `rafRef` — L131-132), effects (rAF loop — L337-373, cleanup — L376-383). Accept `practiceState` and `dispatchPractice` as params.
- [ ] T024 [US5] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to import and call `useHoldProgress()`, replacing all extracted inline state/effects with destructured return value (`holdProgress`)
- [ ] T025 [P] [US5] Create smoke test in `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts` using `renderHook()` — verify return type shape (`holdProgress` is a number)
- [ ] T026 [US5] Run full test suite (`cd frontend && npx vitest run`) — all tests must pass. Commit: `refactor(practice): extract useHoldProgress hook`

**Checkpoint**: All 6 extractions complete. PracticeViewPlugin.tsx is now a thin orchestrator.

---

## Phase 7: User Story 6 - Clean Orchestrator (Priority: P3)

**Goal**: Verify the orchestrator is clean, verify line count, run full validation suite including E2E.

**Independent Test**: PracticeViewPlugin.tsx is ~800-900 lines. Full test suite (unit + E2E) passes.

### Implementation for User Story 6

- [ ] T027 [US6] Verify `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` line count is ≤ 900 lines (`wc -l`). If over, identify any remaining extractable code and refine.
- [ ] T028 [US6] Verify acyclic module dependency graph — confirm no extracted hook/component imports another (only orchestrator imports all modules) by checking import statements in all 6 new files
- [ ] T029 [US6] Run TypeScript build check (`cd frontend && npx tsc --noEmit`) — must complete with zero errors
- [ ] T030 [US6] Run full E2E test suite (`cd frontend && npx playwright test`) — all E2E tests must pass
- [ ] T031 [US6] Verify hook call order in orchestrator matches original declaration order: `useHoldProgress` → `usePracticeLoop` → `usePhantomTempo` → `usePracticeMidi` → `usePracticeHighlights` (per R-006)

**Checkpoint**: All success criteria (SC-001 through SC-007) verified.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and final cleanup

- [ ] T032 [P] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` top-of-file comment to describe its role as orchestrator and list imported modules
- [ ] T033 [P] Update `FEATURES.md` if practice-view-plugin architecture is documented there
- [ ] T034 Run quickstart.md validation checklist (all 8 items) in `specs/054-refactor-practice-plugin/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — move shared types first
- **US2 / usePracticeLoop (Phase 2)**: Depends on Setup — extracted first because it produces refs consumed by MIDI
- **US1 / usePracticeMidi (Phase 3)**: Depends on US2 — consumes `loopRegionRef`, `loopPracticeRangeRef`, `loopIterationRef`, `loopStartTimesRef`
- **US3 / ResultsOverlay (Phase 4)**: Depends on Setup (types moved) — independent from US1/US2
- **US4 / usePracticeHighlights (Phase 5)**: Depends on US1 (consumes `midiPressedNoteIds`, `heldMidiKeysRef`) — must follow MIDI extraction
- **US5 / usePhantomTempo + useHoldProgress (Phase 6)**: Depends on Setup only — no hook dependencies, but sequenced after US4 for incremental verification
- **US6 / Clean Orchestrator (Phase 7)**: Depends on ALL extractions complete
- **Polish (Phase 8)**: Depends on US6 verification complete

### User Story Dependencies

- **US2 (Loop)**: No hook dependencies → extracted FIRST
- **US1 (MIDI)**: Depends on US2 refs → extracted SECOND
- **US3 (Results)**: Independent of hooks → can be extracted after US1 or in parallel if different files
- **US4 (Highlights)**: Depends on US1 return values → extracted after MIDI
- **US5 (Phantom + Hold)**: Independent → last due to lowest priority and simplicity
- **US6 (Orchestrator)**: Depends on all above → final verification phase

### Within Each User Story

1. Create new hook/component file with interfaces and extracted logic
2. Update orchestrator to import and call the new module
3. Write smoke test
4. Run full test suite — commit only on green

### Parallel Opportunities

- T021 and T025 (smoke tests for phantom tempo and hold progress) can be written in parallel since they target different files
- T032 and T033 (documentation updates) can be done in parallel
- Within Phase 6: usePhantomTempo (T019-T022) and useHoldProgress (T023-T026) touch different code sections but are sequenced for incremental safety per spec constraint

---

## Parallel Example: User Story 5 (Phantom + Hold)

```text
# These smoke tests can be written in parallel (different files):
T021: smoke test for usePhantomTempo in usePhantomTempo.test.ts
T025: smoke test for useHoldProgress in useHoldProgress.test.ts

# These documentation tasks can be done in parallel:
T032: Update orchestrator file comment
T033: Update FEATURES.md
```

---

## Implementation Strategy

### MVP Scope
**User Story 2 (Loop) + User Story 1 (MIDI)** = Phase 2 + Phase 3 (T003-T010)

This extracts the two largest and most complex subsystems (~370 lines combined), delivering the highest-value decomposition. The orchestrator drops from 1895 to ~1525 lines, and the two most bug-prone subsystems become independently reviewable.

### Incremental Delivery
Each phase produces a working, fully-tested commit:
1. **After Phase 1**: Types moved, baseline green ✅
2. **After Phase 2**: Loop extracted (~120 lines out), green ✅
3. **After Phase 3**: MIDI extracted (~250 lines out), green ✅
4. **After Phase 4**: Results extracted (~500 lines out), green ✅
5. **After Phase 5**: Highlights extracted (~100 lines out), green ✅
6. **After Phase 6**: Phantom + Hold extracted (~125 lines out), green ✅
7. **After Phase 7**: Final verification, all SC criteria met ✅
8. **After Phase 8**: Documentation updated, ready for PR ✅
