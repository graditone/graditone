# Tasks: Refactor MusicXML Importer

**Input**: Design documents from `/specs/057-refactor-musicxml-importer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests are explicitly requested in User Story 3 (P3). No TDD approach — existing integration tests serve as regression safety net.

**Organization**: Tasks grouped by user story. US1 (core refactor) is split into parser and converter sub-phases for clarity.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Record baseline and verify starting state

- [X] T001 Record baseline test results by running `cargo test -- musicxml` in `backend/` and saving pass count and wall-clock time
- [X] T002 Run `cargo clippy` in `backend/` and record current warnings as baseline

**Checkpoint**: Baseline recorded — refactoring can begin

---

## Phase 2: Foundational (Parser Directory Scaffolding)

**Purpose**: Convert parser.rs from a single file to a directory module without changing any logic. This MUST complete before parser extraction tasks.

**⚠️ CRITICAL**: No function extraction can begin until this phase is complete for the target module.

- [X] T003 Create `backend/src/domain/importers/musicxml/parser/` directory and move `parser.rs` to `parser/mod.rs` using `git mv`
- [X] T004 Verify compilation passes with `cargo check` in `backend/` after parser directory migration
- [X] T005 Create empty sub-module files `backend/src/domain/importers/musicxml/parser/measure.rs`, `parser/note.rs`, `parser/attributes.rs`, `parser/structure.rs` and declare them with `mod` in `parser/mod.rs`
- [X] T006 Verify all integration tests pass with `cargo test -- musicxml` in `backend/` after parser scaffolding

**Checkpoint**: Parser directory structure ready — function extraction can begin

---

## Phase 3: User Story 1 — Parser Decomposition (Priority: P1) 🎯 MVP

**Goal**: Decompose parser.rs (~1,395 lines) into 5 focused sub-modules while preserving 100% behavioral parity

**Independent Test**: All 70+ existing integration tests pass without modification after each extraction step

### Parser Function Extraction

- [X] T007 [US1] Extract `parse_attributes`, `parse_key`, `parse_time_signature`, `parse_clef` functions into `backend/src/domain/importers/musicxml/parser/attributes.rs` with `pub(super)` visibility and necessary `use` imports
- [X] T008 [US1] Verify compilation and tests pass after attributes extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T009 [US1] Extract `parse_barline_content`, `parse_direction` functions into `backend/src/domain/importers/musicxml/parser/structure.rs` with `pub(super)` visibility and necessary `use` imports
- [X] T010 [US1] Verify compilation and tests pass after structure extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T011 [US1] Extract `parse_note`, `parse_notations`, `parse_technical`, `parse_articulations`, `parse_pitch`, `parse_duration_element` functions into `backend/src/domain/importers/musicxml/parser/note.rs` with `pub(super)` visibility and necessary `use` imports
- [X] T012 [US1] Verify compilation and tests pass after note extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T013 [US1] Extract `parse_measure` function into `backend/src/domain/importers/musicxml/parser/measure.rs` with `pub(super)` visibility, importing sub-module functions from `note`, `attributes`, and `structure`
- [X] T014 [US1] Verify compilation and tests pass after measure extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T015 [US1] Verify `parser/mod.rs` contains only document-level functions (`parse`, `parse_score_partwise`, `parse_part_list`, `parse_work`, `parse_identification`, `parse_part`) and does not exceed 300 lines

**Checkpoint**: Parser decomposition complete — all 5 sub-modules populated, all tests passing

---

## Phase 4: User Story 1 — Converter Decomposition (Priority: P1)

**Goal**: Decompose converter.rs (~1,645 lines) into 6 focused sub-modules while preserving 100% behavioral parity

**Independent Test**: All 70+ existing integration tests pass without modification after each extraction step

### Converter Directory Scaffolding

- [X] T016 [US1] Create `backend/src/domain/importers/musicxml/converter/` directory and move `converter.rs` to `converter/mod.rs` using `git mv`
- [X] T017 [US1] Verify compilation passes with `cargo check` in `backend/` after converter directory migration
- [X] T018 [US1] Create empty sub-module files `backend/src/domain/importers/musicxml/converter/staff.rs`, `converter/notes.rs`, `converter/ties.rs`, `converter/structure.rs`, `converter/voice.rs` and declare them with `mod` in `converter/mod.rs`
- [X] T019 [US1] Verify all integration tests pass with `cargo test -- musicxml` in `backend/` after converter scaffolding

### Converter Function Extraction

- [X] T020 [US1] Extract `VoiceDistributor` struct and its `impl` block (`new`, `assign_voices`, `assign_note`) into `backend/src/domain/importers/musicxml/converter/voice.rs` with `pub(super)` visibility
- [X] T021 [US1] Verify compilation and tests pass after voice extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T022 [US1] Extract `resolve_tie_chains`, `resolve_slur_chains` functions into `backend/src/domain/importers/musicxml/converter/ties.rs` with `pub(super)` visibility
- [X] T023 [US1] Verify compilation and tests pass after ties extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T024 [US1] Extract `detect_pickup_ticks`, `compute_measure_end_ticks`, `collect_repeat_barlines`, `collect_volta_brackets`, `collect_octave_shift_regions` functions into `backend/src/domain/importers/musicxml/converter/structure.rs` with `pub(super)` visibility, importing `TimingContext` and measure tick helpers from `super`
- [X] T025 [US1] Verify compilation and tests pass after structure extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T026 [US1] Extract `collect_notes`, `collect_notes_for_staff`, `distribute_rests`, `convert_note` functions into `backend/src/domain/importers/musicxml/converter/notes.rs` with `pub(super)` visibility, importing `TimingContext` from `super` and resolve functions from `ties`
- [X] T027 [US1] Verify compilation and tests pass after notes extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T028 [US1] Extract `convert_multi_staff`, `convert_staff_for_single_staff`, `add_key_changes_from_measures`, `add_clef_changes_from_measures` functions into `backend/src/domain/importers/musicxml/converter/staff.rs` with `pub(super)` visibility, importing from `notes`, `ties`, and `voice` sub-modules
- [X] T029 [US1] Verify compilation and tests pass after staff extraction with `cargo check && cargo test -- musicxml` in `backend/`
- [X] T030 [US1] Verify `converter/mod.rs` contains only `convert()`, `convert_part()`, `TimingContext` struct, and measure tick helper functions (`measure_start_tick`, `measure_end_tick`, `actual_measure_start`, `actual_measure_end`) and does not exceed 200 lines

**Checkpoint**: Converter decomposition complete — all 6 sub-modules populated, all tests passing. US1 fully satisfied.

---

## Phase 5: User Story 2 — Module Documentation (Priority: P2)

**Goal**: Each sub-module has a module-level doc comment describing its single responsibility in one sentence

**Independent Test**: A developer can locate any MusicXML import feature by reading module names and doc comments

- [X] T031 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/parser/mod.rs` describing parser entry point and document-level orchestration
- [X] T032 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/parser/measure.rs` describing measure element routing responsibility
- [X] T033 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/parser/note.rs` describing note, pitch, articulation, and duration parsing
- [X] T034 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/parser/attributes.rs` describing key, clef, and time signature parsing
- [X] T035 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/parser/structure.rs` describing barline/repeat and direction/octave-shift parsing
- [X] T036 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/mod.rs` describing convert entry point, part routing, and timing context
- [X] T037 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/staff.rs` describing single-staff and multi-staff routing with key/clef changes
- [X] T038 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/notes.rs` describing note collection, conversion, and rest distribution
- [X] T039 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/ties.rs` describing tie and slur chain resolution
- [X] T040 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/structure.rs` describing pickup detection, measure boundaries, repeats, voltas, and octave shifts
- [X] T041 [P] [US2] Add module-level `//!` doc comment to `backend/src/domain/importers/musicxml/converter/voice.rs` describing voice distribution and assignment logic

