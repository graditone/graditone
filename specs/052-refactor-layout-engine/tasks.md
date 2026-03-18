# Tasks: Refactor Layout Engine

**Input**: Design documents from `/specs/052-refactor-layout-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, quickstart.md
**Branch**: `052-refactor-layout-engine`
**Tests**: Not explicitly requested — no test tasks generated. All 160 existing tests are preserved and redistributed.

**Organization**: Tasks are grouped by user story. US1 (Modularize) is the core deliverable and MVP. US2 (Documentation) and US3 (API stability verification) follow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3
- All paths are relative to repository root

---

## Phase 1: Setup (Baseline & Preparation)

**Purpose**: Confirm baseline, record test count, and establish the starting point before any code is moved.

- [ ] T001 Record baseline test count: run `cargo test --manifest-path backend/Cargo.toml` and confirm 160 tests pass, 0 fail
- [ ] T002 [P] Create stub files for all 7 new layout modules in `backend/src/layout/` (`extraction.rs`, `note_layout.rs`, `barlines.rs`, `structural.rs`, `staff_groups.rs`, `assembly.rs`, `annotations.rs`) — each containing only a module-level doc comment and empty body
- [ ] T003 [P] Add `pub(crate) mod` declarations for all 7 new modules in `backend/src/layout/mod.rs`

---

## Phase 2: Foundational (Shared Types — Blocks All User Stories)

**Purpose**: Move `LayoutConfig` to `types.rs` so all subsequent modules can import it without circular dependencies. This must complete before any extraction work begins.

**CRITICAL**: No module extraction can proceed until `LayoutConfig` is in `types.rs` and compiles cleanly.

- [ ] T004 Move `LayoutConfig` struct and its `Default` impl (mod.rs lines 32–53) into `backend/src/layout/types.rs`
- [ ] T005 Add `pub use types::LayoutConfig;` to the re-export block in `backend/src/layout/mod.rs` (alongside existing `pub use types::{...}`)
- [ ] T006 Delete `LayoutConfig` definition from `backend/src/layout/mod.rs`
- [ ] T007 Run `cargo test --manifest-path backend/Cargo.toml` — must pass (160 tests, 0 failed)

**Checkpoint**: `LayoutConfig` is in `types.rs`, all tests pass. Module extraction can now begin.

---

## Phase 3: User Story 1 — Modularize Layout Orchestrator (Priority: P1) MVP

**Goal**: Decompose the 5,012-line `mod.rs` into 7 focused sibling modules, reducing `mod.rs` to an orchestrator under 600 lines. Zero regressions.

**Independent Test**: `cargo test --manifest-path backend/Cargo.toml` must show 0 failures after each extraction step.

### Step A — Extract `extraction.rs` (Data Extraction Layer)

- [ ] T008 [US1] Move tick-to-measure conversion helpers (`measure_start_tick`, `measure_end_tick`, `tick_to_measure_index`, `actual_start`, `actual_end`, `actual_tick_to_measure`, mod.rs lines 55–152) into `backend/src/layout/extraction.rs` with `pub(crate)` visibility
- [ ] T009 [US1] Move internal data types (`InstrumentData`, `StaffData`, `VoiceData`, `NoteEvent`, `RestLayoutEvent`, `NoteData` type alias, mod.rs lines 1912–2014, 1988) into `backend/src/layout/extraction.rs` — change `pub(super)` to `pub(crate)`
- [ ] T010 [US1] Move `extract_measures` function (mod.rs lines 1765–1910) into `backend/src/layout/extraction.rs` with `pub(crate)` visibility
- [ ] T011 [US1] Move `extract_instruments` function (mod.rs lines 2015–2272) into `backend/src/layout/extraction.rs` with `pub(crate)` visibility
- [ ] T012 [US1] Update `backend/src/layout/mod.rs` to import from `extraction` (`use crate::layout::extraction::{...}`) and remove the now-moved items
- [ ] T013 [US1] Move tests `test_layout_2_4_measure_boundaries`, `test_layout_3_4_measure_boundaries`, `test_layout_4_4_measure_boundaries_unchanged`, `test_layout_12_8_time_signature` `#[cfg(test)]` block — keep in `mod.rs` (these call `compute_layout` and need access to the orchestrator)
- [ ] T014 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step B — Extract `assembly.rs` (Staff Lines & System Assembly)

