# Tasks: Practice Replay

**Input**: Design documents from `/specs/038-practice-replay/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/replay-scheduling.md ✅ | quickstart.md ✅
**Tests**: Tests are included (Vitest + RTL — existing test suite for the plugin).
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent logic)
- **[Story]**: Which user story this task belongs to
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: No new dependencies or project structure needed. This phase confirms the existing test infrastructure is in place and the development environment is ready.

- [X] T001 Verify test suite runs for practice-view-plugin: `cd frontend && npx vitest run plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

**Checkpoint**: All existing tests pass. Ready to implement.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Define the `PerformanceRecord` type and snapshot-capture logic — both User Stories depend on this data structure being available in `PracticeViewPlugin.tsx`.

- [X] T002 Define `PerformanceRecord` interface (inline in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`): fields `notes: PracticeNoteEntry[]`, `noteResults: PracticeNoteResult[]`, `bpmAtCompletion: number`
- [X] T003 Add `performanceRecord` state (`useState<PerformanceRecord | null>(null)`) in `PracticeViewPlugin.tsx`
- [X] T004 Add `replayTimersRef` (`useRef<ReturnType<typeof setTimeout>[]>([])`) in `PracticeViewPlugin.tsx` for timer management
- [X] T005 Extend the existing `useEffect` that watches `practiceState.mode === 'complete'` in `PracticeViewPlugin.tsx` to snapshot `PerformanceRecord`: capture `practiceState.notes`, `practiceState.noteResults`, and `playerState.bpm * tempoMultiplier` into `performanceRecord` state; reset `isReplaying` to `false`

**Checkpoint**: `PerformanceRecord` is captured when an exercise completes. Ready for user story implementation.

---

## Phase 3: User Story 1 — Replay Performance from Results Screen (Priority: P1) 🎯 MVP

**Goal**: Replay button appears on results screen after exercise completion. Pressing it plays back the user's captured notes with staff highlighting. Stop button halts replay immediately. Natural end of playback auto-restores the results screen. All existing results controls remain visible throughout.

**Independent Test**: Complete a practice exercise → results screen appears → Replay button visible → press Replay → audio starts → Stop button visible → press Stop → Replay button restored. All stats (score, breakdown) visible throughout.

### Tests for User Story 1

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T006 [P] [US1] Write test: Replay button visible after exercise completion in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — render component in `mode: 'complete'` with non-empty `noteResults`; assert Replay button is present
- [X] T007 [P] [US1] Write test: Replay button absent when `noteResults` empty in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — render with `mode: 'complete'` but no results; assert Replay button is not rendered (FR-009)
- [X] T008 [P] [US1] Write test: Replay button replaced by Stop button when Replay is pressed in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — press Replay; assert Stop button present, Replay button absent (FR-003)
- [X] T009 [P] [US1] Write test: Stop button cancels playback and restores Replay button in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — press Replay → press Stop; assert `context.stopPlayback()` called; Replay button restored (FR-003, FR-004 via stop path)
- [X] T010 [P] [US1] Write test: `context.playNote` called N times with correct `offsetMs` when Replay pressed in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — verify N `playNote` calls with staggered offsets matching `i × (60_000 / bpmAtCompletion)` (FR-002, FR-010, Contract 1)
- [X] T011 [P] [US1] Write test: BPM frozen at exercise completion — BPM changes after completion; press Replay; assert `offsetMs` values reflect original BPM, not new value (Q5 clarification)
- [X] T012 [P] [US1] Write test: Replay button restored after natural end — press Replay; fast-forward finish timer; assert `context.stopPlayback()` called and Replay button reappears (FR-004, Contract 3)
- [X] T013 [P] [US1] Write test: unmount during replay clears all timers — press Replay; unmount component; no pending state updates after unmount (FR-008, Contract 5)

### Implementation for User Story 1

- [X] T014 [US1] Add `isReplaying` state (`useState(false)`) and `replayHighlightedNoteIds` state (`useState<ReadonlySet<string>>(new Set())`) in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T015 [US1] Implement `handleReplay` callback in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: schedule N `context.playNote` calls with staggered `offsetMs = i × msPerBeat`; schedule per-note highlight `setTimeout`s; schedule finish timer; set `isReplaying(true)` (Contracts 1 & 2 & 3)
- [X] T016 [US1] Implement `handleReplayStop` callback in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: call `context.stopPlayback()`; clear all `replayTimersRef` handles; reset `replayHighlightedNoteIds` to empty Set; set `isReplaying(false)` (Contract 4)
- [X] T017 [US1] Add replay cleanup to the existing unmount `useEffect` (SC-006 teardown) in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: call `handleReplayStop` logic if `isReplaying` OR clear `replayTimersRef` unconditionally (Contract 5, FR-008)
- [X] T018 [US1] Add Replay/Stop button to the results overlay in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: render Replay button when `performanceRecord && !isReplaying`; render Stop button when `isReplaying`; both in-place within existing results overlay layout (FR-001, FR-003, FR-009)
- [X] T019 [US1] Wire `replayHighlightedNoteIds` into `ScoreRenderer` `highlightedNoteIds` prop in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`: merge with existing highlight logic — during replay, `replayHighlightedNoteIds` takes priority over `playerState.highlightedNoteIds` (FR-005)

**Checkpoint**: User Story 1 is fully functional and independently testable. All 8 tests (T006–T013) should pass.

---

## Phase 4: User Story 2 — Replay Reflects What the User Actually Played (Priority: P2)

**Goal**: Verify that audio playback uses `playedMidi` (actual captured pitch) while staff highlighting uses the expected `noteIds` — so wrong notes are audible but the staff shows what was expected.

**Independent Test**: Complete exercise deliberately playing wrong notes → press Replay → audio emits the wrong pitches → staff highlights advance through expected note positions (not actual pitch positions).

### Tests for User Story 2

> **Write these tests FIRST — ensure they FAIL before implementation**

- [X] T020 [P] [US2] Write test: `playNote` uses `playedMidi` not expected `midiPitches[0]` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — result has `playedMidi = 61`, expected = 60; press Replay; assert `playNote` called with `midiNote: 61` (FR-006, Contract 1 constraint)
- [X] T021 [P] [US2] Write test: staff highlight uses expected `noteIds` regardless of wrong pitch in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx` — result has wrong `playedMidi`; replay highlight timer fires; assert `replayHighlightedNoteIds` contains `notes[result.noteIndex].noteIds` not a derived pitch-based id (FR-005, Contract 2 constraint)

### Implementation for User Story 2

- [X] T022 [US2] Verify `handleReplay` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` passes `result.playedMidi` to `context.playNote` (not `performanceRecord.notes[i].midiPitches[0]`)  — this is a correctness check/fix of T015 if not already correct; confirm Contract 1 constraint is satisfied
- [X] T023 [US2] Verify highlight timer in `handleReplay` resolves `noteIds` from `performanceRecord.notes[result.noteIndex].noteIds` (expected note position) not from any derived pitch data — confirm Contract 2 constraint is satisfied

**Checkpoint**: User Stories 1 AND 2 both pass. Full feature is complete and independently verified.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: CSS styling for Replay/Stop button, CSS class for replay mode on root element, and final validation.

- [X] T024 Add CSS for `.practice-results__replay-btn` and `.practice-results__replay-btn--stop` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.css` — style consistent with existing results overlay buttons
- [X] T025 [P] Run full plugin test suite and verify all tests pass: `cd frontend && npx vitest run plugins/practice-view-plugin/`
- [X] T026 [P] Manually smoke-test replay flow in dev server: complete exercise → Replay → audio plays → Stop → results screen restored → Replay works again

**Checkpoint**: Feature complete, tested, and visually polished.

---

## Phase 6: Real-Tempo Replay + Wrong Note Capture (Phase A+B)

**Purpose**: Replace metronomic replay with faithful reproduction of the user's actual performance — real timing from `responseTimeMs` and wrong note audio interleaved chronologically.

### Phase A — Real-Tempo Replay (no engine changes)

- [X] T027 Update `handleReplay` in `PracticeViewPlugin.tsx`: replace `offsetMs: i * msPerBeat` with `offsetMs: result.responseTimeMs` for both `playNote` and highlight timers; update finish timer to use last note's `responseTimeMs + msPerNote + 300`
- [X] T028 [P] Update test T010 to verify `offsetMs` matches `responseTimeMs` instead of `i * msPerBeat`
- [X] T029 [P] Update test T011 (BPM-frozen) — BPM freeze still applies to `msPerNote` duration but `offsetMs` now comes from `responseTimeMs`
- [X] T030 [P] Update test T012 (natural end) — finish timer now based on last `responseTimeMs` + duration + buffer

### Phase B — Wrong Note Capture in Engine

- [X] T031 Add `WrongNoteEvent` interface to `practiceEngine.types.ts`: `{ midiNote: number; responseTimeMs: number; noteIndex: number }`
- [X] T032 Add `wrongNoteEvents: ReadonlyArray<WrongNoteEvent>` to `PracticeState` interface in `practiceEngine.types.ts`; update `INITIAL_PRACTICE_STATE`
- [X] T033 Extend `WRONG_MIDI` action in `PracticeAction` union to include `responseTimeMs: number`
- [X] T034 Update `reduce()` `WRONG_MIDI` case in `practiceEngine.ts`: append `WrongNoteEvent` to `wrongNoteEvents` array (in addition to incrementing counter); reset `wrongNoteEvents` in `START` and `STOP`
- [X] T035 Update `WRONG_MIDI` dispatch in `PracticeViewPlugin.tsx` MIDI handler to pass `responseTimeMs: Date.now() - practiceStartTimeRef.current`
- [X] T036 Add `wrongNoteEvents` to `PerformanceRecord` interface and capture in the `mode === 'complete'` useEffect
- [X] T037 [P] Write engine tests: `WRONG_MIDI` records `WrongNoteEvent` with correct `midiNote`, `responseTimeMs`, `noteIndex`; `START` resets `wrongNoteEvents`
- [X] T038 [P] Update existing engine tests that create state objects to include `wrongNoteEvents: []`

### Phase B — Wrong Notes in Replay

- [X] T039 Update `handleReplay` in `PracticeViewPlugin.tsx`: merge `noteResults` (correct) + `wrongNoteEvents` into a single timeline sorted by `responseTimeMs`; schedule all events via `playNote` with `offsetMs = event.responseTimeMs`; highlight timers only for correct notes
- [X] T040 [P] Write test: wrong notes are played at their original timestamp during replay — dispatch WRONG_MIDI events during practice, press Replay, verify `playNote` called with wrong pitch and correct `offsetMs`
- [X] T041 [P] Write test: wrong notes do NOT change staff highlight — only correct notes advance the highlight position
- [X] T042 Run full plugin test suite: `cd frontend && npx vitest run plugins/practice-view-plugin/`

**Checkpoint**: Replay faithfully reproduces the user's actual performance including wrong notes and real timing.

---

## Phase 7: Timing Deviation Graph Improvements

**Purpose**: Make the timing deviation graph in the results screen actually useful: show per-note incremental drift, map X to real seconds, and use an asymmetric Y axis.

- [X] T043 Fix timing graph from cumulative to incremental in `PracticeViewPlugin.tsx`: each data point shows `(actualInterval − expectedInterval)` between consecutive notes; first note anchored at 0
- [X] T044 Change X axis from note-index to real time in `PracticeViewPlugin.tsx`: `xScale` maps `responseTimeMs` to pixels; X ticks show seconds with a "nice" auto-selected interval (0.5s, 1s, 2s, 5s, 10s, …); dots and area fill also time-positioned
- [X] T045 Change Y axis to asymmetric in `PracticeViewPlugin.tsx`: `yMax = Math.max(maxDelay, 50)`, `yMin = Math.min(minDelay, -50)` — computed independently so negative region only covers actual negative values
- [X] T046 Clean up axis labels: `+{yMax}ms` at top, `0` at zero line, `{yMin}ms` at bottom; remove redundant duplicate labels that appeared outside the plotted area

**Checkpoint**: Graph shows actionable per-note drift over real time; both Y bounds match the actual data range.

---

## Dependency Graph

```
T001 (setup check)
  └─► T002–T005 (foundational: PerformanceRecord definition & capture)
        ├─► T006–T013 (US1 tests — write first, expect failure)
        │     └─► T014–T019 (US1 implementation — make tests pass)
        │           ├─► T020–T021 (US2 tests — write first, expect failure)
        │           │     └─► T022–T023 (US2 implementation — make tests pass)
        │           └─► T024–T026 (polish — CSS + verification)
        └── T020–T021 can be written in parallel with T014–T019 (test files only)
```

**Story dependencies**: US2 depends on US1 (the `handleReplay` callback from T015 must exist before T022 verifies its correctness). However, the US2 tests (T020, T021) can be written in parallel with US1 implementation since they only reference types, not the running component.

---

## Parallel Execution Examples

### Single developer (sequential)

```
T001 → T002 → T003 → T004 → T005 →
T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 →  [tests written, all failing]
T014 → T015 → T016 → T017 → T018 → T019 →                [US1 implementation — tests pass]
T020 → T021 →                                              [US2 tests written, may fail]
T022 → T023 →                                              [US2 correctness verified]
T024 → T025 → T026                                         [polish]
```

### Two developers in parallel (after T005)

```
Developer A: T006–T013 → T014–T019 → T025 → T026
Developer B: T020–T021  (write in parallel with A's T014–T019)
             T022–T023  (once T015 exists) → T024
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001)
2. Complete Phase 2 — Foundational (T002–T005)
3. Write US1 tests T006–T013 (all fail)
4. Implement T014–T019 (tests pass)
5. **STOP AND VALIDATE**: Replay button appears, audio plays, Stop works, all results visible
6. Add CSS polish (T024) and smoke-test (T025–T026)

### Incremental Delivery

1. Setup + Foundational → PerformanceRecord available
2. US1 implementation → Replay button fully functional (MVP deliverable)
3. US2 verification tasks → Confirms audio/visual correctness contract
4. Polish → Visually consistent

---

## Notes

- All tasks are in `frontend/plugins/practice-view-plugin/` — no backend changes, no new files outside that directory
- [P] tasks touch different concerns (tests vs implementation, CSS vs logic) and can be parallelised
- Test-first is REQUIRED per Constitution Principle V — write tests before implementation
- `replayTimersRef` MUST be cleared on both Stop and unmount (Contract 4 & 5) — failure causes orphaned state updates
- US2 tasks T022–T023 are verification tasks, not new code — they confirm the US1 implementation is correct per the contracts
- Suggested MVP scope: Phases 1–3 + T024 is a complete, shippable feature
