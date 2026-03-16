# Research: Tied Notes Support

**Feature**: `051-tied-notes`  
**Date**: 2026-03-16  
**Status**: Complete — all unknowns resolved

---

## 1. MusicXML Tie Schema: `<tie>` vs `<notations><tied>`

### Decision
Parse **both** elements: `<tie>` for playback semantics and `<notations><tied>` for visual rendering.

### Rationale
MusicXML 4.0 uses two distinct mechanisms for ties:

- **`<tie type="start|stop">`** — appears directly inside `<note>`, signals playback intent: the note is the start or stop of a tie (affects duration merging).
- **`<notations><tied type="start|stop|continue"/>`** — inside the `<notations>` block, signals the visual arc to be drawn. Can also carry `placement="above|below"` and `bezier-x`, `bezier-y` override attributes.

For correct implementation, we need both: `<tie>` to identify which notes to merge for playback, and `<notations><tied>` to determine arc direction and any bezier overrides. In practice, most MusicXML files that are well-formed include both consistently.

### Alternatives Considered
- Parse only `<tie>` (playback only): Rejects visual rendering information and arc direction hints.
- Parse only `<notations><tied>` (visual only): Some MusicXML exporters omit `<notations>` for ties but always include the `<tie>` element.
- **Chosen**: Parse both; use `<tie>` as the primary playback signal; use `<notations><tied>` for visual arc placement and any optional Bézier overrides.

---

## 2. Tie Arc Bézier Geometry: Standard Notation Conventions

### Decision
Compute tie arcs as **cubic Bézier curves** with endpoints at the notehead positions and control points derived from the horizontal span and note stem direction.

### Rationale
Standard engraving practice (Gould, "Behind Bars"; Sibelius/LilyPond implementations):

- **Arc placement**: Above the noteheads when stems point down; below when stems point up. For a chord with partial ties, each tied pitch gets its own arc.
- **Arc endpoints**: Start point: right edge of the first notehead. End point: left edge of the second notehead (horizontally). Both at the vertical center of their respective noteheads.
- **Control points**: Placed at 1/3 and 2/3 of the horizontal span. The vertical offset of control points = `arc_height`, where:
  - `arc_height` = clamp(span × 0.15, min_height=4px, max_height=30px) in staff-space units
  - Control points are offset in the arc direction (above or below) by `arc_height`
- **Barline-crossing ties** (same system): Arc runs from first notehead to the second notehead across the barline — no visual break. Both noteheads are positioned by the layout engine with absolute x-coordinates on the same system row.
- **System-break ties** (cross-system line): Emit **two arcs**: a "start arc" that exits the right edge of the first system, and a "continuation arc" that enters from the left edge of the second system. For MVP (Phase 1), system-break ties are deferred — emit a single truncated arc for the start portion only.

### Alternatives Considered
- Quadratic Bézier: Simpler but cannot independently control both halves of the arc curve — engravers universally use cubic.
- Fixed arc height: Works for uniform spans but looks poor on long ties (cross-measure).
- **Chosen**: Cubic Bézier with span-proportional height, clamped to min/max.

---

## 3. Playback: Tie Duration Merging Strategy

### Decision
Resolve tie chains in a **pre-processing step** in `PlaybackScheduler` (or a dedicated `TieResolver` utility) before notes are scheduled for playback. The resolver walks notes sorted by `start_tick` and merges `duration_ticks` for each tie chain into the first note's combined duration, discarding the continuation note events.

### Rationale
The WASM layout engine produces `Note` objects with individual `duration_ticks` (as written on the page). The playback scheduler must not re-attack a tied continuation note. A dedicated resolver keeps the score model clean (both notes remain for rendering) while producing a flattened list of independent playback events.

The resolver algorithm:
1. Sort all notes on the staff by `start_tick`.
2. For each note with `is_tie_start = true`: follow the `tie_id` chain, sum `duration_ticks`, mark continuation notes as `is_tie_continuation = true`.
3. Schedule only notes where `is_tie_continuation = false`, using the accumulated duration for the start note.

### Alternatives Considered
- Merge in Rust domain (NoteData combining during import): Would lose per-note tick data needed for layout and practice mode display.
- Merge in layout engine: Layout needs all individual noteheads positioned; merging there would lose the continuation noteheads.
- **Chosen**: Frontend pre-processing in `TieResolver.ts`, keeping score model intact.

---

## 4. Practice Mode: Handling Tied Continuation Notes

