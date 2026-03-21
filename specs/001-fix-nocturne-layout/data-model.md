# Data Model: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Phase**: 1 — Design  
**Date**: 2026-03-21

This feature does not introduce new persistent data entities. It corrects the layout engine's transformation of existing parsed MusicXML data into rendered geometry. The data model documents the existing structures involved in each defect and the changes required.

---

## Entity: AccidentalGlyph (layout output element)

**What it represents**: A rendered accidental sign positioned adjacent to a note head, emitted by the layout engine and consumed by the frontend renderer.

**Current state** (buggy):
```
AccidentalGlyph {
    codepoint: char,    // U+E260 (♭), U+E261 (♮), U+E262 (♯)
                        // BUG: alter=-2 and alter=+2 both fall through to U+E261 (natural)
    x: f32,
    y: f32,
    source_note_id: NoteId,
}
```

**Required state** (fixed):
```
AccidentalGlyph {
    codepoint: char,    // U+E260 (♭), U+E261 (♮), U+E262 (♯), U+E263 (𝄪), U+E264 (𝄫)
                        // All five SMuFL accidental codepoints correctly mapped from alter ∈ {-2,-1,0,+1,+2}
    x: f32,
    y: f32,
    source_note_id: NoteId,
}
```

**Validation rules**:
- `alter = -2` → `codepoint = U+E264` (double-flat 𝄫)
- `alter = -1` → `codepoint = U+E260` (flat ♭)
- `alter = 0` → `codepoint = U+E261` (natural ♮)
- `alter = +1` → `codepoint = U+E262` (sharp ♯)
- `alter = +2` → `codepoint = U+E263` (double-sharp 𝄪)

**Files**:
- `backend/src/layout/positioner.rs` — accidental glyph emission (~line 927)
- `backend/src/layout/types.rs` — glyph type definition

---

## Entity: OttavaBracketLayout (layout output element)

**What it represents**: An 8va/8vb bracket drawn above (or below) a staff to indicate notes sound one octave higher (or lower) than written.

**Current state** (buggy — bracket starts at wrong tick):
```
OttavaBracketLayout {
    label: String,          // "8va" or "8vb"
    x_start: f32,           // BUG: currently mapped to M31 x-coordinate, should be M30
    x_end: f32,
    y: f32,
    above: bool,
    closed_right: bool,     // true when bracket end is within the same system
    staff_index: usize,
}
```

**Required state** (fixed):
```
OttavaBracketLayout {
    label: String,
    x_start: f32,           // FIXED: maps to the correct start tick (M30 first beat)
    x_end: f32,
    y: f32,
    above: bool,
    closed_right: bool,
    staff_index: usize,
}
```

**State transitions**: The bracket is generated when `octave_shift_regions` contains a region with start tick matching M30's first beat. The region is populated during extraction from MusicXML `<octave-shift>` elements.

**Files**:
- `backend/src/layout/types.rs` — `OttavaBracketLayout` struct (lines 91–104)
- `backend/src/layout/mod.rs` — bracket generation (lines 879–920)
- `backend/src/layout/extraction.rs` — `StaffData.octave_shift_regions` population
- `backend/src/domain/importers/musicxml/parser.rs` — `<octave-shift>` element parsing

---

## Entity: RestGlyph (layout output element)

**What it represents**: A rest symbol positioned on a staff at a voice-appropriate vertical location.

**Current state** (buggy — voice indexing off):
```
RestGlyph {
    codepoint: char,        // U+E4E3 (eighth rest), U+E4E5 (quarter rest), etc.
    x: f32,
    y: f32,                 // BUG: computed using 1-based voice as 0-based index → wrong Y
    voice: u8,              // 1-based (from MusicXML)
    duration_ticks: u32,
}
```

**Required state** (fixed):
```
RestGlyph {
    codepoint: char,
    x: f32,
    y: f32,                 // FIXED: computed using (voice - 1) for 0-based index
    voice: u8,
    duration_ticks: u32,
}
```

**Validation rules**:
- Voice 1 rests (stems up): centred at standard staff position (B4 for treble)
- Voice 2 rests (stems down): displaced downward by approx. 2 staff spaces

**Files**:
- `backend/src/layout/positioner.rs` — `rest_y()` function (~line 1264)

---

## Entity: SlurArc (layout output element)

**What it represents**: A Bézier curve arc connecting the first and last note of a slurred group, rendered as a filled lens/crescent shape.

**Current state** (buggy — cross-system arcs misaligned):
```
SlurArc {
    start: Point { x: f32, y: f32 },   // BUG: may use wrong system's coordinate space
    end: Point { x: f32, y: f32 },
    cp1: Point { x: f32, y: f32 },     // Bézier control point 1
    cp2: Point { x: f32, y: f32 },     // Bézier control point 2
    above: bool,
    is_cross_system: bool,             // MAY be missing or incorrectly false
    note_ids: (NoteId, NoteId),
}
```

**Required state** (fixed):
```
SlurArc {
    start: Point { x: f32, y: f32 },   // FIXED: x relative to the system containing the start note
    end: Point { x: f32, y: f32 },     // FIXED: x relative to the system containing the end note
    cp1: Point { x: f32, y: f32 },
    cp2: Point { x: f32, y: f32 },
    above: bool,
    is_cross_system: bool,             // FIXED: true when start and end are on different systems
    note_ids: (NoteId, NoteId),
}
```

**State transitions**:
- If `is_cross_system = false`: single arc rendered
- If `is_cross_system = true`: two half-arcs rendered (open right end on first system, open left end on second system)

**Files**:
- `backend/src/layout/annotations.rs` — slur arc generation (~lines 642–800)
- `backend/src/layout/types.rs` — `TieArc` type (~line 330)

---

## Entity: MeasureBoundarySpacing (layout rule — not a data type)

**What it represents**: The minimum horizontal clearance enforced between the last notation element of one measure and the first notation element of the next measure at each barline.

**Current state** (buggy — no cross-measure clearance pass):
- Collision detection only resolves same-tick, same-measure overlaps
- No pass checks the distance from last-notehead-of-measure-N to first-notehead-of-measure-N+1

**Required state** (fixed):
- After per-measure positioning, a post-processing pass walks consecutive measure pairs
- For each boundary, computes: `clearance = first_x_of_M(n+1) - last_x_of_M(n)`
- If `clearance < MIN_BARLINE_CLEARANCE` (suggested: 4px = ~0.5 staff spaces), shifts M(n+1) elements rightward

**Files**:
- `backend/src/layout/positioner.rs` — add a `enforce_measure_boundary_clearance()` function
- May require adjusting `mod.rs` where measures are positioned into systems

---

## Accidental State Machine (layout rule — within positioner.rs)

**What it represents**: The per-measure tracking of which accidentals have been applied, used to decide whether a courtesy accidental is needed.

**Current state** (buggy — state may use wrong pitch octave inside 8va regions):
- `measure_accidental_state`: `HashMap<(step, octave), alter>` — reset each measure
- `diatonic_accidental_state`: tracks courtesy accidental need across measures
- Inside 8va: display pitch is transposed −12 semitones, but the state machine may compare against the *sounding* octave instead of the *written* octave

**Required state** (fixed):
- All accidental state comparisons use **written pitch** (before 8va transposition) consistently
- Inside an 8va region, the state machine must not be confused by the sounding vs written octave distinction

**Files**:
- `backend/src/layout/positioner.rs` — accidental state tracking loop (~lines 730–920)
