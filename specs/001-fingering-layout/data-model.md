# Data Model: Fingering Support from MusicXML to Scores Layout

**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-22  
**Branch**: `001-fingering-layout`

---

## Entities

### FingeringAnnotation (Import / Domain Layer)

Represents a single fingering numeral attached to a note as read from the MusicXML source.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `digit` | `u8` | Finger number (1–5 for standard piano; other values passed through as-is) | Must be parseable from `<fingering>` text content; discard if non-numeric (FR-008) |
| `above` | `bool` | Placement direction: `true` = above notehead, `false` = below | Derived from MusicXML `placement` attribute if present; fallback = staff number (staff 1 → true, staff ≥ 2 → false) |

**Origin**: MusicXML `<notations><technical><fingering placement?>digit</fingering></technical></notations>`  
**Cardinality**: A note carries zero or more `FingeringAnnotation` values (zero = no fingering, plural = multiple fingerings on same note)  
**Serialization**: JSON array field `"fingering"` on `Note`; omitted when empty (`skip_serializing_if = "Vec::is_empty"`)

---

### Note (Domain Entity — extended)

Existing entity. New field added:

| New Field | Type | Serde | Description |
|-----------|------|-------|-------------|
| `fingering` | `Vec<FingeringAnnotation>` | `#[serde(default, skip_serializing_if = "Vec::is_empty")]` | Zero or more fingering annotations; empty = no fingering |

**No other `Note` fields change. All existing serialization behaviour is preserved.**

---

### NoteData (Import Intermediate — extended)

Existing struct in `musicxml/types.rs`. New field added:

| New Field | Type | Description |
|-----------|------|-------------|
| `fingering` | `Vec<FingeringAnnotation>` | Collected from `<technical><fingering>` elements during parse |

---

### NoteEvent (Layout Internal — extended)

Existing struct in `layout/extraction.rs`. New field added:

| New Field | Type | Description |
|-----------|------|-------------|
| `fingering` | `Vec<FingeringAnnotation>` | Passed through from JSON `Note.fingering` |

---

### FingeringGlyph (Layout Output)

New struct added to `layout/types.rs`. Represents a positioned fingering numeral in the rendered output.

| Field | Type | Serde | Description |
|-------|------|-------|-------------|
| `x` | `f32` | `round_f32` | Horizontal centre of the numeral; same as the associated notehead x |
| `y` | `f32` | `round_f32` | Vertical position of the numeral baseline; always outside the staff lines |
| `digit` | `u8` | default | Finger number to display (1–5) |
| `above` | `bool` | default | `true` = numeral above notehead; `false` = numeral below notehead |

**Collection**: Added as `fingering_glyphs: Vec<FingeringGlyph>` on `Staff` with `#[serde(default, skip_serializing_if = "Vec::is_empty")]`.

---

## Entity Relationships

```
MusicXML <fingering>
    │
    ▼ parse_technical() → FingeringAnnotation { digit, above }
    │
NoteData.fingering: Vec<FingeringAnnotation>    [import layer]
    │
    ▼ convert_note() → with_fingering()
    │
Note.fingering: Vec<FingeringAnnotation>         [domain layer, JSON serialized]
    │
    ▼ JSON boundary (ScoreDto → layout/extraction.rs)
    │
NoteEvent.fingering: Vec<FingeringAnnotation>    [layout internal]
    │
    ▼ render_fingering_glyphs()
    │
FingeringGlyph { x, y, digit, above }           [layout output]
    │
Staff.fingering_glyphs: Vec<FingeringGlyph>      [GlobalLayout JSON]
    │
    ▼ LayoutRenderer.tsx
    │
SVG <text> element                               [rendered display]
```

---

## State Transitions

Fingering is a read-only annotation — no state transitions. It flows linearly from parse to render with no mutation after the import step.

---

## Validation Rules

| Rule | Layer | Source |
|------|-------|--------|
| Non-numeric `<fingering>` text content → discard silently, no crash | Parser | FR-008 |
| Empty `<fingering>` text content → discard silently | Parser | FR-008 |
| `digit` value is stored as-is; values outside 1–5 are not filtered | Assumption | Spec Assumptions section |
| If no `placement` attribute and staff is unknown → default to `above = true` | Parser | Research Decision 3 |
| `Vec::is_empty()` → field omitted from JSON; existing layout output unchanged | Serialization | FR-007 |

---

## Positioning Rules (Layout Engine)

These are computed in `render_fingering_glyphs()` and produce the `(x, y)` for each `FingeringGlyph`:

| Variable | Formula |
|----------|---------|
| `glyph_x` | `note_positions[start_tick]` (same as notehead x) |
| `base_offset` | `1.8 * units_per_space` |
| `stack_offset` | `1.5 * units_per_space` (per additional fingering on same note) |
| `glyph_y` (above, first)  | `notehead_y - base_offset` |
| `glyph_y` (above, nth)    | `notehead_y - base_offset - (n-1) * stack_offset` |
| `glyph_y` (below, first)  | `notehead_y + base_offset` |
| `glyph_y` (below, nth)    | `notehead_y + base_offset + (n-1) * stack_offset` |