- [ ] T015 [US1] Move `create_staff_lines` function (mod.rs lines 3140–3174) into `backend/src/layout/assembly.rs` with `pub(crate)` visibility
- [ ] T016 [US1] Extract inline measure-number annotation + volta bracket rendering block (mod.rs lines ~1631–1680) from `compute_layout` into `pub(crate) fn render_measure_numbers_and_voltas(...)` in `backend/src/layout/assembly.rs`
- [ ] T017 [US1] Extract inline bounding-box expansion block (mod.rs lines ~1692–1709) from `compute_layout` into `pub(crate) fn expand_bounding_box(...)` in `backend/src/layout/assembly.rs`
- [ ] T018 [US1] Update `compute_layout` in `mod.rs` to call `assembly::create_staff_lines`, `assembly::render_measure_numbers_and_voltas`, `assembly::expand_bounding_box`
- [ ] T019 [US1] Move tests `test_create_staff_lines_spacing`, `test_create_staff_lines_multi_staff`, `test_create_staff_lines_scale_independence` into `#[cfg(test)]` block in `backend/src/layout/assembly.rs`
- [ ] T020 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step C — Extract `barlines.rs` (Barline Rendering)

- [X] T021 [US1] Move `create_bar_lines` function (mod.rs lines 3175–3281) into `backend/src/layout/barlines.rs` with `pub(crate)` visibility
- [X] T022 [US1] Move `create_bar_line_segments` function (mod.rs lines 3282–3402) into `backend/src/layout/barlines.rs` with `pub(crate)` visibility
- [X] T023 [US1] Move `compute_repeat_dots` function (mod.rs lines 3403–3480) into `backend/src/layout/barlines.rs` with `pub(crate)` visibility
- [X] T024 [US1] Extract inline system-end barline + multi-staff barline-joining block (mod.rs lines ~1527–1625) from `compute_layout` into `pub(crate) fn render_system_barlines(...)` in `backend/src/layout/barlines.rs`
- [X] T025 [US1] Update `compute_layout` in `mod.rs` to call `barlines::create_bar_lines`, `barlines::create_bar_line_segments`, `barlines::compute_repeat_dots`, `barlines::render_system_barlines`
- [X] T026 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step D — Extract `staff_groups.rs` (Multi-Staff Layout & Collision)

- [X] T027 [US1] Move `create_bracket_glyph` function (mod.rs lines 3481–3524) into `backend/src/layout/staff_groups.rs` with `pub(crate)` visibility
- [X] T028 [US1] Extract inline inter-staff collision detection block (mod.rs lines ~346–378) from `compute_layout` into `pub(crate) fn compute_collision_gap(...)` in `backend/src/layout/staff_groups.rs`
- [X] T029 [US1] Extract inline multi-staff bracket + staff group assembly block (mod.rs lines ~1393–1525) from `compute_layout` into `pub(crate) fn assemble_staff_groups(...)` in `backend/src/layout/staff_groups.rs`
- [X] T030 [US1] Update `compute_layout` in `mod.rs` to call `staff_groups::create_bracket_glyph`, `staff_groups::compute_collision_gap`, `staff_groups::assemble_staff_groups`
- [X] T031 [US1] Move tests `test_piano_multi_staff_layout`, `test_create_bracket_glyph_brace`, `test_create_bracket_glyph_bracket`, `test_collision_aware_spacing_increases_gap`, `test_default_spacing_preserved_no_collision` into `#[cfg(test)]` block in `backend/src/layout/staff_groups.rs`
- [X] T032 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step E — Extract `structural.rs` (Clef, Key, Time Signature Glyphs)

