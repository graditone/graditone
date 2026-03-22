# Research: Fingering Support from MusicXML to Scores Layout

**Phase**: 0 — Outline & Research  
**Date**: 2026-03-22  
**Branch**: `001-fingering-layout`

All unknowns from the Technical Context have been resolved through direct codebase investigation. No NEEDS CLARIFICATION items remain.

---

## Decision 1: Data representation for multiple fingerings per note

**Question**: Should a note carry `Option<u8>` (single digit) or `Vec<FingeringAnnotation>` (multiple digits)?

**Decision**: `Vec<FingeringAnnotation>` where `FingeringAnnotation = { digit: u8, above: Option<bool> }`.

**Rationale**: User Story 2 and FR-005 explicitly require multiple fingerings on a single note. The Chopin Nocturne already contains notes with two `<fingering>` elements under one `<technical>` block. Using `Vec` handles both the 0-fingering case (empty vec → `skip_serializing_if = "Vec::is_empty"` so no JSON overhead) and the plural case uniformly. Using `Option<u8>` would require breaking changes when poly-fingering support is added later.

**Alternatives considered**: `Option<u8>` — rejected because it breaks User Story 2 and requires future migration. `Option<Vec<u8>>` — rejected as unnecessarily double-wrapped; `Vec` with skip_serializing is cleaner and follows the existing `beams: Vec<NoteBeamData>` pattern.

---

## Decision 2: Parser approach for `<technical>` block

**Question**: Add a `parse_technical` sub-function or inline the `<fingering>` handling directly in `parse_notations`?

**Decision**: New `parse_technical(reader, note)` sub-function, called from the `b"technical"` arm in `parse_notations`.

**Rationale**: The `parse_notations` function already delegates `<articulations>` to `parse_articulations`. Consistent pattern: each named `<notations>` child gets its own sub-function. This keeps `parse_notations` flat and makes it easy to add future `<technical>` children (e.g., `<string>`, `<fret>`, `<harmonic>`).

**Alternatives considered**: Inline handling — rejected for violating the existing parser structural convention and creating a long switch arm.

---

## Decision 3: Placement fallback logic

**Question**: When `<fingering placement="above|below">` is absent, which default to use?

**Decision**: Derive placement from staff number. Staff 1 (treble) → above; Staff 2 (bass) → below. This is encoded in `NoteData.staff` (already available at parse time).

**Rationale**: Clarification Q1 (session 2026-03-22) confirmed: honour explicit `placement` attribute first; fall back to staff-based convention. The `NoteData.staff` field (already populated) provides the staff number at conversion time. `above = Some(true)` when `placement="above"` or `staff==1`; `above = Some(false)` when `placement="below"` or `staff==2`; if `staff>2` (rare multi-staff instruments), default to `above = Some(true)`.

**Alternatives considered**: Always derive from note stem direction — rejected because stem direction is a layout concern computed later in the pipeline, while placement is an import-time editorial annotation. Leaving `above: Option<bool>` as `None` and deciding in the layout engine — rejected because it forces the layout engine to re-derive staff context that is already known at parse time.

---

## Decision 4: `FingeringGlyph` position calculation strategy

**Question**: How to compute the `(x, y)` position of each fingering numeral relative to the notehead?

**Decision**: Follow the `render_notation_dots` staccato pattern exactly, with a larger vertical offset (1.8–2.0 staff spaces above/below the notehead) to clear staccato dots and ledger lines.

**Specifics**:
- `x` = the note's x position from `note_positions` map (same as staccato dot x); centred on notehead
- `y` (above) = `notehead_y - 1.8 * units_per_space` per fingering, stacking upward for multiples
- `y` (below) = `notehead_y + 1.8 * units_per_space` per fingering, stacking downward for multiples
- For multiple fingerings on the same note, each subsequent numeral is offset by an additional `1.5 * units_per_space` in the same direction

**Rationale**: Uses existing coordinate system (positive y = down) and `units_per_space` constant. The 1.8-space base offset is larger than staccato (1.2 spaces) to avoid overlap (FR addressed in User Story 3 acceptance scenario). Stacking multiples at 1.5-space intervals keeps them legible (User Story 2).

**Alternatives considered**: Use MusicXML `default-y` hint — rejected per spec assumption; MusicXML's absolute y-coordinates are in tenths relative to the top staff line, requiring a coordinate-system conversion that is fragile and not needed for first-pass implementation. Use a fixed pixel offset — rejected as not scale-invariant; `units_per_space` is the correct dimensional scalar.

---

## Decision 5: Frontend rendering as SVG `<text>` vs. SMuFL glyph

**Question**: Should fingering digits be rendered as plain SVG `<text>` or as SMuFL music font codepoints (U+ED10–U+ED19)?

**Decision**: Plain SVG `<text>` with `font-family: Bravura, serif` and `font-size: 1.4 * units_per_space`.

**Rationale**: SMuFL codes U+ED10–U+ED19 (fingering digits 0–9) exist in Bravura but are not universally cached and would require a lookup table. The spec's Assumptions section explicitly states "plain text numerals using the same font family as other score text." Plain `<text>` is simpler, debuggable, and consistent with the spec. Bravura is already loaded in the frontend for glyphs, so using it as the fallback font produces visually consistent fingering digits at no extra cost.

**Alternatives considered**: SVG `<text>` with a separate sans-serif font — rejected because it would make fingerings visually inconsistent with other notation text. SMuFL codepoints — deferred to a future style-refinement ticket if needed.

---

## Decision 6: Test fixture selection

**Question**: Which test fixture to use for fingering integration tests?

**Decision**: Use **`backend/music/Les Fleurs Sauvages.musicxml`** as the primary integration test fixture.

**Rationale**: This file is already present in `backend/music/` (confirmed), contains `<fingering placement="below">5</fingering>` elements (confirmed via grep), and is in plain `.musicxml` format (no decompression needed for test simplicity). The Chopin Nocturne is in `scores/Chopin_NocturneOp9No2.mxl` (compressed) and is used for other existing tests — it can be used for a second "real score" test to validate against the corpus the spec cites.

**Alternatives considered**: Only the Chopin Nocturne — usable, but the `.mxl` compression adds a decompression step in the test; Les Fleurs Sauvages is simpler for first test. Synthetic XML string inline in test — good for parser unit test but doesn't exercise the full pipeline.

---

## Decision 7: No new crate / no workspace change

**Question**: Does fingering require a new Cargo crate or workspace restructure?

**Decision**: No. All changes live within the existing `musicore-backend` crate (single-package project).

**Rationale**: The layout engine is a module (`backend/src/layout/mod.rs`), not a separate crate. Adding `FingeringGlyph` to `types.rs` and a new function to `annotations.rs` are additive module-level changes. No new binary targets, no new features flags needed.

---

## Summary of Resolved Unknowns

| Unknown | Status | Resolution |
|---------|--------|------------|
| Data type for multiple fingerings | ✅ Resolved | `Vec<FingeringAnnotation>` |
| Parser sub-function pattern | ✅ Resolved | New `parse_technical()` function |
| Placement fallback logic | ✅ Resolved | Staff number (1=above, 2=below) |
| Position calculation | ✅ Resolved | Staccato pattern, 1.8× offset |
| Frontend rendering | ✅ Resolved | SVG `<text>` with Bravura font |
| Test fixture | ✅ Resolved | Les Fleurs Sauvages.musicxml |
| Crate structure | ✅ Resolved | No change, single crate |

**All NEEDS CLARIFICATION items resolved. Phase 1 design may proceed.**
