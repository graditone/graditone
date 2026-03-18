# Module Contracts: Refactor Layout Engine

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-18  
**Branch**: `052-refactor-layout-engine`

This is a pure internal Rust refactoring. There are no HTTP API endpoints, REST contracts, or WASM interface changes. The contracts here define the **module-level public interface** — the functions and types exposed by each new module to its consumers within the `layout` crate.

---

## Unchanged Public API (External Contract)

The following constitute the external contract of the `layout` crate. These are **not modified** by this refactoring:

```rust
// layout/mod.rs — entry point (unchanged signature)
pub fn compute_layout(score: &serde_json::Value, config: &LayoutConfig) -> GlobalLayout

// layout/types.rs — all types re-exported from mod.rs (unchanged)
pub use types::{
    BarLine, BarLineSegment, BarLineType, BoundingBox, BracketGlyph, BracketType, Color,
    GlobalLayout, Glyph, GlyphRun, LedgerLine, MeasureNumber, NameLabel, Point,
    RepeatDotPosition, SourceReference, Staff, StaffGroup, StaffLine, System, TickRange,
    VoltaBracketLayout,
};
pub use breaker::MeasureInfo;
pub use types::LayoutConfig;  // MOVED from mod.rs inline definition → still re-exported
```

The WASM consumer (`wasm.rs`) calls only `compute_layout` and reads `GlobalLayout`. This is not affected.

---

## New Module Contracts (Internal `pub(crate)`)

### `extraction.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
// Types (pub(crate))
pub(crate) struct InstrumentData { id, name, staves: Vec<StaffData> }
pub(crate) struct StaffData { voices, clef, time_numerator, time_denominator, key_sharps,
                               key_signature_events, clef_events }
pub(crate) struct VoiceData { notes: Vec<NoteEvent>, rests: Vec<RestLayoutEvent> }
pub(crate) struct NoteEvent { pitch, start_tick, duration_ticks, spelling, beam_info,
                               staccato, dot_count, note_id, tie_next, slur_next, slur_above }
pub(crate) struct RestLayoutEvent { start_tick, duration_ticks, note_type, voice }
pub type NoteData = (u8, u32, u32, Option<(char, i8)>, bool, u8);  // kept pub

// Tick helpers
pub(crate) fn measure_start_tick(measure_index, pickup_ticks, ticks_per_measure) -> u32
pub(crate) fn measure_end_tick(measure_index, pickup_ticks, ticks_per_measure) -> u32
pub(crate) fn tick_to_measure_index(tick, pickup_ticks, ticks_per_measure) -> usize
pub(crate) fn actual_start(measure_index, actual_ends, pickup_ticks, tpm) -> u32
pub(crate) fn actual_end(measure_index, actual_ends, pickup_ticks, tpm) -> u32
pub(crate) fn actual_tick_to_measure(tick, actual_ends, pickup_ticks, tpm) -> usize

// Extraction functions
pub(crate) fn extract_measures(score: &serde_json::Value, ...) -> Vec<(Vec<u32>, Vec<u32>)>
pub(crate) fn extract_instruments(score: &serde_json::Value) -> Vec<InstrumentData>
```

---

### `note_layout.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
pub(crate) fn compute_unified_note_positions(
    instruments: &[InstrumentData],
    measure_infos: &[MeasureInfo],
    system_measures: &[usize],
    config: &LayoutConfig,
    left_margin: f32,
    system_width: f32,
) -> HashMap<u32, f32>

pub(crate) fn position_glyphs_for_staff(
    staff_data: &StaffData,
    note_positions: &HashMap<u32, f32>,
    config: &LayoutConfig,
    staff_vertical_offset: f32,
    measure_infos: &[MeasureInfo],
    system_measures: &[usize],
    // ... additional params
) -> Vec<Glyph>

pub(crate) fn compute_staff_note_extents(
    glyphs: &[Glyph],
    staff_offset: f32,
    units_per_space: f32,
) -> (f32, f32)  // (min_y, max_y)

pub(crate) fn shift_dot_to_space(y: f32, staff_offset: f32, units_per_space: f32) -> f32
```

---

### `barlines.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
pub(crate) fn create_bar_lines(
    measure_x_positions: &[f32],
    system_height: f32,
    staff_offset: f32,
    repeat_barlines: &[(usize, BarLineType)],
) -> Vec<BarLine>

