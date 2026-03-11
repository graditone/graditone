# Tasks: Score-Defined Tempo Configuration

**Input**: Design documents from `/specs/001-score-tempo/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — required by Constitution Principles V (Test-First) and VII (Regression Prevention), which apply to all bugs discovered during implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup

**Purpose**: Verify developer environment compiles end-to-end before any changes

- [X] T001 Verify build environment: `cargo check` in backend/ and `npm install` in frontend/ complete without errors

---

## Phase 2: Foundational — Backend Parser Fix

**Purpose**: Fix the 3-bug chain in the MusicXML importer so that `<sound tempo="..."/>` at measure level is correctly read and stored in the Score's `global_structural_events`. This is a prerequisite for correct E2E behavior in all user stories.

**⚠️ CRITICAL**: Write all tests first (red), then implement (green). All user story frontend changes can begin in parallel once T007 (WASM rebuild) is complete.

> **Tests — write first, verify they FAIL before implementing T005/T006**

- [X] T002 [P] Write failing Rust test `tempo_from_sound_element`: MusicXML with `<sound tempo="60"/>` at measure level → Score BPM = 60 in `backend/tests/musicxml/test_tempo_from_musicxml.rs`
- [X] T003 [P] Write failing Rust test `tempo_out_of_range_clamped`: `<sound tempo="5"/>` clamps to 20 BPM; `<sound tempo="500"/>` clamps to 400 BPM in `backend/tests/musicxml/test_tempo_from_musicxml.rs`
- [X] T004 [P] Write failing Rust test `tempo_missing_defaults_to_120`: MusicXML without `<sound>` → Score BPM = 120 (regression guard) in `backend/tests/musicxml/test_tempo_from_musicxml.rs`

> **Implementation — after tests fail as expected**

- [X] T005 [P] Fix `parse_measure()` `Event::Empty` arm for `b"sound"` to extract `tempo` attribute and assign to `doc.default_tempo` in `backend/src/domain/importers/musicxml/parser.rs`
- [X] T006 [P] Add `doc.default_tempo = doc.default_tempo.clamp(20.0, 400.0)` before `BPM::new()` call in `backend/src/domain/importers/musicxml/converter.rs`
- [X] T007 Rebuild WASM after backend changes: `wasm-pack build --target web --out-dir ../frontend/src/wasm` in `backend/`

**Checkpoint**: `cargo test musicxml` passes (T002–T004 green). WASM rebuilt. Frontend can now receive real score tempo via the WASM pipeline.

---

## Phase 3: User Story 1 — Playback Starts at the Score's Tempo (Priority: P1) 🎯 MVP

**Goal**: When a score is loaded, the playback engine starts at the tempo embedded in the score, not at the hardcoded 120 BPM default.

**Independent Test**: Load the Chopin Nocturne Op.9 No.2 from the catalogue → tempo indicator shows 60 BPM → press Play → audio plays at 60 BPM.

> **Tests — write first, verify they FAIL before implementing T010/T011**

- [X] T008 [P] [US1] Write failing Vitest test: after `loadScore()` with a score containing a 66 BPM marking, `state.bpm === 66` (not 120) in `frontend/src/plugin-api/scorePlayerContext.test.ts`
- [X] T009 [P] [US1] Write failing Vitest test: after `loadScore()` with a score containing no tempo marking, `state.bpm === 120` (fallback regression guard) in `frontend/src/plugin-api/scorePlayerContext.test.ts`

> **Implementation — after tests fail as expected**

- [X] T010 [P] [US1] Call `setOriginalTempo(parsedTempo)` immediately after `setScoreTempo(parsedTempo)` inside `loadScore()` in `frontend/src/plugin-api/scorePlayerContext.ts`
- [X] T011 [P] [US1] Add `useEffect` that calls `setOriginalTempo(initialTempo)` whenever `score` or `initialTempo` changes in `frontend/src/components/ScoreViewer.tsx`

**Checkpoint**: Vitest passes for T008–T009. Load Chopin Nocturne → displays 60 BPM. User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 — Snap-to-Score Tempo After Manual Adjustment (Priority: P2)

**Goal**: After manually changing the playback tempo, a single "snap" action instantly resets both the base BPM and the multiplier to 1.0×, returning to the score's marked tempo.

**Independent Test**: Load any non-120 BPM score → change tempo → call `snapToScoreTempo()` → `state.bpm` returns to the score's marked BPM and multiplier is 1.0×.

> **Test — write first, verify it FAILS before implementing T013–T015**

- [X] T012 [US2] Write failing Vitest test: after `loadScore()` (90 BPM score) and `setTempoMultiplier(0.5)`, calling `snapToScoreTempo()` yields `state.bpm === 90` and `tempoMultiplier === 1.0` in `frontend/src/plugin-api/scorePlayerContext.test.ts`

> **Implementation — after test fails as expected**

- [X] T013 [US2] Add `snapToScoreTempo(): void` to `PluginScorePlayerContext` interface in `frontend/src/plugin-api/types.ts` (see `contracts/plugin-api-delta.md` for exact signature and placement)
- [X] T014 [US2] Implement `snapToScoreTempo` callback delegating to `resetTempo()` from `useTempoState()`, and expose it in the returned API object inside `useScorePlayerBridge()` in `frontend/src/plugin-api/scorePlayerContext.ts`
- [X] T015 [P] [US2] Add `snapToScoreTempo: () => {}` no-op to `createNoOpScorePlayer()` in `frontend/src/plugin-api/scorePlayerContext.ts`

**Checkpoint**: Vitest passes for T012. Both user stories are independently functional. Snap resets to score tempo in a single action.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T016 Run full frontend validation: `npm run validate` (typecheck + lint + vitest) in `frontend/`
- [X] T017 Run full backend test suite: `cargo test` in `backend/` (ensure no regressions)
- [X] T018 [P] Update `FEATURES.md` to document score-defined tempo reading and snap-to-score-tempo action
- [X] T019 Manual end-to-end verification per `quickstart.md`: load Chopin Nocturne (expect 60 BPM), Bach Invention (expect its marked tempo), adjust tempo then snap, switch scores during playback

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational — Backend Fix)**: Depends on Phase 1. Blocks E2E correctness but NOT unit-testable frontend work
- **Phase 3 (US1 — Frontend)**:
  - Tests (T008, T009) can start in parallel with Phase 2 (they use mocked data)
  - Implementation (T010, T011) can start in parallel with Phase 2 (unit-testable with mocks)
  - E2E verification requires Phase 2 (WASM rebuild) to be complete
- **Phase 4 (US2 — Snap)**: Can start in parallel with Phase 3 after Phase 2 tests (T002–T004) are written
- **Phase 5 (Polish)**: Requires all user story phases complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational backend fix makes the score carry the real BPM; frontend wiring reads it. MVP.
- **User Story 2 (P2)**: Independently testable with mock data; relies on `originalTempo` being set (wired in US1 T010) for correct runtime behaviour, but the snap mechanism itself (`resetTempo()`) exists already.

### Within Each Phase

- Tests MUST be written and confirmed FAILING before corresponding implementation tasks
- Backend (T005, T006) can run in parallel — different files
- Frontend (T010, T011) can run in parallel — different files (scorePlayerContext.ts vs ScoreViewer.tsx)
- T013 must complete before T014 (type declaration before implementation)

---

## Parallel Execution Examples

### Phase 2 (Backend Fix)

```text
Developer A: T002 → T003 → T004  (write all failing tests)
Developer A: T005 → T007         (fix parser, rebuild WASM)
Developer B: T006                 (fix converter clamp, in parallel with T005)
```

### Phase 3 + Phase 4 in Parallel (after Phase 2 tests written)

```text
Developer A: T008 → T009 → T010 → T011   (US1 frontend wiring)
Developer B: T012 → T013 → T014 → T015   (US2 snap API)
```

---

## Implementation Strategy

**MVP scope**: Phase 2 + Phase 3 (US1) alone delivers SC-001 and SC-002 — every score plays at its correct marked tempo.

**Full scope**: Add Phase 4 (US2) for the snap action (SC-003).

**Suggested order for single developer**:
1. T001 → T002–T004 (red tests) → T005–T006 (green) → T007 (WASM)
2. T008–T009 (red) → T010–T011 (green) → verify US1 manually
3. T012 (red) → T013–T015 (green) → verify US2 manually
4. T016–T019 (polish + final validation)
