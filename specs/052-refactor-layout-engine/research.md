# Research: Refactor Layout Engine

**Phase**: 0 — Outline & Research  
**Date**: 2026-03-18  
**Branch**: `052-refactor-layout-engine`

All NEEDS CLARIFICATION items from the Technical Context were resolved through direct code inspection of `backend/src/layout/mod.rs` (5,012 lines) and related files. No external research was required.

---

## 1. Actual File Size & Scope

**Decision**: The actual `mod.rs` is **5,012 lines** (not ~3,750 as estimated earlier). The test block alone is ~1,487 lines (lines 3,526–5,012).

**Rationale**: Direct `wc -l` measurement. The larger-than-estimated test block means SC-001 (mod.rs under 600 lines) is well-achievable — moving tests to per-module `#[cfg(test)]` blocks alone accounts for ~1,487 lines.

**Alternatives considered**: N/A — measurement fact.

---

## 2. Exact Function-to-Module Assignment

**Decision**: Assign each function/type block to a new module based on cohesion:

| Current location (mod.rs line) | Function/Type | Target module |
|-------------------------------|--------------|---------------|
| 32–53 | `LayoutConfig` struct | → `types.rs` (per FR-016) |
| 55–152 | `measure_start_tick`, `measure_end_tick`, `tick_to_measure_index`, `actual_start`, `actual_end`, `actual_tick_to_measure` | → `extraction.rs` |
| 153–1764 | `compute_layout` (orchestrator body slimmed to delegates) | stays in `mod.rs` |
| 1765–1910 | `extract_measures` | → `extraction.rs` |
| 1912–2014 | `InstrumentData`, `StaffData`, `VoiceData`, `NoteEvent`, `RestLayoutEvent`, `NoteData` type alias | → `extraction.rs` |
| 2015–2272 | `extract_instruments` | → `extraction.rs` |
| 2273–2387 | `compute_unified_note_positions` | → `note_layout.rs` |
| 2388–3076 | `position_glyphs_for_staff` | → `note_layout.rs` |
| 3077–3126 | `compute_staff_note_extents` | → `note_layout.rs` |
| 3127–3139 | `shift_dot_to_space` | → `note_layout.rs` (used by dot logic inside position_glyphs_for_staff) |
| 3140–3174 | `create_staff_lines` | → `assembly.rs` |
| 3175–3281 | `create_bar_lines` | → `barlines.rs` |
| 3282–3402 | `create_bar_line_segments` | → `barlines.rs` |
| 3403–3480 | `compute_repeat_dots` | → `barlines.rs` |
| 3481–3524 | `create_bracket_glyph` | → `staff_groups.rs` |
| 3526–5012 | `mod tests { ... }` (26 test functions) | distributed to relevant modules |

**Rationale**: Assignment is driven by cohesion (what data does the function operate on) and the clarification answers (one `annotations.rs` for ties/slurs/dots/ledger lines; no further splitting of barlines sub-functions).

**Alternatives considered**: Putting `shift_dot_to_space` in `annotations.rs` — rejected because it is called from within `position_glyphs_for_staff` and collocating reduces cross-module calls.

---

## 3. Inline Code Extraction from `compute_layout`

**Decision**: The `compute_layout` orchestrator body (lines 153–1764, ~1,612 lines) contains large inline code blocks that must be extracted to new module functions. These are:

