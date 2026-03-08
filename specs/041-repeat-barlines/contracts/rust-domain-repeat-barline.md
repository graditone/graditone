# Internal API Contract: Rust Domain — RepeatBarline Entity

**Feature**: 041-repeat-barlines
**Scope**: Rust domain layer + MusicXML importer adapter
**Date**: 2026-06-25

## Context

This contract defines the authoritative Rust types for repeat barline data, the parsing rules for MusicXML input, and the serialisation shape emitted to the WASM consumer. TypeScript types mirror this contract exactly.

---

## Contract 1: RepeatBarlineType Enum

**File**: `backend/src/domain/repeat.rs`

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum RepeatBarlineType {
    Start,   // forward repeat — barline at left edge of host measure
    End,     // backward repeat — barline at right edge of host measure
    Both,    // both forward and backward on same measure boundary
}
```

**Constraint**: `Both` is used only when a single measure carries both `start_repeat` AND `end_repeat` flags from the MusicXML parser. It is NOT produced by pairing adjacent `End` + `Start` across two different measures (that pairing produces one `End` and one `Start` instance).

---

## Contract 2: RepeatBarline Struct

**File**: `backend/src/domain/repeat.rs`

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RepeatBarline {
    pub measure_index: u32,       // 0-based measure index
    pub start_tick: u32,          // tick at start of the host measure (960 PPQ)
    pub end_tick: u32,            // tick at end of the host measure (960 PPQ, exclusive)
    pub barline_type: RepeatBarlineType,
}
```

**Constraint**: `start_tick` and `end_tick` are derived from the measure tick grid at parse time and MUST be consistent with `Score.global_structural_events` timing. All values are 32-bit unsigned integers (960 PPQ, Principle IV).

---

## Contract 3: Score.repeat_barlines Field

**File**: `backend/src/domain/score.rs`

```rust
#[serde(default)]
pub repeat_barlines: Vec<RepeatBarline>,
```

**Constraint**: The field uses `#[serde(default)]` so deserialising a legacy score JSON (without the field) yields an empty vec, not an error. Importing a score with no repeat barlines MUST produce `repeat_barlines: []`.

---

## Contract 4: MusicXML Parsing Rules

**File**: `backend/src/domain/importers/musicxml/parser.rs`

**Parse target**: `<barline>` elements inside `<measure>`.

| MusicXML element | Condition | Effect on `MeasureData` |
|---|---|---|
| `<barline location="left"><repeat direction="forward"/></barline>` | Any | `start_repeat = true` |
| `<barline location="right"><repeat direction="backward"/></barline>` | Any | `end_repeat = true` |
| All other `<barline>` elements | — | Ignored (no effect on repeat flags) |

**Constraint**: The parser MUST NOT fail or panic on unknown barline styles or absent `<repeat>` child elements. Non-repeat barlines are silently skipped.

---

## Contract 5: Converter — RepeatBarline Population

**File**: `backend/src/domain/importers/musicxml/converter.rs`

**Pre-conditions**: `MeasureData` slice has been fully parsed (all measures present).

**Algorithm**:
```
For each MeasureData at index i:
  start_tick = i * ticks_per_measure   (derived from time signature; 4/4 = 3840)
  end_tick   = start_tick + ticks_per_measure

  if measure.start_repeat && measure.end_repeat:
    push RepeatBarline { measure_index: i, start_tick, end_tick, barline_type: Both }
  else if measure.start_repeat:
    push RepeatBarline { measure_index: i, start_tick, end_tick, barline_type: Start }
  else if measure.end_repeat:
    push RepeatBarline { measure_index: i, start_tick, end_tick, barline_type: End }
```

**Post-conditions**: `Score.repeat_barlines` is sorted ascending by `measure_index`. For La Candeur: exactly 3 entries (indices 7, 8, 15).

---

## Summary: New Types

| Type | Location | Serialised Key |
|---|---|---|
| `RepeatBarlineType` | `domain/repeat.rs` | `"Start"` \| `"End"` \| `"Both"` |
| `RepeatBarline` | `domain/repeat.rs` | `{ measure_index, start_tick, end_tick, barline_type }` |
| `Score.repeat_barlines` | `domain/score.rs` | `repeat_barlines: [...]` (default `[]`) |