pub(crate) fn create_bar_line_segments(
    bar_lines: &[BarLine],
    system_height: f32,
    // ...
) -> Vec<BarLineSegment>

pub(crate) fn compute_repeat_dots(bar_lines: &[BarLine], units_per_space: f32) -> Vec<RepeatDotPosition>

// Extracted from compute_layout inline blocks:
pub(crate) fn render_system_barlines(
    system_end_x: f32,
    staves: &[StaffData],
    staff_offsets: &[f32],
    system_height: f32,
    is_last_system: bool,
) -> (Vec<BarLine>, Vec<BarLineSegment>)
```

---

### `structural.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
// Extracted from compute_layout inline blocks:
pub(crate) fn render_system_start_glyphs(
    staff_data: &StaffData,
    is_first_system: bool,
    x_position: f32,
    staff_vertical_offset: f32,
    config: &LayoutConfig,
) -> Vec<Glyph>

pub(crate) fn render_mid_system_changes(
    staff_data: &StaffData,
    measure_x_positions: &[f32],
    system_measures: &[usize],
    staff_vertical_offset: f32,
    config: &LayoutConfig,
) -> Vec<Glyph>
```

---

### `staff_groups.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
pub(crate) fn create_bracket_glyph(
    bracket_type: BracketType,
    top_staff_offset: f32,
    bottom_staff_offset: f32,
    staff_height: f32,
    x_position: f32,
) -> BracketGlyph

// Extracted from compute_layout inline blocks:
pub(crate) fn compute_collision_gap(
    staves: &[Vec<Glyph>],
    staff_offsets: &[f32],
    units_per_space: f32,
) -> f32

pub(crate) fn assemble_staff_groups(
    instruments: &[InstrumentData],
    staff_glyph_runs: &[Vec<Glyph>],
    staff_offsets: &[f32],
    system_width: f32,
    config: &LayoutConfig,
) -> Vec<StaffGroup>
```

---

### `assembly.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
pub(crate) fn create_staff_lines(
    staff_vertical_offset: f32,
    system_width: f32,
    units_per_space: f32,
) -> Vec<StaffLine>

// Extracted from compute_layout inline blocks:
pub(crate) fn render_measure_numbers_and_voltas(
    system_measures: &[usize],
    measure_x_positions: &[f32],
    system_y: f32,
    volta_brackets: &[(usize, usize, u8)],
    units_per_space: f32,
) -> (Vec<MeasureNumber>, Vec<VoltaBracketLayout>)

pub(crate) fn expand_bounding_box(
    bbox: BoundingBox,
    glyphs: &[Glyph],
) -> BoundingBox
```

---

### `annotations.rs`

**Consumer**: `mod.rs` (`compute_layout`)

```rust
// Extracted from compute_layout inline blocks:
pub(crate) fn render_notation_dots(
    note_events: &[NoteEvent],
    note_positions: &HashMap<u32, f32>,
    staff_vertical_offset: f32,
    units_per_space: f32,
) -> Vec<Glyph>

pub(crate) fn render_ties(
    note_events: &[NoteEvent],
    note_positions: &HashMap<u32, f32>,
    system_measures: &[usize],
    staff_vertical_offset: f32,
    units_per_space: f32,
    // cross-system context
) -> Vec<Glyph>

pub(crate) fn render_slurs(
    note_events: &[NoteEvent],
    note_positions: &HashMap<u32, f32>,
    system_measures: &[usize],
    staff_vertical_offset: f32,
    units_per_space: f32,
) -> Vec<Glyph>
```

---

## Contract Guarantees

1. **Output determinism**: Given identical inputs, all extracted functions produce identical outputs to the original inline code. This is enforced by the zero-regression test requirement (160 tests, all passing).
2. **No side effects**: All functions are pure (no global state, no I/O). This property is preserved in extracted modules.
3. **No new panics**: No new `unwrap()` or `expect()` calls are introduced. Existing panic points are preserved verbatim.
4. **No lifetime changes**: All function parameters that were references remain references; no new owned values are introduced that would alter borrow semantics.