| Inline block (approx lines) | Description | Extract to |
|----------------------------|-------------|------------|
| ~346–378 | Collision detection / inter-staff gap calculation | `staff_groups::compute_collision_gap` |
| ~381–459 | Unified note positions + measure boundary x-positions | `note_layout::compute_unified_note_positions` (already a fn) |
| ~612–646 | Clef, key sig, time sig structural glyph positioning | `structural::render_system_start_glyphs` |
| ~649–721 | Mid-system key changes + clef changes | `structural::render_mid_system_changes` |
| ~724–755 | Bar line creation + ledger lines (per staff) | `barlines::create_bar_lines` (already a fn) |
| ~758–998 | Notation dots (augmentation + staccato) | `annotations::render_notation_dots` |
| ~1001–1170 | Tie arcs (same-system, cross-system outgoing/incoming) | `annotations::render_ties` |
| ~1173–1390 | Slur arcs (same-system, cross-system) | `annotations::render_slurs` |
| ~1393–1525 | Multi-staff bracket glyphs + staff group assembly | `staff_groups::assemble_staff_groups` |
| ~1527–1625 | Barline joining for multi-staff + system-end barline | `barlines::render_system_barlines` |
| ~1628–1680 | Measure number annotation + volta bracket layout | `assembly::render_measure_numbers_and_voltas` |
| ~1692–1709 | Expand bounding box for stems/beams | `assembly::expand_bounding_box` |

After extraction, `compute_layout` becomes a thin coordination loop of ~300–400 lines.

**Rationale**: This is the key to meeting SC-001 (<600 lines in `mod.rs`). Each extracted function is a named, testable unit with clear inputs/outputs.

**Alternatives considered**: Leaving `compute_layout` as one large function and raising the SC-001 target — rejected per clarification Q1 answer (Option B).

---

## 4. Rust Visibility Strategy

**Decision**: Use `pub(crate)` for all functions extracted from `mod.rs` into sibling modules. Use `pub(super)` only for items that must be accessible to `mod.rs` directly (parent module). Keep internal helpers private (`fn`, no `pub`).

| Visibility | When to use |
|------------|-------------|
| `pub(crate)` | Functions called by `compute_layout` in `mod.rs` from a sibling module, or shared between sibling modules |
| `pub(super)` | Not needed — sibling modules cannot use `pub(super)` to reach `mod.rs`; use `pub(crate)` instead |
| `pub` | Only for items already public in the current `mod.rs` (`compute_layout`, `NoteData`, re-exports) |
| private (`fn`) | Helper functions used only within their own module |

**Rationale**: `pub(crate)` is the correct Rust idiom for intra-crate visibility without polluting the public API. Since all new modules are peers under `layout/`, using `pub(crate)` avoids any need for complex path re-exports.

**Alternatives considered**: Using `pub` for everything — rejected as it widens the public API surface unnecessarily. Using `pub(super)` — not applicable for sibling modules.

---

## 5. Test Distribution Strategy

**Decision**: Distribute the 26 test functions from `mod tests { ... }` into per-module `#[cfg(test)]` blocks based on which functions they exercise:

| Test function | Target module |
|--------------|---------------|
| `test_create_staff_lines_spacing` | `assembly.rs` |
| `test_create_staff_lines_multi_staff` | `assembly.rs` |
| `test_create_staff_lines_scale_independence` | `assembly.rs` |
| `test_structural_glyphs_populated` | `structural.rs` (calls `compute_layout`, stays in mod.rs if needed) |
| `test_piano_multi_staff_layout` | `staff_groups.rs` |
| `test_create_bracket_glyph_brace` | `staff_groups.rs` |
| `test_create_bracket_glyph_bracket` | `staff_groups.rs` |
| `test_notes_on_multi_staff` | `note_layout.rs` |
| `test_four_beamed_eighths_produce_noteheads_stems_beam` | `note_layout.rs` |
| `test_mixed_quarters_and_beamed_eighths` | `note_layout.rs` |
| `test_four_sixteenths_two_beam_levels` | `note_layout.rs` |
| `test_mixed_eighths_sixteenths_multi_level` | `note_layout.rs` |
| `test_stem_direction_high_notes_stems_down` | `note_layout.rs` |
| `test_uniform_stem_direction_mixed_positions` | `note_layout.rs` |
| `test_algorithmic_beaming_4_4` | `note_layout.rs` |
| `test_single_eighth_uses_flag` | `note_layout.rs` |
| `test_degenerate_single_note_group_uses_flag` | `note_layout.rs` |
| `test_beams_do_not_cross_barlines` | `note_layout.rs` |
| `test_beams_break_at_rests` | `note_layout.rs` |
| `test_compute_staff_note_extents_within_staff` | `note_layout.rs` |
| `test_compute_staff_note_extents_below_staff` | `note_layout.rs` |
| `test_collision_aware_spacing_increases_gap` | `staff_groups.rs` |
| `test_default_spacing_preserved_no_collision` | `staff_groups.rs` |
| `test_layout_2_4_measure_boundaries` | `mod.rs` (calls `compute_layout`) |
| `test_layout_3_4_measure_boundaries` | `mod.rs` (calls `compute_layout`) |
| `test_layout_4_4_measure_boundaries_unchanged` | `mod.rs` (calls `compute_layout`) |
| `test_time_signature_glyph_2_4` | `structural.rs` |
| `test_time_signature_glyph_6_8` | `structural.rs` |
| `test_layout_12_8_time_signature` | `mod.rs` (calls `compute_layout`) |

