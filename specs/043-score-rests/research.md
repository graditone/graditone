# Research: Rest Symbols in Scores

**Feature**: `043-score-rests`  
**Date**: 2026-03-10  
**Status**: Complete — no NEEDS CLARIFICATION items remain

---

## RES-001: Current Rest Data Flow

**Decision**: Rests are parsed from MusicXML but discarded before reaching the layout engine. They must be promoted to first-class entities across the full pipeline.

**Findings**:

The complete data flow for rests today:

```
MusicXMLParser::parse_note()
  → returns NoteData { pitch: None, duration, voice, staff, note_type, ... }
  ↓ (parser detects pitch = None at line ~411 in parser.rs)
RestData { duration, voice, staff }          ← note_type is DROPPED here
  ↓ (converter.rs lines 432-434, 479-481, 552-555, 623-626)
timing_context.advance_by_duration(rest_data.duration)?;
  ← REST IS DISCARDED — not stored in Voice or any output
```

The `Voice` domain model (`backend/src/domain/voice.rs`) contains only `interval_events: Vec<Note>`. No rest storage exists at any level downstream of the parser.

**Rationale**: The gap is well-defined. The implementation entails:
1. Extending `RestData` to preserve `note_type`
2. Introducing a `RestEvent` domain entity
3. Storing rests in `Voice.rest_events`
4. Propagating through the JSON contract
5. Consuming in the layout engine

---

## RES-002: SMuFL Rest Glyph Codepoints

**Decision**: Use the standard Bravura/SMuFL rest codepoints `\u{E4E3}` through `\u{E4E9}`.

**Findings**:

The project already uses SMuFL codepoints for notes (verified in `positioner.rs`). The rest glyph codepoints in the same font are:

| Duration | SMuFL Name | Codepoint | PPQ Ticks (960 PPQ) |
|----------|-----------|-----------|---------------------|
| Whole | `restWhole` | `\u{E4E3}` | 3840 |
| Half | `restHalf` | `\u{E4E4}` | 1920 |
| Quarter | `restQuarter` | `\u{E4E5}` | 960 |
| Eighth | `rest8th` | `\u{E4E6}` | 480 |
| 16th | `rest16th` | `\u{E4E7}` | 240 |
| 32nd | `rest32nd` | `\u{E4E8}` | 120 |
| 64th | `rest64th` | `\u{E4E9}` | 60 |

**Primary selection strategy**: Use the `note_type` string from MusicXML (`"whole"`, `"half"`, `"quarter"`, `"eighth"`, `"16th"`, `"32nd"`, `"64th"`) for direct glyph lookup — the same field already parsed for notes and preserved through `NoteData.note_type`.

**Fallback strategy**: If `note_type` is absent, compute from `duration_ticks` using threshold comparison (mirrors `get_notehead_codepoint()` in `positioner.rs`).

**Alternatives considered**: Deriving duration solely from divisions arithmetic. Rejected because `note_type` is already parsed and provides unambiguous duration class, avoiding floating-point division edge cases.

---

## RES-003: Standard Vertical Rest Positions

**Decision**: Use the standard engraving vertical positions per duration type; apply voice-based offset for multi-voice staves.

**Findings**:

Staff position is measured in half-spaces from the top staff line (line 0 at y=0, line 4 at y=80 for `units_per_space = 20`). Each staff space = 20 units (verified in positioner tests).

| Rest Type | Standard Position | Y (units, staff space = 20) |
|-----------|-------------------|------------------------------|
| Whole | Hangs from line 4 (second from top) | y ≈ 20 (line 1 counting from top) |
| Half | Sits on line 2 (middle line) | y ≈ 40 |
| Quarter | Centered on staff | y ≈ 40 |
| Eighth | Centered on staff | y ≈ 40 |
| 16th–64th | Centered on staff | y ≈ 40 |

**Multi-voice offsets**:
- Voice 1 (odd voices): shift up by 1 staff space (−20 units) from standard position
- Voice 2 (even voices): shift down by 1 staff space (+20 units) from standard position
- Only applied when the staff has more than one voice with content