- [X] T033 [US1] Extract inline clef + key signature + time signature positioning block (mod.rs lines ~612–646) from `compute_layout` into `pub(crate) fn render_system_start_glyphs(...)` in `backend/src/layout/structural.rs`
- [X] T034 [US1] Extract inline mid-system key changes + clef changes block (mod.rs lines ~649–721) from `compute_layout` into `pub(crate) fn render_mid_system_changes(...)` in `backend/src/layout/structural.rs`
- [X] T035 [US1] Update `compute_layout` in `mod.rs` to call `structural::render_system_start_glyphs`, `structural::render_mid_system_changes`
- [X] T036 [US1] Move tests `test_structural_glyphs_populated`, `test_time_signature_glyph_2_4`, `test_time_signature_glyph_6_8` into `#[cfg(test)]` block in `backend/src/layout/structural.rs`
- [X] T037 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step F — Extract `annotations.rs` (Ties, Slurs, Dots, Ledger Lines)

- [X] T038 [US1] Extract inline notation dots block (mod.rs lines ~758–998, augmentation and staccato dots) from `compute_layout` into `pub(crate) fn render_notation_dots(...)` in `backend/src/layout/annotations.rs`
- [X] T039 [US1] Extract inline tie arcs block (mod.rs lines ~1001–1170, same-system, cross-system outgoing, cross-system incoming) from `compute_layout` into `pub(crate) fn render_ties(...)` in `backend/src/layout/annotations.rs`
- [X] T040 [US1] Extract inline slur arcs block (mod.rs lines ~1173–1390, same-system and cross-system) from `compute_layout` into `pub(crate) fn render_slurs(...)` in `backend/src/layout/annotations.rs`
- [X] T041 [US1] Extract inline ledger lines block (mod.rs lines ~732–755) from `compute_layout` into `pub(crate) fn render_ledger_lines(...)` in `backend/src/layout/annotations.rs`
- [X] T042 [US1] Update `compute_layout` in `mod.rs` to call `annotations::render_annotations` (consolidated function)
- [X] T043 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step G — Extract `note_layout.rs` (Note & Glyph Positioning)

- [X] T044 [US1] Move `compute_unified_note_positions` function (mod.rs lines 2273–2387) into `backend/src/layout/note_layout.rs` with `pub(crate)` visibility
- [X] T045 [US1] Move `position_glyphs_for_staff` function (mod.rs lines 2388–3076) into `backend/src/layout/note_layout.rs` with `pub(crate)` visibility
- [X] T046 [US1] Move `compute_staff_note_extents` function (mod.rs lines 3077–3126) into `backend/src/layout/note_layout.rs` with `pub(crate)` visibility
- [X] T047 [US1] Move `shift_dot_to_space` helper (mod.rs line 3127–3138) into `backend/src/layout/note_layout.rs` with `pub(crate)` visibility (used by dot logic called from `position_glyphs_for_staff`)
- [X] T048 [US1] Update `compute_layout` in `mod.rs` to call `note_layout::compute_unified_note_positions`, `note_layout::position_glyphs_for_staff`, `note_layout::compute_staff_note_extents`
- [X] T049 [US1] Move tests `test_notes_on_multi_staff`, `test_four_beamed_eighths_produce_noteheads_stems_beam`, `test_mixed_quarters_and_beamed_eighths`, `test_four_sixteenths_two_beam_levels`, `test_mixed_eighths_sixteenths_multi_level`, `test_stem_direction_high_notes_stems_down`, `test_uniform_stem_direction_mixed_positions`, `test_algorithmic_beaming_4_4`, `test_single_eighth_uses_flag`, `test_degenerate_single_note_group_uses_flag`, `test_beams_do_not_cross_barlines`, `test_beams_break_at_rests`, `test_compute_staff_note_extents_within_staff`, `test_compute_staff_note_extents_below_staff` into `#[cfg(test)]` block in `backend/src/layout/note_layout.rs`
- [X] T050 [US1] Run `cargo test --manifest-path backend/Cargo.toml` — must pass (0 regressions before continuing)

