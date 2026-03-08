# Data Model: Repeat Barlines (041)

**Phase**: Phase 1
**Branch**: `041-repeat-barlines`
**Date**: 2026-06-25
**Spec**: [spec.md](spec.md)

## Overview

This feature introduces one new domain entity (`RepeatBarline`) and extends four existing structures (`Score`, `MeasureData`, `MeasureInfo`, `BarLine`). All domain types are defined in Rust and serialised to JSON via serde; TypeScript mirrors the JSON shape. No new database or persistent storage is required.

---

## Entity: RepeatBarline (NEW — Rust domain)

**File**: `backend/src/domain/repeat.rs`

**What it represents**: A single repeat marker attached to a measure boundary. Carries the measure index (for human-readable references and layout lookup) and the tick range of the host measure (for playback expansion without needing a separate measure boundary table).

**Lifecycle**: Created by `MusicXMLConverter` when building a `Score` from a parsed `MusicXMLDocument`. Immutable. Serialised as part of `Score.repeat_barlines`. Consumed by the layout engine and the frontend playback expander.

**Rust definition**:
```rust
// backend/src/domain/repeat.rs

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum RepeatBarlineType {
    Start,  // forward repeat — drawn at measure left edge
    End,    // backward repeat — drawn at measure right edge
    Both,   // forward + backward on same measure boundary
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RepeatBarline {
    pub measure_index: u32,          // 0-based index of the measure carrying this marker
    pub start_tick: u32,             // tick at the start of the host measure (960 PPQ)
    pub end_tick: u32,               // tick at the end of the host measure (960 PPQ)
    pub barline_type: RepeatBarlineType,
}
```

**La Candeur instances** (0-indexed measures):
| measure_index | start_tick | end_tick | barline_type |
|---|---|---|---|
| 7 | 26880 | 30720 | `End` |
| 8 | 30720 | 34560 | `Start` |
| 15 | 57600 | 61440 | `End` |

---

## Modified Entity: Score

**File**: `backend/src/domain/score.rs`

**Change**: Add `repeat_barlines` field. Defaults to an empty vec for scores without repeat data (no migration needed; legacy scores deserialise fine with `#[serde(default)]`).

```rust
pub struct Score {
    pub id: String,
    pub global_structural_events: Vec<GlobalStructuralEvent>,
    pub instruments: Vec<Instrument>,
    #[serde(default)]
    pub repeat_barlines: Vec<RepeatBarline>,  // NEW
}
```

**Serialised JSON shape** (included in WASM input):
```json
{
  "id": "...",
  "global_structural_events": [...],
  "instruments": [...],
  "repeat_barlines": [
    { "measure_index": 7, "start_tick": 26880, "end_tick": 30720, "barline_type": "End" },
    { "measure_index": 8, "start_tick": 30720, "end_tick": 34560, "barline_type": "Start" },
    { "measure_index": 15, "start_tick": 57600, "end_tick": 61440, "barline_type": "End" }
  ]
}
```

---

## Modified Entity: MeasureData (MusicXML importer)

**File**: `backend/src/domain/importers/musicxml/types.rs`

**Change**: Add parsing-time flags that the converter uses to populate `RepeatBarline` entries.

```rust
pub struct MeasureData {
    pub number: u32,
    pub attributes: Option<MeasureAttributes>,
    pub elements: Vec<MeasureElement>,
    pub start_repeat: bool,   // NEW — <barline location="left"><repeat direction="forward"/></barline>
    pub end_repeat: bool,     // NEW — <barline location="right"><repeat direction="backward"/></barline>
}
```

---

## Modified Entity: MeasureInfo (layout engine)

**File**: `backend/src/layout/breaker.rs`

**Change**: Add flags consumed by `create_bar_lines()` to select `BarLineType`.

```rust
pub struct MeasureInfo {
    pub width: f32,
    pub start_tick: u32,
    pub end_tick: u32,
    pub start_repeat: bool,    // NEW
    pub end_repeat: bool,      // NEW
}
```

---

## Modified Entity: BarLineType (layout engine output)

**File**: `backend/src/layout/types.rs`

**Change**: Add three repeat variants.

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum BarLineType {
    Single,
    Double,
    Final,
    RepeatStart,   // NEW — thin bar + thick bar, dots on right
    RepeatEnd,     // NEW — thick bar + thin bar, dots on left
    RepeatBoth,    // NEW — thick bar + thin + thick bar, dots on both sides
}
```

---

## New Type: RepeatDotPosition (layout engine output)

**File**: `backend/src/layout/types.rs`

**What it represents**: The computed screen-space coordinates of a single repeat dot. Values are in staff-space units relative to the system origin, identical to all other layout coordinates.

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RepeatDotPosition {
    pub x: f32,
    pub y: f32,
    pub radius: f32,
}
```

---

## Modified Entity: BarLine (layout engine output)

