# Data Model: Tied Notes Support

**Feature**: `051-tied-notes`  
**Date**: 2026-03-16

---

## Domain Entities

### 1. `TieType` (new enum — Rust)

Represents the role of a `<tie>` element found on a note in MusicXML.

```rust
/// The role this note plays in a tie relationship.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TieType {
    /// This note is the start of a tie — sustain begins here.
    Start,
    /// This note is a continuation within a tie chain (stop + re-start).
    Continue,
    /// This note is the end of a tie — sustain ends here, no re-attack.
    Stop,
}
```

**Location**: `backend/src/domain/events/note.rs`

---

### 2. `Note` — updated (Rust domain struct)

Two new fields added to the existing `Note` struct:

```rust
pub struct Note {
    pub id: NoteId,
    pub start_tick: Tick,
    pub duration_ticks: u32,
    pub pitch: Pitch,
    pub spelling: Option<NoteSpelling>,
    pub beams: Vec<NoteBeamData>,
    pub staccato: bool,
    pub dot_count: u8,

    // NEW: Tie support
    /// If this note starts or continues a tie, the ID of the NEXT tied note.
    /// None if this note is not the start of a tie chain or is the last in a chain.
    pub tie_next: Option<NoteId>,
    /// True if this note is a continuation note (its duration should NOT trigger a new attack during playback).
    pub is_tie_continuation: bool,
}
```

**Validation rules**:
- `tie_next` MUST reference a `Note` of the same pitch (step + octave + alter) in the same voice/staff.
- The referenced note MUST have `start_tick` = `self.start_tick` + `self.duration_ticks` (immediately follows this note with no gap and no overlap).
- `is_tie_continuation = true` implies `tie_next` of some predecessor note points at `self.id`.

**Location**: `backend/src/domain/events/note.rs`

---

### 3. `NoteData` — updated (MusicXML importer intermediate)

Intermediate struct used during MusicXML parsing, before domain conversion.

```rust
pub struct NoteData {
    pub pitch: Option<PitchData>,
    pub duration: i32,
    pub voice: usize,
    pub staff: usize,
    pub note_type: Option<String>,
    pub is_chord: bool,
    pub beams: Vec<BeamData>,
    pub staccato: bool,
    pub dot_count: u8,

    // NEW: Tie support
    /// Tie directive from the <tie> element — drives playback duration merging.
    pub tie_type: Option<TieType>,
    /// Arc placement hint from <notations><tied placement="above|below"> — drives layout.
    pub tie_placement: Option<TiePlacement>,
}
```

**Location**: `backend/src/domain/importers/musicxml/types.rs`

---

### 4. `TiePlacement` (new enum — Rust)

```rust
/// Visual arc placement for a tie, sourced from <notations><tied placement="..."/>.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TiePlacement {
    Above,
    Below,
}
```

When not specified in the MusicXML, placement is inferred from stem direction:
- Stem down (note on or above middle line) → arc placed **above** noteheads.
- Stem up (note below middle line) → arc placed **below** noteheads.

**Location**: `backend/src/domain/importers/musicxml/types.rs`

---

### 5. `TieArc` (new struct — Rust layout type)

Represents the geometry of a single rendered tie arc. Emitted by the layout engine and consumed by the frontend renderer.

```rust
/// Bézier geometry for a single tie arc between two noteheads.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TieArc {
    /// Starting point — right edge of the first notehead.
    pub start: Point,
    /// Ending point — left edge of the second notehead.
    pub end: Point,
    /// First Bézier control point (at ~1/3 span, offset by arc_height in arc direction).
    pub cp1: Point,
    /// Second Bézier control point (at ~2/3 span, offset by arc_height in arc direction).
    pub cp2: Point,
    /// Whether the arc curves above (true) or below (false) the noteheads.
    pub above: bool,
    /// ID of the note at the start of this arc.
    pub note_id_start: NoteId,
    /// ID of the note at the end of this arc.
    pub note_id_end: NoteId,
}
```

**Location**: `backend/src/layout/types.rs`

**Geometry calculation** (in layout engine):
```
arc_height = clamp(|end.x - start.x| * 0.15, 4.0, 30.0)  // in staff-space units
direction  = if above { -1.0 } else { 1.0 }
span_x     = end.x - start.x

cp1 = Point { x: start.x + span_x * 0.33, y: start.y + direction * arc_height }
cp2 = Point { x: start.x + span_x * 0.67, y: end.y   + direction * arc_height }
```

---

### 6. `Staff` — updated (layout output)

The existing `Staff` layout struct gains a new `tie_arcs` field:

```rust
pub struct Staff {
    pub staff_lines: [StaffLine; 5],
    pub glyph_runs: Vec<GlyphRun>,
    pub structural_glyphs: Vec<Glyph>,
    pub bar_lines: Vec<BarLine>,
    pub ledger_lines: Vec<LedgerLine>,
    pub notation_dots: Vec<NotationDot>,

    // NEW
    pub tie_arcs: Vec<TieArc>,
}
```

**Location**: `backend/src/layout/types.rs`

---

## Entity Relationships

```
Score
 └─ Instrument
     └─ Staff (layout output)
         ├─ [notes/noteheads positioned as Glyph items]
         └─ tie_arcs: Vec<TieArc>   ← one TieArc per adjacent pair in a tie chain

Note (domain)
 ├─ tie_next: Option<NoteId>        ← forward link to next note in chain
 └─ is_tie_continuation: bool       ← true if this note continues a previous tie

TieArc (layout output)
 ├─ note_id_start                   ← refers to Note where arc begins
 └─ note_id_end                     ← refers to Note where arc ends
```

A tie chain of N notes generates N−1 `TieArc` entries. A chord with some pitches tied generates one `TieArc` per tied pitch pair.

---

## State Transitions

```
parse_note() finds <tie type="start">
    → NoteData.tie_type = TieType::Start

parse_notations() finds <tied type="start" placement="above">
    → NoteData.tie_placement = TiePlacement::Above

MusicXMLConverter resolves chain:
    NoteA (start) + NoteB (stop) of same pitch, adjacent ticks
    → NoteA.tie_next = NoteB.id
    → NoteB.is_tie_continuation = true

Layout engine computes TieArc:
    NoteA.notehead position (right edge) → TieArc.start
    NoteB.notehead position (left edge)  → TieArc.end
    Stem direction → TieArc.above
    Bézier formula → TieArc.cp1, cp2

Frontend renderer:
    for arc in staff.tie_arcs:
        <path d="M start.x,start.y C cp1.x,cp1.y cp2.x,cp2.y end.x,end.y"
              fill="none" stroke="currentColor" />

Playback TieResolver:
    notes with is_tie_continuation = true → excluded from schedule
    note_id_start accumulated duration = sum of all notes in chain

Practice extraction:
    notes with is_tie_continuation = true → excluded from practice sequence
```

---

## Validation Rules Summary

| Rule | Description |
|------|-------------|
| Same pitch | Tied notes MUST share the same pitch (step, octave, alter) |
| Sequential ticks | TieB.start_tick MUST equal TieA.start_tick + TieA.duration_ticks |
| Same voice and staff | Tied notes MUST be in the same voice and staff |
| No cross-instrument tie | Ties do not cross instrument boundaries |
| Tie vs slur | Only `<tie>` elements create tie relationships; `<slur>` elements are ignored in this feature |
| Corrupt data | If validation fails (different pitch, non-adjacent), log a warning and skip the tie — render both notes normally |
