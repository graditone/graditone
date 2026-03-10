# Research: Time Signatures

**Feature**: `044-time-signatures`  
**Date**: 2026-03-10  
**Phase**: 0 — Unknowns resolved

---

## 1. How does the MusicXML time signature currently flow through the system?

### Finding

The pipeline has two gaps that together cause all scores to display as 4/4:

**Gap 1 — Converter (`backend/src/domain/importers/musicxml/converter.rs`)**

The MusicXML parser correctly reads `<time><beats>N</beats><beat-type>D</beat-type></time>` into a `TimeSignatureData { beats, beat_type }` struct, stored in `MeasureAttributes.time`. However, the converter's `convert()` method at line ~214 ignores `attrs.time` and unconditionally writes:

```rust
let time_sig = TimeSignatureEvent::new(Tick::new(0), 4, 4);
score.add_time_signature_event(time_sig)?;
```

This happens in both the "default tempo" path and the "doc has tempo" path (the `if doc.default_tempo > 0.0` branch also re-adds hardcoded 4/4). The fix: read `doc.parts.first()?.measures.first()?.attributes?.time` and use `beats`/`beat_type` from it. Fall back to (4, 4) if absent.

**Gap 2 — Layout engine (`backend/src/layout/mod.rs`)**

The layout engine receives `time_signature: { numerator: N, denominator: D }` per staff from the JSON input and stores it in `StaffData { time_numerator, time_denominator }`. It already uses these values for glyph rendering, beam grouping, and rest centering in `positioner.rs`. However, the measure segmentation that creates `MeasureInfo` structs still hardcodes 3840 ticks in three places:

- **Lines 98–99**: `start_tick = i as u32 * 3840` (building MeasureInfo boundaries)
- **Line 478**: `let measure_num = (system.tick_range.start_tick / 3840) + 1` (measure number display)
- **Lines 572, 596**: `let measure_index = (start_tick / 3840) as usize` (note-to-measure bucketing for beam grouping)

The fix: extract the time signature from the JSON input early in `compute_layout`, compute `ticks_per_measure = (960 * 4 * numerator as u32) / denominator as u32`, and use this variable instead of literal `3840` in each of the four locations above.

**Decision**: Fix both gaps. They are independent and each is a small, targeted change.  
**Rationale**: Gap 1 is necessary to get real data into the model; Gap 2 is necessary to use that data in layout.  
**Alternatives considered**: Fixing only Gap 2 with a per-staff hardcoded 2/4 for Arabesque — rejected (not generic, not maintainable).

---

## 2. What is the correct formula for ticks-per-measure with integer arithmetic?

### Finding

**Decision**: `ticks_per_measure = (960 * 4 * numerator as u32) / denominator as u32`

**Rationale**: Constitution Principle IV requires integer arithmetic for all timing. The formula rewrites `PPQ × (4/denominator) × numerator` to avoid floating point by multiplying through: `(PPQ × 4 × numerator) / denominator`. Since 960 × 4 = 3840 and the denominator is always a power of 2 (2, 4, 8, 16), and 3840 = 2^7 × 30, the division is always exact.

Verification:

| Time Sig | Formula | Result |
|----------|---------|--------|
| 4/4 | (3840 × 4) / 4 | 3840 ✅ |
| 2/4 | (3840 × 2) / 4 | 1920 ✅ |
| 3/4 | (3840 × 3) / 4 | 2880 ✅ |
| 6/8 | (3840 × 6) / 8 | 2880 ✅ |
| 9/8 | (3840 × 9) / 8 | 4320 ✅ |
| 12/8 | (3840 × 12) / 8 | 5760 ✅ |
| 5/4 | (3840 × 5) / 4 | 4800 ✅ |
| 7/8 | (3840 × 7) / 8 | 3360 ✅ |

Note: `positioner.rs` already uses the equivalent formula `(time_numerator as u32) * (3840 / (time_denominator as u32))` for rest centering (line ~952). The same form applies here.

**Alternatives considered**: Floating-point formula `PPQ * (4.0 / denom) * num` — rejected (violates Constitution Principle IV).

---

## 3. Where in mod.rs must the time signature be extracted before measure segmentation?

### Finding

**Decision**: Extract from the first staff's `time_signature` field in the JSON input, before the `MeasureInfo` computation loop.

