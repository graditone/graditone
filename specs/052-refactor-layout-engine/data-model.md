# Data Model: Refactor Layout Engine

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-18  
**Branch**: `052-refactor-layout-engine`

This document describes the **module data model** — the entities (types/structs/functions) that move between modules and the ownership boundaries that result from the refactoring. No new domain types are introduced; this is a reorganization of existing types.

---

## Entity Map: Before → After

### Types Moving OUT of `mod.rs`

| Type / Alias | Current location | Target module | Visibility change |
|-------------|-----------------|---------------|-------------------|
| `LayoutConfig` | `mod.rs` line 32 | `types.rs` | `pub` (unchanged) |
| `InstrumentData` | `mod.rs` line 1912 | `extraction.rs` | `pub(crate)` |
| `StaffData` | `mod.rs` line 1920 | `extraction.rs` | `pub(crate)` |
| `VoiceData` | `mod.rs` line 1969 | `extraction.rs` | `pub(crate)` |
| `NoteEvent` | `mod.rs` line 1992 | `extraction.rs` | `pub(crate)` |
| `RestLayoutEvent` | `mod.rs` line 1976 | `extraction.rs` | `pub(crate)` |
| `NoteData` (type alias) | `mod.rs` line 1988 | `extraction.rs` | `pub` (unchanged — currently `pub type`) |

### Functions Moving OUT of `mod.rs`

#### → `extraction.rs`

| Function | Signature (key params) | Visibility |
|----------|----------------------|------------|
| `measure_start_tick` | `(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32` | `pub(crate)` |
| `measure_end_tick` | `(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32` | `pub(crate)` |
| `tick_to_measure_index` | `(tick: u32, pickup_ticks: u32, ticks_per_measure: u32) -> usize` | `pub(crate)` |
| `actual_start` | `(measure_index: usize, actual_ends: &[u32], pickup_ticks: u32, tpm: u32) -> u32` | `pub(crate)` |
| `actual_end` | `(measure_index: usize, actual_ends: &[u32], pickup_ticks: u32, tpm: u32) -> u32` | `pub(crate)` |
| `actual_tick_to_measure` | `(tick: u32, actual_ends: &[u32], pickup_ticks: u32, tpm: u32) -> usize` | `pub(crate)` |
| `extract_measures` | `(score: &serde_json::Value, ...) -> Vec<(Vec<u32>, Vec<u32>)>` | `pub(crate)` |
| `extract_instruments` | `(score: &serde_json::Value) -> Vec<InstrumentData>` | `pub(crate)` |

#### → `note_layout.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `compute_unified_note_positions` | Tick → x-position mapping for all staves | `pub(crate)` |
| `position_glyphs_for_staff` | Full note/chord/beam/accidental positioning for one staff | `pub(crate)` |
| `compute_staff_note_extents` | Vertical min/max of notes (with stems) | `pub(crate)` |
| `shift_dot_to_space` | Adjust dot y to avoid staff lines | `pub(crate)` |

#### → `barlines.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `create_bar_lines` | Position barlines at measure boundaries | `pub(crate)` |
| `create_bar_line_segments` | Generate explicit barline geometry (single/double/final/repeat) | `pub(crate)` |
| `compute_repeat_dots` | Position repeat dots on barlines | `pub(crate)` |
| `render_system_barlines` | System-end barline + multi-staff barline joining (extracted from compute_layout) | `pub(crate)` |

#### → `structural.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `render_system_start_glyphs` | Clef, key sig, time sig at system start (extracted from compute_layout) | `pub(crate)` |
| `render_mid_system_changes` | Mid-system key changes and clef changes (extracted from compute_layout) | `pub(crate)` |

#### → `staff_groups.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `create_bracket_glyph` | Brace/bracket geometry for multi-staff groups | `pub(crate)` |
| `compute_collision_gap` | Inter-staff collision detection → extra vertical spacing (extracted from compute_layout) | `pub(crate)` |
| `assemble_staff_groups` | Staff group assembly + barline joining for multi-staff (extracted from compute_layout) | `pub(crate)` |

#### → `assembly.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `create_staff_lines` | 5 staff lines with correct y-positions | `pub(crate)` |
| `render_measure_numbers_and_voltas` | Measure number annotation + volta bracket layout (extracted from compute_layout) | `pub(crate)` |
| `expand_bounding_box` | Expand system bounding box for stems/beams (extracted from compute_layout) | `pub(crate)` |

#### → `annotations.rs`

| Function | Key responsibility | Visibility |
|----------|-------------------|------------|
| `render_notation_dots` | Augmentation dots + staccato dots (extracted from compute_layout) | `pub(crate)` |
| `render_ties` | Same-system, cross-system outgoing, cross-system incoming tie arcs (extracted from compute_layout) | `pub(crate)` |
| `render_slurs` | Same-system and cross-system slur arcs (extracted from compute_layout) | `pub(crate)` |

---

## Module Dependency Graph

```
types.rs          ← All modules import LayoutConfig and layout types from here
  ↑
extraction.rs     ← imports: types.rs, serde_json
note_layout.rs    ← imports: types.rs, extraction.rs (NoteEvent, InstrumentData), positioner.rs, beams.rs, stems.rs, metrics.rs
barlines.rs       ← imports: types.rs
structural.rs     ← imports: types.rs, positioner.rs, metrics.rs
staff_groups.rs   ← imports: types.rs
assembly.rs       ← imports: types.rs, breaker.rs (MeasureInfo)
annotations.rs    ← imports: types.rs, extraction.rs (NoteEvent)
mod.rs            ← imports: all of the above + spacer.rs, breaker.rs (orchestrator only)
```

No circular dependencies — the graph is a DAG.

---

## State Transitions

This is a pure structural refactoring with no runtime state changes. The `compute_layout` function takes `(&serde_json::Value, &LayoutConfig)` and returns `GlobalLayout`. This signature is **unchanged**.

The internal computation flow — extract → space → break → position → annotate → assemble — is also unchanged; only the code locality of each phase changes.

---

## Validation Rules Preserved

All existing validation invariants in `StaffData` methods (`get_key_at_tick`, `get_clef_at_tick`) and `NoteEvent` constraints are preserved verbatim — moved to `extraction.rs` without alteration.
