# Contract: Layout Engine Rest Glyph Output

**Feature**: `043-score-rests`  
**Affected file**: `backend/src/layout/positioner.rs` (new function `position_rests_for_staff`)

---

## Summary

The layout engine gains a new function `position_rests_for_staff()` that converts `RestEvent` data into `Vec<Glyph>` output. These glyphs are added to the existing `Vec<Glyph>` returned by `position_glyphs_for_staff()`. No changes are required to the `Glyph` type or any downstream consumer.

---

## Function Signature

```rust
/// Position rest glyphs for a single staff within a system's tick range.
///
/// Returns a Vec<Glyph> containing one glyph per rest event in the tick range.
/// Full-measure rests are centered horizontally within the measure.
/// Multi-voice rests are offset vertically from the standard position.
pub fn position_rests_for_staff(
    rests: &[RestEvent],          // Rest events from all voices on this staff
    tick_to_x: &[(u32, f32)],    // Sorted (start_tick, x_position) pairs from note layout
    measure_bounds: &[(f32, f32)],// (start_x, end_x) per measure index
    time_numerator: u8,
    time_denominator: u8,
    multi_voice: bool,            // true if staff has >1 voice with content
    config: &LayoutConfig,
) -> Vec<Glyph>
```

---

## Output: Glyph (no changes to existing type)

Each rest produces exactly one `Glyph`:

| Field | Value |
|-------|-------|
| `codepoint` | SMuFL rest codepoint `\u{E4E3}`–`\u{E4E9}` (from `rest_glyph_codepoint()`) |
| `x` | Beat-offset x for partial rests; centered x for full-measure rests |
| `y` | Standard rest y + voice offset (from `rest_y()`) |
| `size` | Same font size as note glyphs (from `config.font_size`) |
| `source_ref` | `None` (rests do not reference a played note for highlight purposes) |

---

## Behavior Specification

### Tick Range Filtering
Only rests whose `start_tick` falls within the system's tick range are included. Identical to how notes are filtered in `position_glyphs_for_staff()`.

### X-Position: Normal Rest
Use the `tick_to_x` lookup: find the entry where `tick <= rest.start_tick` and use its corresponding x. This ensures rests follow the same proportional spacing as notes.

### X-Position: Full-Measure Rest
```
is_full_measure = rest.duration_ticks == time_numerator as u32 * (3840 / time_denominator as u32)

if is_full_measure:
    measure_index = rest.start_tick / ticks_per_measure
    (start_x, end_x) = measure_bounds[measure_index]
    rest_x = start_x + (end_x - start_x - REST_GLYPH_WIDTH) / 2.0
```

### Y-Position
```
base_y = match duration_ticks:
    >= 3840 → 1.0 * units_per_space   # whole: line 1 from top
    _       → 2.0 * units_per_space   # all others: middle line

voice_offset = if multi_voice:
    voice_number % 2 == 1 → -units_per_space   # Voice 1: up
    voice_number % 2 == 0 → +units_per_space   # Voice 2: down
  else: 0.0

final_y = base_y + voice_offset
```

---

## Spacer Integration

`compute_measure_widths()` in `spacer.rs` must be extended to receive rest durations alongside note durations:

### Before
```rust
pub fn compute_measure_width(note_durations: &[u32], config: &SpacingConfig) -> f32
```

### After
```rust
pub fn compute_measure_width(
    note_durations: &[u32],  // unchanged
    rest_durations: &[u32],  // NEW: rest durations in this measure to include in spacing
    config: &SpacingConfig,
) -> f32
```

Both slices are processed identically — `compute_note_spacing(d, config)` is called for each duration in both slices. The measure width accounts for all beat positions (notes and rests alike).

---

## Test Cases (specified before implementation)

| Test ID | Description | Input | Expected Output |
|---------|-------------|-------|-----------------|
| T-REST-01 | Quarter rest glyph codepoint | `note_type = "quarter"` | `\u{E4E5}` |
| T-REST-02 | Whole rest glyph codepoint | `note_type = "whole"` | `\u{E4E3}` |
| T-REST-03 | All 7 duration codepoints | note_types whole→64th | `\u{E4E3}`→`\u{E4E9}` |
| T-REST-04 | Fallback from duration_ticks | `note_type = None, ticks = 960` | `\u{E4E5}` (quarter) |
| T-REST-05 | Full-measure detection in 4/4 | `ticks = 3840, num=4, den=4` | `is_full_measure = true` |
| T-REST-06 | Not full-measure in 4/4 | `ticks = 960, num=4, den=4` | `is_full_measure = false` |
| T-REST-07 | Full-measure in 3/4 | `ticks = 2880, num=3, den=4` | `is_full_measure = true` |
| T-REST-08 | Whole rest y position | `ticks = 3840, voice=1, multi=false` | `y = units_per_space` |
| T-REST-09 | Quarter rest y in single-voice | `ticks = 960, voice=1, multi=false` | `y = 2.0 * units_per_space` |
| T-REST-10 | Voice 1 rest y in multi-voice | `ticks = 960, voice=1, multi=true` | `y = units_per_space` (shifted up) |
| T-REST-11 | Voice 2 rest y in multi-voice | `ticks = 960, voice=2, multi=true` | `y = 3.0 * units_per_space` (shifted down) |
| T-REST-12 | Integration: rest glyph in layout output | Parse MusicXML with quarter rest | `GlobalLayout` contains glyph with `\u{E4E5}` |
