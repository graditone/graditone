# Quickstart: Time Signatures

**Feature**: `044-time-signatures`  
**Date**: 2026-03-10

## What Changes

Two targeted Rust changes — no frontend changes needed.

```
backend/src/domain/importers/musicxml/converter.rs   ← Gap 1: forward parsed time sig
backend/src/layout/mod.rs                            ← Gap 2: replace hardcoded 3840
```

## Gap 1 — Fix the Converter

**File**: `backend/src/domain/importers/musicxml/converter.rs`

**Where**: The `convert()` method. Currently at line ~214:

```rust
// BEFORE (hardcoded — always 4/4 regardless of score)
let time_sig = TimeSignatureEvent::new(Tick::new(0), 4, 4);
score.add_time_signature_event(time_sig)?;
```

**Fix**: Read the time signature from the first measure of the first part:

```rust
// AFTER — read from parsed MusicXML document
let (time_num, time_den) = doc.parts
    .first()
    .and_then(|p| p.measures.first())
    .and_then(|m| m.attributes.as_ref())
    .and_then(|a| a.time.as_ref())
    .map(|t| (t.beats as u8, t.beat_type as u8))
    .unwrap_or((4, 4));  // Default to 4/4 if not specified

let time_sig = TimeSignatureEvent::new(Tick::new(0), time_num, time_den);
score.add_time_signature_event(time_sig)?;
```

**Same fix applies** to the "doc has tempo" branch (lines ~212–215) where the same hardcoded `TimeSignatureEvent::new(Tick::new(0), 4, 4)` appears after `score.global_structural_events.clear()`.

## Gap 2 — Fix the Layout Engine

**File**: `backend/src/layout/mod.rs`

**Step 1**: Extract time signature from JSON input early in the layout function (before the MeasureInfo loop). Add this near the top of the function where other top-level JSON fields are parsed:

```rust
// Extract time signature from first staff (all staves share the same meter)
let (time_numerator, time_denominator) = json_input["staffs"]
    .as_array()
    .and_then(|s| s.first())
    .map(|first| {
        let n = first["time_signature"]["numerator"].as_u64().unwrap_or(4) as u32;
        let d = first["time_signature"]["denominator"].as_u64().unwrap_or(4) as u32;
        (n, d)
    })
    .unwrap_or((4, 4));

let ticks_per_measure: u32 = (3840 * time_numerator) / time_denominator;
```

**Step 2**: Replace the four hardcoded `3840` occurrences in measure segmentation:

| Location | Before | After |
|----------|--------|-------|
| MeasureInfo start tick (line ~98) | `i as u32 * 3840` | `i as u32 * ticks_per_measure` |
| MeasureInfo end tick (line ~99) | `start_tick + 3840` | `start_tick + ticks_per_measure` |
| Measure number from system tick (line ~478) | `start_tick / 3840` | `start_tick / ticks_per_measure` |
| Note-to-measure index (lines ~572, ~596) | `start_tick / 3840` | `start_tick / ticks_per_measure` |

> The `3840` constants in `positioner.rs` for rest glyph detection and whole-note threshold are **not changed** — those refer to the duration of a whole note (always 3840 ticks regardless of time signature), not to a measure boundary.

## Build & Test

```bash
# Run all backend tests (must pass before and after change)
cd backend && cargo test

# Run specifically the layout tests
cd backend && cargo test layout

# Build WASM for integration test
cd backend && wasm-pack build --target web

# Run frontend tests
cd frontend && npm test

# Open Arabesque in browser and verify:
# - Time signature glyph shows "2/4"
# - Barlines appear every 2 beats
# - Measure count matches original (24 measures in Arabesque)
```

## Expected Results After Fix

| Score | Before Fix | After Fix |
|-------|-----------|-----------|
| Arabesque | 4/4 glyph, barlines every 4 beats | 2/4 glyph, barlines every 2 beats |
| Für Elise | 3/4 glyph, barlines every 4 beats | 3/4 glyph, barlines every 3 beats |
| Canon in D | 4/4 glyph, barlines every 4 beats | 4/4 glyph, barlines every 4 beats (unchanged) |
| Nocturne Op.9 No.2 | 4/4 glyph (actually 12/8!) | 12/8 glyph, barlines at correct position |

> Note: Für Elise and Nocturne will also be fixed as a side effect of this generic implementation.

## Test Cases to Write (TDD — before code)

### Rust unit tests (converter.rs)

1. `test_import_2_4_time_signature` — import a minimal MusicXML with `<beats>2</beats><beat-type>4</beat-type>`, assert score has `TimeSignatureEvent { numerator: 2, denominator: 4 }` at tick 0
2. `test_import_3_4_time_signature` — same for 3/4
3. `test_import_6_8_time_signature` — same for 6/8
4. `test_import_default_time_signature` — MusicXML with no `<time>` element, assert defaults to 4/4

### Rust unit tests (mod.rs / layout engine)

5. `test_layout_2_4_measure_boundaries` — layout with `time_signature: {numerator: 2, denominator: 4}`, assert MeasureInfo start ticks are 0, 1920, 3840, ...
6. `test_layout_3_4_measure_boundaries` — assert start ticks are 0, 2880, 5760, ...
7. `test_layout_4_4_measure_boundaries_unchanged` — existing 4/4 behavior preserved, start ticks 0, 3840, 7680, ...

### Integration test

8. Update/add to `tests/rest_arabesque_diag.rs` — import the real Arabesque MusicXML, assert time signature is 2/4 and first few measure boundaries are at 0, 1920, 3840 ticks.
