# Research: Music Dynamics Score Display

**Feature**: 072-dynamics-score-display  
**Date**: 2026-04-04  
**Status**: Complete — all unknowns resolved

## Research Tasks

### 1. SMuFL Glyph Names and Codepoints for Dynamic Markings

**Question**: What SMuFL glyph names map to ppp, pp, p, mp, mf, f, ff, fff, and hairpins?  
**Why critical**: The layout engine uses Bravura glyph names (not Unicode codepoints) to look up bounding boxes from `bravura_metadata.json`. Without the correct SMuFL names the bboxes cannot be resolved, breaking proportional glyph sizing.

**Decision**: Use the following canonical SMuFL glyph names (Bravura, SMuFL standard):

| Dynamic Level | SMuFL Name | Unicode |
|--------------|------------|---------|
| ppp | `dynamicPPP` | U+E52A |
| pp | `dynamicPP` | U+E52B |
| p | `dynamicPiano` | U+E520 |
| mp | `dynamicMP` | U+E52C |
| mf | `dynamicMF` | U+E52D |
| f | `dynamicForte` | U+E522 |
| ff | `dynamicFF` | U+E52F |
| fff | `dynamicFFF` | U+E530 |
| sfz (fallback) | *(no precise glyph)* — emit italic "dyn" text (FR-010) |

- Hairpins are **not** SMuFL glyphs. They are drawn as SVG `<polyline>` or `<line>` pairs using pre-computed endpoint coordinates from the layout engine.