**Rationale**: Tests that call `compute_layout` directly must stay in or be accessible from `mod.rs` tests since they exercise the full pipeline. Tests that exercise individual helper functions move to their module.

**Alternatives considered**: Single `tests.rs` file — rejected per clarification Q2 answer (Option B).

---

## 6. `LayoutConfig` Migration to `types.rs`

**Decision**: Move the `LayoutConfig` struct (lines 32–53, ~22 lines including `Default` impl) from `mod.rs` to `types.rs`. All modules that need `LayoutConfig` import it via `use crate::layout::types::LayoutConfig` or use the re-export `use super::types::LayoutConfig`.

**Rationale**: `types.rs` is the established shared types module for this crate (already contains `GlobalLayout`, `System`, `Glyph`, etc.). Moving `LayoutConfig` there avoids circular dependencies since `types.rs` has no dependencies on other layout modules. Per clarification Q3 answer (Option A).

**Alternatives considered**: New `config.rs` — rejected as over-engineering for a 22-line struct.

---

## 7. README Mermaid Diagram Design

**Decision**: Produce a `flowchart TD` (top-down) mermaid diagram showing:
1. `compute_layout` (entry point) calling each extracted module function
2. All modules depending on `types.rs` via a single grouped arrow
3. Pre-existing modules (`spacer`, `breaker`, `positioner`, `batcher`, `beams`, `stems`) shown as already-modularized peers
4. `wasm.rs` shown as the external consumer

Per clarification Q4 answer (Option B) — call-flow only, no per-module type import arrows.

**Alternatives considered**: Layered phase diagram — option C was a good alternative but the call-flow (B) is more useful since developers will be looking up "which module is called by the orchestrator?"

---

## 8. Baseline Test Count & Regression Gate

**Decision**: Baseline is **160 tests all passing** (confirmed by `cargo test` run on 2026-03-18). This is the hard regression gate: after every module extraction step, `cargo test` must still show 0 failed.

**Rationale**: Measured directly. The incremental extraction strategy (one module at a time, compile+test after each) ensures any regression is immediately visible and attributable to a specific extraction step.

**Alternatives considered**: Only running tests at the end — rejected as it makes debugging regressions much harder.

---

## Summary: All NEEDS CLARIFICATION Resolved

| Item | Status |
|------|--------|
| Exact line ranges per function in mod.rs | ✅ Resolved via code inspection |
| Function-to-module assignment | ✅ Resolved |
| Inline extraction plan for `compute_layout` body | ✅ Resolved |
| Rust visibility strategy (`pub(crate)` vs `pub(super)`) | ✅ Resolved |
| Test distribution per module | ✅ Resolved |
| `LayoutConfig` target location | ✅ Resolved (types.rs) |
| Mermaid diagram detail level | ✅ Resolved (call-flow only) |
| Baseline test count | ✅ Resolved (160 tests, all passing) |
