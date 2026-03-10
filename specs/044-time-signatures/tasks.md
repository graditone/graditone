# Tasks: Time Signatures

**Input**: Design documents from `/specs/044-time-signatures/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅, contracts/ ✅

**Tech stack**: Rust 1.93.0 (backend), wasm-pack (WASM), TypeScript 5.9 / React 19 (frontend)  
**Test framework**: `cargo test` (Rust), `vitest` (TypeScript), `playwright` (E2E)  
**Testing**: Required per Constitution Principle V (Test-First Development) — tests written before implementation

**Summary of changes**:
- `backend/src/domain/importers/musicxml/converter.rs` — Gap 1: read `attrs.time` instead of hardcoding 4/4
- `backend/src/layout/mod.rs` — Gap 2: derive `ticks_per_measure` formula instead of hardcoding 3840
- No frontend changes required (LayoutView.tsx already correctly reads and forwards time signature)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Confirm baseline is green before any changes

- [X] T001 Run `cargo test` in `backend/` and confirm all existing tests pass (record pass count as baseline)

---

## Phase 2: Foundational

**Purpose**: Add shared test infrastructure required by both US1 and US2 unit tests

- [X] T002 Add minimal 2/4 MusicXML test fixture at `backend/tests/fixtures/musicxml/minimal_2_4.musicxml` — single measure with `<beats>2</beats><beat-type>4</beat-type>` and one quarter note
- [X] T003 [P] Add minimal 3/4 MusicXML test fixture at `backend/tests/fixtures/musicxml/minimal_3_4.musicxml` — single measure with `<beats>3</beats><beat-type>4</beat-type>` and one quarter note
- [X] T004 [P] Add minimal 6/8 MusicXML test fixture at `backend/tests/fixtures/musicxml/minimal_6_8.musicxml` — single measure with `<beats>6</beats><beat-type>8</beat-type>` and one eighth note

**Checkpoint**: Fixture files in place — US2 and US1 unit tests can now be written

---

## Phase 3: User Story 2 — MusicXML Import (Priority: P1) 🎯 MVP

**Goal**: When a MusicXML file is imported, the score model contains the correct time signature event instead of always defaulting to 4/4.

**Independent Test**: Run `cargo test import` in `backend/` — all four converter time-signature tests pass. Inspect the score model for Arabesque and confirm `TimeSignatureEvent { numerator: 2, denominator: 4 }` at tick 0.

### Tests for User Story 2 — Write FIRST, verify they FAIL before implementation

- [X] T005 [P] [US2] Write failing unit test `test_import_2_4_time_signature` in `backend/src/domain/importers/musicxml/converter.rs` — import `minimal_2_4.musicxml`, assert score has `TimeSignatureEvent { tick: 0, numerator: 2, denominator: 4 }`
- [X] T006 [P] [US2] Write failing unit test `test_import_3_4_time_signature` in `backend/src/domain/importers/musicxml/converter.rs` — import `minimal_3_4.musicxml`, assert score has `TimeSignatureEvent { tick: 0, numerator: 3, denominator: 4 }`
- [X] T007 [P] [US2] Write failing unit test `test_import_6_8_time_signature` in `backend/src/domain/importers/musicxml/converter.rs` — import `minimal_6_8.musicxml`, assert score has `TimeSignatureEvent { tick: 0, numerator: 6, denominator: 8 }`
- [X] T008 [P] [US2] Write passing baseline test `test_import_default_4_4_time_signature` in `backend/src/domain/importers/musicxml/converter.rs` — import MusicXML with no `<time>` element, assert score defaults to `TimeSignatureEvent { tick: 0, numerator: 4, denominator: 4 }` (should pass before and after fix)

### Implementation for User Story 2

- [X] T009 [US2] In `backend/src/domain/importers/musicxml/converter.rs`, in the `convert()` method: replace both hardcoded `TimeSignatureEvent::new(Tick::new(0), 4, 4)` calls (the default path and the `if doc.default_tempo > 0.0` branch that clears and re-adds) with logic that reads `(beats, beat_type)` from `doc.parts.first()?.measures.first()?.attributes?.time` and falls back to `(4, 4)` if absent
- [X] T010 [US2] Run `cargo test` in `backend/` and confirm T005–T008 all pass, plus all previously passing tests still pass

**Checkpoint**: Score model now contains correct time signature from MusicXML. US2 independently testable.

---

## Phase 4: User Story 1 — Correct Measure Layout (Priority: P1) 🎯 MVP

**Goal**: The layout engine uses the actual time signature to compute measure boundaries instead of the hardcoded 4/4 constant (3840 ticks). Arabesque renders with correct 2/4 barlines.

**Independent Test**: Run `cargo test layout` in `backend/` — all measure-boundary tests pass. Open Arabesque in the browser and verify barlines appear every 2 beats with the correct measure count.

### Tests for User Story 1 — Write FIRST, verify they FAIL before implementation

- [X] T011 [P] [US1] Write failing unit test `test_layout_2_4_measure_boundaries` in `backend/src/layout/mod.rs` — call `compute_layout` with `time_signature: {numerator: 2, denominator: 4}` and two measures of notes; assert `MeasureInfo.start_tick` values are [0, 1920]
- [X] T012 [P] [US1] Write failing unit test `test_layout_3_4_measure_boundaries` in `backend/src/layout/mod.rs` — call `compute_layout` with `time_signature: {numerator: 3, denominator: 4}` and two measures; assert start ticks are [0, 2880]
- [X] T013 [P] [US1] Write passing baseline test `test_layout_4_4_measure_boundaries_unchanged` in `backend/src/layout/mod.rs` — call `compute_layout` with `time_signature: {numerator: 4, denominator: 4}` and two measures; assert start ticks are [0, 3840] (this test must pass before AND after the fix — regression guard)

### Implementation for User Story 1

- [X] T014 [US1] In `backend/src/layout/mod.rs`, in the `compute_layout` (or top-level layout) function: extract time signature from `json_input["staffs"][0]["time_signature"]` and compute `let ticks_per_measure: u32 = (3840 * time_numerator) / time_denominator;` using fallback `(4, 4)` if absent (pattern consistent with existing extraction at lines 725–728)
- [X] T015 [US1] In `backend/src/layout/mod.rs`, replace hardcoded `3840` in the MeasureInfo construction loop (`start_tick = i as u32 * 3840` and `end_tick = start_tick + 3840`) with `ticks_per_measure`
- [X] T016 [US1] In `backend/src/layout/mod.rs`, replace hardcoded `3840` in measure number calculation (`start_tick / 3840`) with `ticks_per_measure`
- [X] T017 [US1] In `backend/src/layout/mod.rs`, replace hardcoded `3840` in the two note-to-measure-index calculations (`start_tick / 3840` at lines ~572 and ~596) with `ticks_per_measure`
- [X] T018 [US1] Run `cargo test` in `backend/` and confirm T011–T013 all pass, plus all previously passing tests still pass
- [X] T019 [US1] Update `backend/tests/rest_arabesque_diag.rs` to assert that importing Arabesque produces `TimeSignatureEvent { numerator: 2, denominator: 4 }` at tick 0 and that the first two MeasureInfo start ticks are 0 and 1920 (reflecting 2/4 measures)

**Checkpoint**: Layout engine produces correct measure boundaries for any time signature. US1 independently testable.

---

## Phase 5: User Story 4 — Time Signature Glyph Display (Priority: P2)

**Goal**: The time signature glyph rendered at the start of the first system matches the imported time signature (e.g., Arabesque shows "2/4", not "4/4"). This is largely a side effect of US2+US1 since `position_time_signature` already uses `time_numerator`/`time_denominator` from `StaffData`, which is populated from the JSON input's `time_signature` field.

**Independent Test**: Build WASM, open Arabesque in browser, verify glyph shows "2" over "4". Open Canon in D, verify glyph shows "4" over "4".

### Tests for User Story 4

- [X] T020 [P] [US4] Write unit test `test_time_signature_glyph_2_4` in `backend/src/layout/mod.rs` — call `compute_layout` with `time_signature: {numerator: 2, denominator: 4}`, inspect the output's structural glyphs array on the first staff, assert it contains time signature digit glyphs for "2" and "4"
- [X] T021 [P] [US4] Write unit test `test_time_signature_glyph_6_8` in `backend/src/layout/mod.rs` — same as above with `{numerator: 6, denominator: 8}`, assert glyphs for "6" and "8"

### Implementation for User Story 4

- [X] T022 [US4] Run `cargo test` and verify T020–T021 pass (they should pass without code changes since `position_time_signature` already uses the actual numerator/denominator — confirm this and fix if not)
- [X] T023 [US4] Build WASM: run `wasm-pack build --target web` in `backend/` and copy generated `pkg/` output to `frontend/src/wasm/` per the project's WASM copy script

**Checkpoint**: WASM rebuilt with time-signature-aware layout. Glyph display verified.

---

## Phase 6: User Story 3 — Playback Respects Time Signature (Priority: P2)

**Goal**: Playback cursor, note highlighting, and scroll behaviour align to measure boundaries derived from the actual time signature, not a hardcoded 4/4 assumption.

**Independent Test**: Play Arabesque; the playback cursor crosses a barline every 2 beats. Play Canon in D; cursor still crosses barlines every 4 beats.

### Tests for User Story 3

- [X] T024 [P] [US3] Audit `frontend/plugins/play-score/PlayScorePlugin.tsx` line ~44 for hardcoded 4/4 assumptions (e.g., `ticksPerMeasure = 3840` or `beats = 4`); write a vitest unit test in `frontend/tests/` that verifies the plugin reads `time_signature` from the score model and uses dynamically computed measure duration

### Implementation for User Story 3

- [X] T025 [US3] If `frontend/plugins/play-score/PlayScorePlugin.tsx` contains any hardcoded 4/4 measure-tick constants, replace them with a computation using the score's `time_signature` event (same formula: `(3840 * numerator) / denominator`); if no hardcoding found, document this as verified-no-change
- [X] T026 [P] [US3] Audit `frontend/src/plugin-api/scorePlayerContext.ts` line ~147 and `frontend/src/services/file/FileService.ts` line ~151 for hardcoded 4/4; apply same fix if found
- [X] T027 [US3] Run `npm test` in `frontend/` and confirm all tests pass

**Checkpoint**: Playback uses correct measure boundaries for all time signatures. US3 independently testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T028 Run full test suite end-to-end: `cargo test` in `backend/` + `npm test` in `frontend/`; fix any remaining failures
- [X] T029 [P] Update `FEATURES.md` — add entry for time signature support, noting generic support for 2/4, 3/4, 4/4, 6/8, 9/8, 12/8 and the Arabesque fix
- [X] T030 [P] Update `backend/README.md` — document `ticks_per_measure = (3840 × numerator) / denominator` formula and note mid-piece time signature changes are out of scope

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
  └─► Phase 2: Foundational (fixtures)
        ├─► Phase 3: US2 — MusicXML Import (P1)   ← MVP gate 1
        │     └─► Phase 4: US1 — Measure Layout (P1)   ← MVP gate 2
        │           └─► Phase 5: US4 — Glyph Display (P2, side effect of US1+US2)
        │           └─► Phase 6: US3 — Playback (P2, depends on correct layout output)
        └─► Final Phase: Polish
```