**Rationale**: These are the canonical names in the official Bravura glyph metadata (https://w3c.github.io/smufl/latest/tables/dynamics.html). Fonts embedding SMuFL map these names to the codepoints above. Using names (not raw codepoints) keeps the metrics lookup consistent with the rest of the codebase.

**Follow-up Action**: `bravura_metadata.json` currently has 25 entries (noteheads, accidentals, clefs, time signatures, flags). It must be extended with bounding box data for the 8 dynamic glyph names above at 1em (4 staff spaces) scale. Typical dynamic glyph bboxes from the official Bravura JSON (staff-space units):
- `dynamicPiano` (p): bBoxSW [-0.036, -0.576], bBoxNE [0.780, 0.216]
- `dynamicForte` (f): bBoxSW [-0.036, -0.576], bBoxNE [0.636, 0.216]
- `dynamicMF` (mf): bBoxSW [-0.036, -0.576], bBoxNE [1.332, 0.216]
- `dynamicPP` (pp): bBoxSW [-0.036, -0.576], bBoxNE [1.512, 0.216]
- `dynamicFF` (ff): bBoxSW [-0.036, -0.576], bBoxNE [1.248, 0.216]
- Compound forms (ppp, mp, fff) are proportionally wider. Exact values from the official Bravura 1.396 metadata JSON will be used.

---

### 2. Layout Engine Pipeline Extension Pattern

**Question**: How does the pipeline currently add per-staff below-staff elements? How should dynamics follow the same pattern?

**Decision**: Mirror the `fingering_glyphs` / `FingeringGlyph` extension pattern from Feature [fingering]:
1. Add a new `pub(crate) fn render_dynamics(staff_data, tick_range, ...) -> DynamicsResult` in a new `backend/src/layout/dynamics.rs` module.
2. Call `render_dynamics()` in `mod.rs` in the per-staff loop, immediately after `render_annotations()`.
3. Attach the result fields (`dynamic_glyphs`, `hairpin_layouts`) to the `Staff` struct alongside `fingering_glyphs`.
4. Mark both fields `#[serde(default, skip_serializing_if = "Vec::is_empty")]` for backward compatibility.

The pipeline order becomes: extraction → spacing → system-breaking → note-positioning → structural → barlines → annotations → **dynamics** → assembly.

**Rationale**: This is the established extend-not-rewrite pattern. The pipeline is already modular; `dynamics.rs` needs no cross-module dependencies beyond `types.rs`, `extraction.rs` (for `StaffData`), and `metrics.rs` (for bbox lookups). Keeps the orchestrator (`mod.rs`) thin.

---

### 3. Horizontal Positioning of Dynamic Symbols

**Question**: How are beat positions mapped to `x` coordinates for dynamics?

**Decision**: Use the same `note_positions: HashMap<u32, f32>` map (tick → x) already threaded through every other per-staff function in `mod.rs`. Look up the tick stored in `DynamicMarking.start_tick` to obtain `x`. Dynamic glyphs are left-aligned to that x position.

For ticks that fall on a barline or between notes (rare in practice): fall back to the nearest x coordinate with `tick <= marking.start_tick` using a floor-scan over the sorted map.

**Rationale**: Consistency with all other positioned elements. The note-positions map is computed once and passed by reference; no additional horizontal-spacing logic needed.

---

### 4. Vertical Positioning of Dynamic Symbols

**Question**: Where exactly below the staff does a dynamic symbol sit?

**Decision**:  
- `y = staff_vertical_offset + 4 * units_per_space + 2 * units_per_space`  
  = bottom staff line y + clearance of 2 staff spaces (= 40 logical units at default scale)  
  = `staff_vertical_offset + 6 * units_per_space`

This places the **top** of the dynamic glyph 2 staff spaces below the bottom staff line, matching the clarification in the spec (Q3 answer) and standard engraving convention (Lilypond default: 2sp).

The glyph is positioned at its **baseline** (SMuFL convention). Since SMuFL metrics measure from the baseline, the rendered y coordinate used for SVG `<text>` is `staff_vertical_offset + 6 * units_per_space`.

**Rationale**: 2 staff spaces (40 units) is a concrete, testable constant that prevents overlap with note stems and staccato dots that extend below the staff.

---

### 5. Hairpin Geometry Computation

**Question**: What are the start/end x coordinates and y coordinates for a hairpin?

**Decision**: 
- `x_start` = x from `note_positions[gradual.start_tick]` (left edge of start note)
- `x_end` = x from `note_positions[gradual.stop_tick]` (left edge of stop note) + notehead width (≈ 20 units)
- `y_center` = `staff_vertical_offset + 6 * units_per_space` (same baseline as static markings)
- `opening` = `1 * units_per_space` = 20 units (vertical spread of the open end of the wedge)
- The hairpin is two SVG lines forming a V (crescendo: point left, open right; diminuendo: open left, point right)

For cross-system hairpins:
- System 1: `x_start` → `system_end_x`, both arms converge toward or diverge from a partial end point at `x = system_end_x`
- System 2: `x = unified_left_margin` → `x_end`, continuation of the wedge direction

The layout engine emits **two separate** `HairpinLayout` entries (one per system segment) with a `continues: bool` flag that tells the renderer whether to close the wedge end or leave it open.

**Rationale**: Same split-segment pattern used by `OttavaBracketLayout` (`closed_right: bool`). Reuses the existing system-boundary detection infrastructure.

---

### 6. Score Data Input: Where Are Dynamics in the JSON Passed to `compute_layout()`?

**Question**: The layout engine receives score JSON (from `ScoreDto`). Do `dynamics` and `gradual_dynamics` arrays appear in that JSON today?

**Finding**: `ScoreDto` (in `backend/src/adapters/dtos.rs`) carries `pub dynamics: Vec<DynamicMarking>` and `pub gradual_dynamics: Vec<GradualDynamic>`, cloned from `CompiledScore`. The current `compute_layout()` function accepts a `&serde_json::Value` and reads whatever fields are present in the JSON. The dynamics arrays are already serialized into the `ScoreDto` JSON that `LayoutView.tsx` passes to `computeLayout()`. The layout engine simply needs to start reading them.

**No data model or DTO changes are required.**

---

### 7. Fallback Indicator for Unrecognised Dynamics (FR-010)

**Question**: How should the "dyn" fallback indicator be emitted by the layout engine?

**Decision**: The `DynamicsResult` struct includes a `fallback_glyphs: Vec<DynamicGlyph>` where `codepoint = ""` (empty string signals italic text mode) and the layout engine sets `label = "dyn"`. The frontend renderer checks for `codepoint.length === 0` and renders an italic SVG `<text>` element at that position instead of a font glyph lookup.

In practice, unrecognised dynamics are not parsed by the MusicXML importer (they silently disappear from `CompiledScore.dynamics`). To emit a fallback, the importer would need to preserve unrecognised dynamic strings. **This is a prerequisite**: the MusicXML importer must be updated to also forward unknown dynamic strings to the DTO as a separate `unknown_dynamics: Vec<UnknownDynamicMarking>` field (tick + staff + raw string). The layout engine reads this field to emit fallback glyphs.

**Scope decision**: FR-010 implementation is gated on a minor importer change. Document this as a dependency in tasks.md, but do not block P1/P2 (static markings + hairpins) on it. FR-010 can be implemented as the last task.

---

### 8. Scaling: Logical Units → CSS Pixels

**Question**: How does `units_per_space` (20.0 by default) and `BASE_SCALE` (0.5 CSS px per logical unit) interact for dynamic glyphs?

**Finding**: Dynamic symbols will be emitted in the `Staff.glyph_runs` array (batched with the existing Bravura font) at `font_size = 80` (SMuFL standard, same as noteheads). The SVG viewBox transform applied by `LayoutRenderer` already scales every element by `BASE_SCALE = 0.5`. No additional scaling logic is needed — dynamics glyphs automatically scale proportionally with all other notation elements (FR-011 satisfied).

For hairpin stroke width: use `stroke-width = 1.5` (same as staff line stroke width `STAFF_LINE_STROKE_WIDTH`).

---

## Decisions Summary

| Decision | Outcome |
|----------|---------|
| Glyph rendering approach | SMuFL font glyphs via Bravura (Q1 clarification) |
| Hairpin rendering | SVG `<line>` pairs from layout-engine pre-computed endpoints |
| Pipeline extension point | New `dynamics.rs` module, called after `annotations` in `mod.rs` |
| Horizontal x-position | `note_positions[start_tick]` (existing tick-to-x map) |
| Vertical y-position | `staff_bottom_y + 2 * units_per_space` (spec Q3: 2 staff spaces) |
| Cross-system hairpins | Two separate `HairpinLayout` segments with `continues` flag |
| Scaling | Automatic via existing SVG viewBox / BASE_SCALE (no extra code) |
| Fallback for sfz/fp | Italic "dyn" text glyph; requires minor importer change (gated) |
| bravura_metadata.json | Must be extended with 8 dynamic glyph bbox entries |
| DTO changes | None — dynamics arrays already present in ScoreDto JSON |