**Checkpoint**: All sub-modules documented with single-sentence responsibility descriptions. US2 fully satisfied.

---

## Phase 6: User Story 3 — Unit Test Isolation (Priority: P3)

**Goal**: Demonstrate that extracted components can be unit-tested in isolation without full import pipeline

**Independent Test**: New unit tests pass using minimal inputs rather than full MusicXML documents

- [X] T042 [P] [US3] Add unit tests for `VoiceDistributor` in `backend/src/domain/importers/musicxml/converter/voice.rs` testing voice assignment with overlapping notes, empty input, and max-voice overflow
- [X] T043 [P] [US3] Add unit tests for `TimingContext` in `backend/src/domain/importers/musicxml/converter/mod.rs` testing `advance_by_duration` with various fractions, divisions, and grace note handling
- [X] T044 [P] [US3] Add unit tests for `resolve_tie_chains` and `resolve_slur_chains` in `backend/src/domain/importers/musicxml/converter/ties.rs` testing with minimal note lists containing start/stop tie and slur metadata
- [X] T045 [US3] Verify all new unit tests pass alongside existing integration tests with `cargo test` in `backend/`

**Checkpoint**: 3 previously untestable-in-isolation components now have dedicated unit tests. US3 fully satisfied.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and performance check

- [X] T046 Run `cargo clippy` in `backend/` and fix any new warnings introduced by the refactor
- [X] T047 Verify no source file in `backend/src/domain/importers/musicxml/` exceeds 450 lines (SC-001 target: 400, with ≤50 line tolerance for cohesion)
- [X] T048 Run full integration test suite 3 times with `cargo test -- musicxml` in `backend/` and compare wall-clock time against baseline from T001 to verify ≤5% degradation (SC-006)
- [X] T049 Verify all re-exports in `backend/src/domain/importers/musicxml/mod.rs` still resolve correctly by running `cargo check` in `backend/`
- [X] T050 Run quickstart.md verification checklist from `specs/057-refactor-musicxml-importer/quickstart.md`