### User Story Dependencies

- **US2** (Phase 3): Depends on fixtures (Phase 2). No dependency on other user stories.
- **US1** (Phase 4): Depends on fixtures (Phase 2). Can be _written_ independently of US2, but the end-to-end Arabesque integration test (T019) should run after US2 is done so the converter provides real 2/4 data.
- **US4** (Phase 5): Is a side effect of US1+US2 — glyph rendering already uses actual time sig from layout input. Just needs WASM rebuild (T023).
- **US3** (Phase 6): Depends on US1 (correct layout output provides correct tick boundaries) and US2 (score model has correct time sig for playback to read).

### Within Each User Story: Tests → Implementation

Per Constitution Principle V: every test task must be done **before** the corresponding implementation task in the same story.

### Parallel Execution Opportunities

| Parallel Batch | Tasks |
|---|---|
| Fixture creation | T003, T004 (all in different files) |
| Write failing tests (US2 + US1 simultaneously) | T005, T006, T007, T008, T011, T012, T013 |
| Fix converter + fix layout engine (different files) | T009, T014 (and T015, T016, T017) |
| Glyph tests + playback audit | T020, T021, T024 |
| Polish | T029, T030 |

---

## Implementation Strategy

**MVP (minimum to deliver value)**: Complete US2 (Phase 3) + US1 (Phase 4). This delivers Arabesque with correct 2/4 measure structure — the primary user request. US4 (glyph) is automatically correct after US1+US2 since the rendering already works.

**Full feature**: Add US3 (Phase 6) to verify playback alignment, then Polish phase.

**Task count by user story**:

| Phase | User Story | Tasks |
|---|---|---|
| Phase 1 | Setup | 1 |
| Phase 2 | Foundational | 3 |
| Phase 3 | US2 — MusicXML Import (P1) | 6 |
| Phase 4 | US1 — Measure Layout (P1) | 9 |
| Phase 5 | US4 — Glyph Display (P2) | 4 |
| Phase 6 | US3 — Playback (P2) | 4 |
| Final | Polish | 3 |
| **Total** | | **30** |