**Rationale**: Standard engraving spec (Elaine Gould, "Behind Bars", pp. 67–68). Consistent with stem direction conventions already implemented for multi-voice notes.

---

## RES-004: Full-Measure Rest Detection

**Decision**: A rest is a full-measure rest if `duration_ticks == ticks_per_measure` where `ticks_per_measure = numerator * (3840 / denominator)` at 960 PPQ.

**Findings**:

`StaffData` already carries `time_numerator` and `time_denominator` (verified in `layout/mod.rs` lines 614–615). The formula at 960 PPQ:

```
ticks_per_measure = time_numerator as u32 * (3840 / time_denominator as u32)
```

Examples:
- 4/4: `4 * (3840/4)` = 3840 ticks ✓
- 3/4: `3 * (3840/4)` = 2880 ticks ✓
- 6/8: `6 * (3840/8)` = 2880 ticks ✓
- 2/2: `2 * (3840/2)` = 3840 ticks ✓

**Centering formula**:
```
rest_x = measure_start_x + (measure_width - rest_glyph_width) / 2
```

This uses the same `measure_start_x` and `measure_width` already computed by the layout engine during line breaking.

**Alternatives considered**: Relying on MusicXML `measure="yes"` attribute. Rejected per clarification Q2 — duration comparison is more robust and does not require additional parser complexity.

---

## RES-005: Layout Engine Integration Point

**Decision**: Add rest glyph generation in `position_glyphs_for_staff()` in `positioner.rs`, mirroring the existing note glyph generation pattern.

**Findings**:

The function `position_glyphs_for_staff()` (layout/mod.rs line 894) is the single entry point that converts `VoiceData` notes into `Vec<Glyph>`. It:
1. Filters notes by tick range
2. Groups into beam groups
3. Calls `positioner::position_noteheads()` and `positioner::position_note_accidentals()`
4. Collects all glyphs

The new `position_rests_for_staff()` function in `positioner.rs` will follow the same pattern:
1. Filter rests by tick range for the current system
2. Look up x-position from the tick→x map (same map used for notes)
3. Determine y-position from duration type + voice offset
4. For full-measure rests: use centering formula instead of tick→x
5. Return `Vec<Glyph>` with rest SMuFL codepoints

**Spacer extension**: `compute_measure_widths()` currently collects only note durations. It must also collect rest durations so measure width is computed correctly for rest-only and mixed measures.

---

## RES-006: JSON Contract Extension

**Decision**: Extend `Voice` to include `rest_events: Vec<RestEvent>` (serialized via serde); bump `SCORE_SCHEMA_VERSION` from 4 to 5.

**Findings**:

The `Voice` struct in `backend/src/domain/voice.rs` serializes via `#[derive(Serialize, Deserialize)]`. Adding a `rest_events` field with `#[serde(default, skip_serializing_if = "Vec::is_empty")]` is backward-compatible — old consumers that don't read `rest_events` continue to work. The `SCORE_SCHEMA_VERSION` in `dtos.rs` is already versioned (currently v4); bumping to v5 signals the schema change.

**No frontend changes required**: The frontend renderer already handles any `Glyph { codepoint, x, y, size }` produced by the layout engine. Rest glyphs are output using the identical `Glyph` struct — the renderer is completely unaware of whether a glyph represents a note or a rest.

---

## Summary: All Unknowns Resolved

| Research Item | Status | Key Decision |
|---------------|--------|-------------|
| RES-001: Current rest data flow | ✅ | Pipeline gap fully mapped |
| RES-002: SMuFL glyph codepoints | ✅ | `\u{E4E3}`–`\u{E4E9}` via note_type string lookup |
| RES-003: Vertical positions | ✅ | Standard engraving positions + voice offset ±20 units |
| RES-004: Full-measure detection | ✅ | Duration comparison against `numerator * (3840/denominator)` |
| RES-005: Layout integration point | ✅ | New `position_rests_for_staff()` in positioner.rs |
| RES-006: JSON contract | ✅ | `rest_events` in Voice, schema v5, backward-compatible |