**Checkpoint**: All success criteria verified. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — creates parser directory scaffold
- **US1 Parser (Phase 3)**: Depends on Phase 2 — extracts functions from parser/mod.rs into sub-modules
- **US1 Converter (Phase 4)**: Depends on Phase 3 completion (sequential to minimize risk; converter scaffolding is self-contained)
- **US2 Documentation (Phase 5)**: Depends on Phase 4 — all sub-modules must exist before documenting
- **US3 Unit Tests (Phase 6)**: Depends on Phase 4 — extracted components must exist before testing in isolation
- **Polish (Phase 7)**: Depends on Phases 5 and 6 — final verification after all work

### User Story Dependencies

- **US1 (P1)**: Depends only on Setup + Foundational. Core refactor work.
- **US2 (P2)**: Depends on US1 completion (sub-modules must exist to document)
- **US3 (P3)**: Depends on US1 completion (components must be extracted to test in isolation)
- **US2 and US3 can run in parallel** once US1 is complete

### Within Each Phase

- Extraction tasks within parser (T007→T015) are **sequential** — each extraction step must compile and pass tests before the next
- Extraction tasks within converter (T020→T030) are **sequential** — same reason
- Documentation tasks (T031→T041) are all **parallel** — independent file edits
- Unit test tasks (T042→T044) are all **parallel** — independent test files

### Parallel Opportunities

```
Phase 1 (Setup):     T001, T002 [parallel]
Phase 2 (Scaffold):  T003 → T004 → T005 → T006 [sequential]
Phase 3 (Parser):    T007 → T008 → ... → T015 [sequential — each needs test verification]
Phase 4 (Converter): T016 → T017 → ... → T030 [sequential — each needs test verification]
Phase 5 + 6:         T031-T041 [all parallel] || T042-T044 [all parallel]
Phase 7 (Polish):    T046 → T047 → T048 → T049 → T050 [sequential — final checks]
```

---

## Implementation Strategy

### MVP Scope

**User Story 1 (Phases 1-4)** is the MVP. After completing the parser and converter decomposition, the core refactoring goal is achieved:
- All files under 450 lines (SC-001)
- All 70+ integration tests pass unchanged (SC-002)
- Each sub-module has a single responsibility (SC-003)

### Incremental Delivery

1. **MVP (US1)**: Parser + Converter decomposition — delivers the structural refactor
2. **US2**: Module documentation — improves developer discoverability (SC-004)
3. **US3**: Unit test isolation — proves testability of extracted components (SC-005)
4. **Polish**: Performance verification (SC-006), clippy, final checks