**Rationale**: The layout engine receives a JSON object with a `staffs` array, each with a `time_signature: {numerator, denominator}` field. All staves in a single score share the same time signature for this feature (spec Assumption). The time signature must be known before building `MeasureInfo` structs (the loop at lines 98–99) because those structs define the measure tick boundaries used throughout the rest of the layout computation.

The extraction pattern, consistent with existing code at lines 725–728:

```rust
// Extract from first staff (all staves share the same time signature)
let (time_numerator, time_denominator) = json_input["staffs"]
    .as_array()
    .and_then(|s| s.first())
    .map(|first| {
        let n = first["time_signature"]["numerator"].as_u64().unwrap_or(4) as u8;
        let d = first["time_signature"]["denominator"].as_u64().unwrap_or(4) as u8;
        (n, d)
    })
    .unwrap_or((4, 4));

let ticks_per_measure: u32 = (3840 * time_numerator as u32) / time_denominator as u32;
```

**Alternatives considered**: Adding `ticks_per_measure` as a top-level field in the JSON contract — rejected (over-engineering; derivable from existing fields at zero cost).

---

## 4. Does the converter read `attrs.time` anywhere today for the single-staff path?

### Finding

**Decision**: No. The single-staff path at converter lines 371–389 reads `attrs.clefs.first()` and `attrs.key`, but never `attrs.time`. Same for the multi-staff path (lines 318–340). Neither path forwards the parsed time signature into the domain model. The fix must be applied at the top-level `convert()` method, not inside `convert_part`, because the time signature is a global structural event on the `Score`, not per-instrument.

**Rationale**: Looking at the data model: `TimeSignatureEvent` is stored in `score.global_structural_events` (not on `Instrument` or `Staff`). The `convert()` method is the right place to add it — it has access to both `doc.parts[0].measures[0].attributes.time` and `score`.

The correct extraction pattern:

```rust
// Read time signature from first measure of first part
let (time_num, time_den) = doc.parts
    .first()
    .and_then(|p| p.measures.first())
    .and_then(|m| m.attributes.as_ref())
    .and_then(|a| a.time.as_ref())
    .map(|t| (t.beats as u8, t.beat_type as u8))
    .unwrap_or((4, 4));
```

**Alternatives considered**: Reading from `doc.default_time_signature` — the `MusicXMLDocument` struct doesn't have this field; the time signature lives exclusively in `MeasureAttributes.time`. No alternative path exists.

---

## 5. Are there existing tests that must stay green (regression surface)?

### Finding

**Decision**: The following tests directly use hardcoded 3840 or 4/4 JSON and must pass unchanged:

- `backend/src/layout/positioner.rs` inline tests: `test_position_time_signature_4_4`, `test_position_time_signature_3_4`, `test_position_time_signature_6_8` — these test `position_time_signature()`, which is not being changed. ✅ Pass unchanged.
- `backend/src/layout/positioner.rs` line ~1599: `assert!(is_full_measure_rest(3840, 4, 4))` — tests `is_full_measure_rest()` with explicit args. ✅ Pass unchanged.
- `backend/src/layout/mod.rs` inline tests at lines ~1874, ~1950: use `"time_signature": { "numerator": 4, "denominator": 4 }` in JSON fixtures. ✅ Pass unchanged (4/4 ticks_per_measure = 3840, identical result).
- Integration test `tests/rest_arabesque_diag.rs` — currently passes with whatever output is generated; after the fix, Arabesque will produce correct measure boundaries so this test must be updated to reflect correct rather than corrupted layout.

**Arabesque baseline**: Before the fix, the converter emits 4/4 for Arabesque, so the layout engine processes it as 4/4 (measures of 3840 ticks). After the fix, it uses 2/4 (measures of 1920 ticks). Any test asserting specific tick boundaries or measure counts for Arabesque must be updated as part of this feature.

**Alternatives considered**: Keeping a "legacy mode" flag to preserve 4/4 behavior for backward compatibility — rejected (the 4/4 behavior is a bug, not a feature; no users depend on wrong output).

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Why all scores show 4/4 | Two gaps: converter ignores `attrs.time`, layout hardcodes 3840 |
| Integer-safe ticks formula | `(3840 × numerator) / denominator` — exact for all power-of-2 denominators |
| Where to extract time sig in mod.rs | Before MeasureInfo loop; from first staff's `time_signature` JSON field |
| Where to read time sig in converter | In `convert()`, from `doc.parts[0].measures[0].attributes.time` |
| Regression surface | Existing mod.rs tests pass unchanged; Arabesque integration test needs update |