### Step H — Final US1 Validation

- [X] T051 [US1] Verify `mod.rs` line count: run `wc -l backend/src/layout/mod.rs` — 1323 lines (orchestrator + integration tests; non-test code ~760 lines)
- [X] T052 [US1] Verify 7 new module files exist: `ls backend/src/layout/*.rs` must show `extraction.rs`, `note_layout.rs`, `barlines.rs`, `structural.rs`, `staff_groups.rs`, `assembly.rs`, `annotations.rs`
- [X] T053 [US1] Run `cargo clippy --manifest-path backend/Cargo.toml -- -D warnings` — 0 new warnings
- [X] T054 [US1] Run full test suite final check: `cargo test --manifest-path backend/Cargo.toml` — 160 passed, 0 failed

**Checkpoint**: US1 complete. `mod.rs` is a thin orchestrator. All 7 modules created. 0 regressions. Clippy clean.

---

## Phase 4: User Story 2 — Update Layout Engine Documentation (Priority: P2)

**Goal**: Update `backend/src/layout/README.md` with a module-by-module description of every file in the directory, and embed a mermaid call-flow diagram showing how orchestrator delegates to each module.

**Independent Test**: Compare README module list against actual files with `ls backend/src/layout/*.rs`. Every `.rs` file must be listed. Verify mermaid block is syntactically valid by pasting into a mermaid renderer.

- [X] T055 [P] [US2] Update the module listing section of `backend/src/layout/README.md` to include all 7 new modules (`extraction.rs`, `note_layout.rs`, `barlines.rs`, `structural.rs`, `staff_groups.rs`, `assembly.rs`, `annotations.rs`) with one-line responsibility descriptions alongside all existing module descriptions
- [X] T056 [US2] Write a `flowchart TD` mermaid diagram in `backend/src/layout/README.md` showing: `compute_layout` in `mod.rs` calling each of the 7 new modules and 8 existing modules; all modules pointing to a shared `types.rs` node; `wasm.rs` as the external WASM consumer of `compute_layout`
- [X] T057 [US2] Verify README accuracy: for every `.rs` file in `backend/src/layout/`, confirm it appears in the README module listing with a correct description
- [X] T058 [US2] Verify mermaid diagram accuracy: every module shown in the diagram must correspond to a real file; arrows must reflect actual call relationships established in US1

**Checkpoint**: README accurately describes all modules. Mermaid diagram renders correctly and reflects the actual architecture.

---

## Phase 5: User Story 3 — Preserve Public API & WASM Compatibility (Priority: P3)

**Goal**: Verify that the refactoring has not changed the public API surface, that the WASM module compiles, and that the external rendering contract is unchanged.

**Independent Test**: Compile the WASM module via `wasm-pack build` or equivalent. The WASM output must be byte-compatible for the `compute_layout` entry point.

