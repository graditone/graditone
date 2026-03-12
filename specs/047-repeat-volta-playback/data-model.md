# Data Model: Volta Bracket Playback (Repeat Endings)

**Feature**: 047-repeat-volta-playback  
**Phase**: 1 — Design  
**Date**: 2026-03-12

---

## New Domain Entity: `VoltaBracket`

Represents one bracket region in the score (one first-ending or one second-ending bracket).

### Rust (`backend/src/domain/repeat.rs`)

```rust
/// The type of the right end of a volta bracket
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoltaEndType {
    /// Right side closed with a vertical stroke (MusicXML type="stop")
    Stop,
    /// Right side open, no closing vertical stroke (MusicXML type="discontinue")
    Discontinue,
}

/// A volta bracket (first or second ending) anchored to a tick range in the score
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VoltaBracket {
    /// Ending number: 1 = first ending, 2 = second ending
    pub number: u8,
    /// 0-based measure index of the first measure under the bracket
    pub start_measure_index: u32,
    /// 0-based measure index of the last measure under the bracket (inclusive)
    pub end_measure_index: u32,
    /// Tick position at the start of the bracket (inclusive)
    pub start_tick: u32,
    /// Tick position at the end of the bracket (exclusive)
    pub end_tick: u32,
    /// Whether the right end of the bracket is closed (stop) or open (discontinue)
    pub end_type: VoltaEndType,
}
```

### TypeScript (`frontend/src/types/score.ts`)

```typescript
/** Right-end style of a volta bracket */
export type VoltaEndType = 'Stop' | 'Discontinue';

/** A volta bracket (first or second ending) in the score (Feature 047) */
export interface VoltaBracket {
  /** 1 = first ending, 2 = second ending */
  number: 1 | 2;
  /** 0-based measure index of the first measure under the bracket */
  start_measure_index: number;
  /** 0-based measure index of the last measure under the bracket (inclusive) */
  end_measure_index: number;
  /** Tick position at the start of the bracket (inclusive) */
  start_tick: number;
  /** Tick position at the end of the bracket (exclusive) */
  end_tick: number;
  /** Whether the right end is closed (stop) or open (discontinue) */
  end_type: VoltaEndType;
}
```

---

## `Score` Struct Changes

### Rust (`backend/src/domain/score.rs`)

```rust
pub struct Score {
    // ... existing fields ...

    /// Repeat barlines parsed from the score source (Feature 041)
    pub repeat_barlines: Vec<RepeatBarline>,

    /// Volta brackets (first/second endings) parsed from the score source (Feature 047)
    pub volta_brackets: Vec<VoltaBracket>,  // NEW
}
```

Default in `Score::new()`: `volta_brackets: Vec::new()`

### TypeScript (`frontend/src/types/score.ts`)

```typescript
export interface Score {
  // ... existing fields ...

  /** Repeat barlines (Feature 041) */
  repeat_barlines?: RepeatBarline[];

  /** Volta brackets / first-second endings (Feature 047) */
  volta_brackets?: VoltaBracket[];  // NEW
}
```

---

## `ScoreDto` Changes (Rust, `backend/src/adapters/dtos.rs`)

```rust
const SCORE_SCHEMA_VERSION: u32 = 7;  // was 6; v7: volta_brackets added

pub struct ScoreDto {
    // ... existing fields ...

    /// v4: Added repeat_barlines
    pub repeat_barlines: Vec<RepeatBarline>,

    /// v7: Added volta_brackets (Feature 047); serde default = [] for pre-v7 scores
    #[serde(default)]
    pub volta_brackets: Vec<VoltaBracket>,  // NEW
}

impl From<&Score> for ScoreDto {
    fn from(score: &Score) -> Self {
        ScoreDto {
            // ...
            repeat_barlines: score.repeat_barlines.clone(),
            volta_brackets: score.volta_brackets.clone(),  // NEW
        }
    }
}
```

---

## MusicXML Parser Intermediate Types

### `RawEndingData` (private, `backend/src/domain/importers/musicxml/parser.rs`)

```rust
/// Intermediate type capturing a single <ending> element during barline parsing
struct RawEndingData {
    /// From MusicXML `number` attribute (typically "1" or "2")
    pub number: u8,
    /// Parsed from MusicXML `type` attribute
    pub end_type: EndingParseType,
}

enum EndingParseType { Start, Stop, Discontinue }
```

### `ParsedBarlineResult` (private)

```rust
struct ParsedBarlineResult {
    pub start_repeat: bool,
    pub end_repeat: bool,
    pub ending: Option<RawEndingData>,
}
```

---

## Layout Output Types

### Rust (`backend/src/layout/types.rs`)

```rust
/// A positioned volta bracket in layout coordinates (Feature 047)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoltaBracketLayout {
    /// Ending number (1 or 2)
    pub number: u8,
    /// Display label ("1." or "2.")
    pub label: String,
    /// x-position of the left edge of the horizontal bracket line
    pub x_start: f32,
    /// x-position of the right edge of the horizontal bracket line
    pub x_end: f32,
    /// y-position of the bracket line (above the topmost staff line)
    pub y: f32,
    /// true = render a closing vertical stroke at the right end; false = open
    pub closed_right: bool,
}
```

The existing `System` struct gains one new field:

```rust
pub struct System {
    // ... existing fields ...

    /// Positioned volta brackets for this system (Feature 047)
    pub volta_bracket_layouts: Vec<VoltaBracketLayout>,  // NEW
}
```

### TypeScript (`frontend/src/wasm/layout.ts`)

```typescript
/**
 * A positioned volta bracket (first/second ending line) in layout coordinates (Feature 047)
 */
export interface VoltaBracketLayout {
  /** 1 = first ending, 2 = second ending */
  number: 1 | 2;
  /** Display label, e.g. "1." */
  label: string;
  /** x-position of the left edge of the bracket in logical units */
  x_start: number;
  /** x-position of the right edge of the bracket in logical units */
  x_end: number;
  /** y-position of the bracket line in logical units (above topmost staff line) */
  y: number;
  /** true = render closing vertical stroke at right; false = open */
  closed_right: boolean;
}

export interface System {
  // ... existing fields ...

  /** Positioned volta brackets for rendering (Feature 047) */
  volta_bracket_layouts?: VoltaBracketLayout[];  // NEW
}
```

---

## Validation Rules

1. `VoltaBracket.number` must be 1 or 2. Elements with other numbers are silently ignored during import.
2. `start_tick < end_tick` always holds (invariant enforced during mapper construction).
3. Each `VoltaBracket` must be associated with a specific repeat section (its `start_tick` must fall within a repeat region). The mapper derives this from the measured tick positions.
4. Two volta brackets with the same `number` in the same repeat region are not valid; the last one wins (parse-order overwrite, silent).

---

## State Transitions

```
Playback state for a repeat section with vol bracket:

[pre-first-ending] → first pass  → play all notes in section
[first-ending]     → first pass  → play (heard by user)
[pre-first-ending] → second pass → play (normal)
[first-ending]     → second pass → SKIP (not played, not highlighted)
[second-ending]    → second pass → play (lies outside section boundary in score; 
                                   reached by accumulated tick offset)
[post-section]     → both passes → play (with adjusted tick offset)
```

---

## Schema Evolution Summary

| Version | Change |
|---------|--------|
| v4 | `repeat_barlines` added (Feature 041) |
| v5 | `rest_events` added to Voice (Feature 043) |
| v6 | (current, Feature 046 key signatures) |
| v7 | `volta_brackets` added (Feature 047) — this feature |