**File**: `backend/src/layout/types.rs`

**Change**: Add `dots` field for repeat barline types. Empty for `Single`, `Double`, and `Final`.

```rust
pub struct BarLine {
    pub segments: Vec<BarLineSegment>,
    pub bar_type: BarLineType,
    pub dots: Vec<RepeatDotPosition>,   // NEW — empty unless RepeatStart/End/Both
}
```

---

## TypeScript Mirror Types

**File**: `frontend/src/types/score.ts`

```typescript
export type RepeatBarlineType = 'Start' | 'End' | 'Both';

export interface RepeatBarline {
  measure_index: number;
  start_tick: number;
  end_tick: number;
  barline_type: RepeatBarlineType;
}

export interface Score {
  id: string;
  schema_version?: number;
  global_structural_events: GlobalStructuralEvent[];
  instruments: Instrument[];
  repeat_barlines?: RepeatBarline[];   // NEW — optional for legacy score compatibility
}
```

**File**: `frontend/src/wasm/layout.ts`

```typescript
export type BarLineType = 'Single' | 'Double' | 'Final' | 'RepeatStart' | 'RepeatEnd' | 'RepeatBoth';

export interface RepeatDot {
  x: number;
  y: number;
  radius: number;
}

export interface BarLine {
  segments: BarLineSegment[];
  bar_type: BarLineType;
  dots?: RepeatDot[];   // NEW — present and non-empty for repeat types
}
```

---

## Service: RepeatNoteExpander (NEW — TypeScript)

**File**: `frontend/src/services/playback/RepeatNoteExpander.ts`

**What it represents**: A pure, stateless transformation function. Takes the flat note array and the repeat barlines from the score, returns a tick-sorted expanded array with repeated sections duplicated.

**Interface**:
```typescript
// Input: notes sorted by start_tick (as returned from score.instruments[n].staves[m].voices[0].interval_events)
// Input: repeatBarlines from score.repeat_barlines (may be undefined → treated as [])
// Output: expanded notes sorted by start_tick; original objects are not mutated
export function expandNotesWithRepeats(
  notes: Note[],
  repeatBarlines: RepeatBarline[] | undefined
): Note[];
```

**Expansion invariants**:
- If `repeatBarlines` is empty or undefined → returns `notes` unchanged (identity).
- Notes in expanded clones have `start_tick` and `end_tick` offset by `sectionDuration = sectionEndTick - sectionStartTick`.
- Output is sorted ascending by `start_tick`.
- All tick arithmetic uses integer operations only (Principle IV).

**Repeat section pairing** (how `End` markers find their `Start`):
```
For each End marker at end_tick E:
  Find the nearest Start marker at start_tick S where S < E
  If none found → section starts at tick 0
  sectionStartTick = S (or 0)
  sectionEndTick   = E  (= end_tick of the End-marker measure)
```

**La Candeur expansion**:
```
Section A: sectionStartTick = 0,     sectionEndTick = 30720  (measures 1–8)
Section B: sectionStartTick = 30720, sectionEndTick = 61440  (measures 9–16)
```

Original stream: [0..30719] [30720..61439] [61440..88319]  (23 raw measures)
After A repeat:  [0..30719] [0+30720..30719+30720] [30720..61439] ...
= [0..30719] [30720..61439] [30720..61439] [61440..88319] ... (wait, this is wrong)

Actually the expansion inserts a copy after the section, with ticks offset:
```
Original:   [A: 0..30720) [B: 30720..61440) [C: 61440..88320)  (23 measures)
After A:    [A: 0..30720) [A': 30720..61440) [B shifted: 61440..92160) [B': 92160..122880) [C shifted: 122880..149760)
```
Wait — the expansion should add A' immediately after A, then shift everything after. But this would be complex. The simpler approach: generate a new array from scratch by replaying sections in order.

Correct algorithm description in the data model:
```
Build ordered playback plan:
  Section A:  tick_range [0, 30720),     repeated once → append notes twice
  Section B:  tick_range [30720, 61440), repeated once → append notes twice
  Section C:  tick_range [61440, ~),     not repeated  → append once

Tick offset for each pass:
  A pass 1: offset = 0
  A pass 2: offset = 30720
  B pass 1: offset = 61440 - 30720 = 30720  → notes at [30720..61440) + 30720 = [61440..92160)
  B pass 2: offset = 30720 + 30720          → notes at [30720..61440) + 61440 = [92160..122880)
  C pass 1: offset = 122880 - 61440 = 61440 → notes at [61440..~) + 61440
```

The correct model: iterate sections in order, tracking a running `tick_offset` accumulator. For each section, copy its notes with the current offset, then advance offset by `sectionDuration` before the repeat (or move to the end of the section for non-repeated parts).

**State transitions**: None — `RepeatNoteExpander` is a pure function with no side effects.