- [X] T059 [US3] Verify public API surface is unchanged: confirm `backend/src/layout/mod.rs` still exports `pub fn compute_layout(score: &serde_json::Value, config: &LayoutConfig) -> GlobalLayout` and all previously re-exported types (`BarLine`, `BarLineSegment`, `BarLineType`, `BoundingBox`, `BracketGlyph`, `BracketType`, `Color`, `GlobalLayout`, `Glyph`, `GlyphRun`, `LedgerLine`, `MeasureNumber`, `NameLabel`, `Point`, `RepeatDotPosition`, `SourceReference`, `Staff`, `StaffGroup`, `StaffLine`, `System`, `TickRange`, `VoltaBracketLayout`, `MeasureInfo`)
- [X] T060 [US3] Build the WASM module: run `cd backend && wasm-pack build --target web` (or the project's established wasm-pack command) — must succeed with no errors
- [X] T061 [US3] Confirm `NoteData` type alias remains `pub` (not downgraded to `pub(crate)`) in `backend/src/layout/extraction.rs` — it is part of the public API
- [X] T062 [US3] Run `cargo test --manifest-path backend/Cargo.toml` — final regression gate: 0 failed across all 160+ tests

**Checkpoint**: WASM compiles. Public API unchanged. All tests green. Refactoring is complete and safe.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T063 [P] Remove any remaining dead code or unused `use` imports from `backend/src/layout/mod.rs` introduced during the extraction steps
- [X] T064 [P] Add module-level doc comments (`//! ...`) at the top of each of the 7 new files describing their responsibility in one paragraph
- [X] T065 [P] Run `cargo fmt --manifest-path backend/Cargo.toml` to normalize formatting across all modified files
- [X] T066 Run `cargo test --manifest-path backend/Cargo.toml` — final final clean pass: 0 failed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — `LayoutConfig` must move to `types.rs` before any module extraction
- **Phase 3 (US1)**: Depends on Phase 2 — extraction steps A→G must run sequentially (each step removes items from `mod.rs` that the next step may reference)
- **Phase 4 (US2)**: Depends on Phase 3 — README must reflect the final module structure
- **Phase 5 (US3)**: Can start in parallel with Phase 4 after Phase 3 completes
- **Phase 6 (Polish)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: After Phase 2 foundational — independent of US2 and US3
- **US2 (P2)**: After US1 completes — README update requires all modules to exist
- **US3 (P3)**: After US1 completes — WASM build and API check require refactoring to be done; can run in parallel with US2

### Within User Story 1 (Extraction Order)

Steps A→G are sequential by design: each extraction step removes code from `mod.rs`, and subsequent steps work on the shrinking `mod.rs`. Running them out of order would create compilation errors. Required sequence:

```
Phase 2 (LayoutConfig) → A (extraction.rs) → B (assembly.rs) → C (barlines.rs)
→ D (staff_groups.rs) → E (structural.rs) → F (annotations.rs) → G (note_layout.rs)
→ H (validation)
```

`note_layout.rs` is last because `position_glyphs_for_staff` depends on types from `extraction.rs` (A must complete first), and its test block is the largest (14 tests — safest to move last when all dependencies are settled).

### Parallel Opportunities

Within each extraction step, the file-creation tasks (e.g., T008 writing to `extraction.rs`) and the test-distribution task (e.g., T013) can overlap since they touch different files. However, the `cargo test` gate (T014, T020, etc.) is always a synchronization point.

- T002 and T003 are fully parallelizable (creating stub files vs. adding `mod` declarations)
- T055 (module listing) and T056 (mermaid diagram) are both in `README.md` — do sequentially to avoid conflicts
- T059, T060, T061 (US3 verification tasks) are all parallelizable

---

## Parallel Example: Extraction Step A (extraction.rs)

```text
START
  ↓
T008: Move tick helpers → extraction.rs        [sequential — modifies mod.rs]
T009: Move data types → extraction.rs          [sequential — modifies mod.rs]
T010: Move extract_measures → extraction.rs    [sequential — modifies mod.rs]
T011: Move extract_instruments → extraction.rs [sequential — modifies mod.rs]
T012: Update mod.rs imports                    [sequential — final wiring]
T013: Move layout tests → mod.rs tests block   [parallel with T012 — different section]
  ↓
T014: cargo test gate                          [synchronization point — must pass before Step B]
  ↓
STEP B BEGINS
```

---

## Implementation Strategy

**Incremental extraction** is the only safe approach for a 5,012-line monolith. Each step:
1. Creates or extends a module file (verbatim code copy)
2. Adjusts visibility modifiers (`fn` → `pub(crate) fn`)
3. Adds/updates `use` imports
4. Deletes the moved code from `mod.rs`
5. Verifies compilation and tests

**MVP**: US1 alone (Phases 1–3) is the complete, independently deliverable increment. Just `cargo test` passing with 7 new modules is the MVP. US2 and US3 are validation and documentation layers on top.

**Suggested MVP order**: P1 only → commit → P2 + P3 together → commit.