### Decision
Before building the practice note sequence, filter out **tied continuation notes** — notes where `is_tie_continuation = true`. The practice engine then only advances to notes that require a new physical key press.

### Rationale
A tied note continuation is not a new attack; requiring the user to press the key again for it would be musically wrong and frustrating. The practice note extraction function (`extractPracticeNotesFromScore` or equivalent in `scorePlayerContext.ts`) already iterates notes by tick — adding a filter for `is_tie_continuation` before building the sequence is a minimal, safe change.

### Alternatives Considered
- Mark continuation notes with duration 0 for practice: Confusing semantics.
- Combine tied notes into a single `Note` in the domain model: Would break notation rendering (both noteheads must appear visually).
- **Chosen**: Keep both notes in the domain model; filter continuation notes at practice sequence extraction time.

---

## 5. Existing Codebase Gap Analysis

### Fully missing (to be created)
| Layer | Gap |
|-------|-----|
| `NoteData` (importer intermediate) | `tie_type: Option<TieType>` — captures `start`/`stop`/`continue` from `<tie>` element |
| `Note` (domain) | `tie_id: Option<TieId>` (start note ID to link chain) + `is_tie_continuation: bool` |
| `MusicXMLParser::parse_note()` | Handle `b"tie"` element with `type` attribute |
| `MusicXMLParser::parse_notations()` | Handle `b"tied"` element with `type` + `placement` attributes |
| `MusicXMLConverter` | Post-pass to resolve tie chains after all notes are imported |
| `Layout types` | `TieArc { start: Point, end: Point, cp1: Point, cp2: Point, note_id_start: NoteId, note_id_end: NoteId }` |
| `Layout engine` | Arc geometry calculation function |
| `Staff` layout output | `pub tie_arcs: Vec<TieArc>` field |
| `NotationRenderer.tsx` | `<path>` elements for each `tieArc` |
| `TieResolver.ts` | New frontend utility: merge durations for playback |
| `PlaybackScheduler.ts` | Call `TieResolver` before scheduling |
| `scorePlayerContext.ts` | Filter `is_tie_continuation` notes from practice sequence |

### Partially present (to be extended)
| Component | Status |
|-----------|--------|
| `MusicXMLParser::parse_notations()` | Exists (parses articulations/staccato); add tie elements |
| `Staff` (layout types) | Exists with `notation_dots`, `bar_lines`, etc.; add `tie_arcs` |
| `NotationRenderer` SVG loop | Exists with `<line>`, `<text>` rendering; add `<path>` loop |

### Auto-propagated (no manual work needed)
| Component | Reason |
|-----------|--------|
| WASM bindings | `wasm-bindgen` + serde auto-serialize `TieArc` and updated `Note` to JS |
| TypeScript `Score` types | Consumed from WASM JSON output; adding fields to Rust structs makes them available in TS |

---

## 6. Test Fixtures Availability

### Decision
Use `Chopin_NocturneOp9No2.mxl` as the primary end-to-end test fixture (heaviest use of ties). Use `Beethoven_FurElise.mxl` as a secondary fixture (ties crossing barlines). Both are already in `scores/` and have been confirmed to contain MusicXML `<tie>` elements.

### Additional fixture needed
A small synthetic MusicXML fixture should be created specifically for unit/integration tests:
- `tests/fixtures/musicxml/tied_notes_basic.musicxml` — 4 measures, treble clef, 3 tie cases: (a) two notes same measure, (b) cross-barline, (c) tie chain of 3 notes.
- `tests/fixtures/musicxml/tied_notes_chord.musicxml` — chord with partial ties (only some pitches tied).

These synthetic fixtures enable deterministic assertions (exact pixel positions) without depending on full-score layout complexity.

---

## Summary: All Unknowns Resolved

| Unknown | Resolution |
|---------|-----------|
| `<tie>` vs `<notations><tied>` schema | Parse both; `<tie>` = playback, `<notations><tied>` = visual |
| Bézier arc geometry | Cubic Bézier, span-proportional height, stem-direction placement |
| System-break ties | Deferred for MVP; single truncated arc at system end |
| Playback merging strategy | Frontend `TieResolver` pre-processing before scheduling |
| Practice mode handling | Filter `is_tie_continuation` notes at extraction time |
| Existing infrastructure to reuse | `NotationDot` (layout pattern), `parse_notations()` (parser extension point), `PlaybackScheduler.scheduleNotes()` (pre-processing hook) |
