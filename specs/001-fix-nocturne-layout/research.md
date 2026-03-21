# Research: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Phase**: 0 — Research  
**Date**: 2026-03-21  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Defect 1: M29 — Double-Flat Rendered as Natural

### Root Cause

- **Decision**: The bug is a missing match arm in `backend/src/layout/positioner.rs` at approximately line 927.
- **Rationale**: The accidental-to-glyph mapping is an exhaustive match on `alter` values (−2, −1, 0, +1, +2), but only cases +1 (sharp) and −1 (flat) are handled explicitly. Case −2 (double-flat) falls through to the wildcard arm `_ => ('\u{E261}', "accidentalNatural")`, emitting the wrong glyph.
- **Data flow**: MusicXML `<alter>-2</alter>` is parsed correctly into `PitchData.alter = -2`, forwarded to `NoteEvent.spelling = ('N', -2)`, but collapsed at render time.
- **Alternatives considered**: Fixing in the frontend `NotationRenderer.tsx` was considered but rejected — Principle VI mandates that glyph selection (a layout decision) be owned by the Rust engine. The frontend receives a codepoint from the layout data; it should not re-derive the glyph.

**SMuFL codepoints needed**:
- U+E264 `accidentalDoubleFlat` (𝄫) — for `alter = -2`
- U+E263 `accidentalDoubleSharp` (𝄪) — for `alter = +2` (symmetric fix, same match arm gap)

**Fix location**: `backend/src/layout/positioner.rs` — the `match accidental_type` block. Add arms for `-2` and `+2`; remove wildcard natural fallback; add explicit `0` arm for natural.

---

## Defect 2: M30 — Missing 8va Bracket

### Root Cause

- **Decision**: The ottava bracket infrastructure exists (`OttavaBracketLayout` in `types.rs:91–104`, generation in `mod.rs:879–920`, rendering in `LayoutRenderer.tsx:640–680`), but it is not triggering for M30. The most probable cause is one of:
  - (a) The octave-shift MusicXML element in M30 is parsed but not correctly forwarded into `octave_shift_regions` in `StaffData`; or
  - (b) The bracket generation function has an off-by-one on measure indexing and skips M30; or
  - (c) The bracket generation only emits for regions whose `display_shift` equals −12 (8va above) but the value stored is different.
- **Rationale**: Previous work (PR-050 T115) implemented 8va for M31–M36. The user's report says the bracket is *missing* at M30, which suggests the region starts at M31 internally while the source MusicXML marks the start at M30.
- **Alternatives considered**: Patching the frontend rendering to force-start the dashed line one measure earlier was rejected (Principle VI). The correct fix is to trace the octave-shift region start tick from MusicXML through the extraction pipeline (`parser.rs` → `converter.rs` → `extraction.rs`) and confirm the start tick maps to M30, not M31.

**Fix location**: `backend/src/domain/importers/musicxml/parser.rs` (verify start-of-shift element is at M30 tick) and/or `backend/src/layout/extraction.rs` (verify `octave_shift_regions` start tick accuracy).

---

## Defect 3: M34–M36 — Missing Courtesy Accidentals

### Root Cause

- **Decision**: The accidental state machine in `backend/src/layout/positioner.rs` (lines ~730–920) resets `measure_accidental_state` at the start of each measure. The bug is likely that after an 8va passage (M31–M36), the display pitch transposition alters which octave the accidental state applies to, causing the state machine to not emit courtesy accidentals for notes in M34–M36.
- **Rationale**: The 8va region transposes display pitch down one octave. If the accidental state machine tracks pitch by written pitch (before transposition) but compares against sounding pitch when deciding whether a courtesy accidental is needed, the comparison fails and no glyph is emitted.
- **Alternatives considered**: Skipping the state machine and always rendering accidentals encoded with `has_explicit_accidental = true` was considered. This is simpler but would emit accidentals where the source omits them. The correct fix is to ensure the state machine operates on written pitch consistently throughout the 8va region.

**Fix location**: `backend/src/layout/positioner.rs` — the measure-level accidental tracking loop, specificaly where `diatonic_accidental_state` is compared against current note spelling inside an ottava region.

---

## Defect 4: M34–M36 — Rests Not Centred

### Root Cause

- **Decision**: The rest vertical positioning in `backend/src/layout/positioner.rs` (lines ~1264–1350) uses a voice index to compute a Y offset for multi-voice measures. MusicXML uses 1-based voice numbers; if the code indexes with 0-based voice numbers, voice 1 is treated as voice 0, causing the rest to be offset by one position.
- **Rationale**: This is consistent with the symptom: M34–M36 are multi-voice measures (treble staff RH has two independent voices during the 8va passage). A voice-index-off-by-one would produce a rest shifted one staff position (approximately 5 pixels per staff space) from its expected centre.
- **Alternatives considered**: None — voice indexing correction is the minimal targeted fix. Changing the WASM output Y to a hardcoded value was rejected as fragile.

**Fix location**: `backend/src/layout/positioner.rs` — the `rest_y()` function or its caller; verify voice indexing is consistently 0-based internally.

---

## Defect 5: M37 — Slur Mispositioned

### Root Cause

- **Decision**: The slur arc geometry in `backend/src/layout/annotations.rs` (lines ~642–800) computes arc height as `arc_height = (3.5 * sqrt(span_x)).clamp(12.0, 50.0)`. If M37's slur spans a system break, the arc is drawn as if the notes share the same system, producing misaligned start/end bezier control points.
- **Rationale**: Cross-system slurs require the arc to be split: the start side is drawn on the first system (open right end) and the continuation is drawn on the next system (open left end). If the slur falls entirely within one system but the M37 measure is at or near a system boundary, the x-coordinates used for start/end may pick up the wrong system's coordinate space.
- **Alternatives considered**: Adjusting the arc height clamp was rejected — the issue is endpoint coordinate space, not arc height. The fix is to correctly identify whether the slur is cross-system and, if so, use system-relative x-coordinates and draw two half-arcs.

**Fix location**: `backend/src/layout/annotations.rs` — the slur rendering function; add system-break detection and split-arc logic for cross-system slurs.

---

## Defect 6: M32–M34 — Overlapping Notation at Measure Boundaries

### Root Cause

- **Decision**: The overlap/collision detection in `backend/src/layout/positioner.rs` (lines ~949–1000) only resolves collisions between elements at the same tick within a single measure. It does not account for the final notes/accidentals of one measure overlapping horizontally with the barline or first notes/accidentals of the next measure.
- **Rationale**: In dense passages like M32–M34 of the Nocturne (12/8 time with many eighth-note triplet runs), the horizontal space available is tight. Without cross-measure boundary spacing enforcement, the last notehead of M32 can overlap the barline or the first notehead of M33.
- **Alternatives considered**: Increasing global horizontal note spacing was considered but rejected — it would reflow the entire score and potentially introduce regressions in other measures. The targeted fix is to add a post-processing pass that enforces a minimum clearance between the last element of each measure and the first element of the next measure at barline boundaries.

**Fix location**: `backend/src/layout/positioner.rs` (or `mod.rs`) — add a cross-measure boundary clearance pass after per-measure element positioning.

---

## Technology Decisions

### Accidental Codepoints

- **Decision**: Use SMuFL standard Unicode codepoints U+E264 (double-flat) and U+E263 (double-sharp).
- **Rationale**: The project already uses SMuFL codepoints for all other accidentals (U+E260 flat, U+E261 natural, U+E262 sharp). Consistency is critical for glyph font rendering.
- **Alternatives considered**: Custom SVG paths for double-accidentals. Rejected — the font system already supports them; no SVG path needed.

### WASM–TypeScript Accidental Contract

- **Decision**: The layout engine emits a `codepoint: char` field in each accidental glyph element. The frontend renders the codepoint directly as a Unicode character using the SMuFL notation font. No TypeScript-side glyph lookup table is needed.
- **Rationale**: Keeping codepoint selection in Rust (Principle VI) means the TypeScript side does not need to know about accidental types at all. The frontend just renders whatever codepoint the engine emits.
- **Alternatives considered**: Passing an `accidental_type: AccidentalKind` enum (sharp/flat/natural/doubleSharp/doubleFlat) to the frontend and mapping to codepoints in TypeScript. Rejected — this would move layout logic (glyph selection) into the frontend, violating Principle VI.

### Test Strategy

- **Decision**: All 6 defects get backend Rust regression tests in `backend/tests/nocturne_m29_m37_test.rs`. High-severity defects (M29 accidental, M30 8va bracket) additionally get Playwright E2E tests in `frontend/e2e/nocturne-m29-m37-layout.spec.ts`.
- **Rationale**: Rust tests are fast, exact, and test the layout engine in isolation. E2E tests provide visual confidence that the frontend renders the layout data correctly. The existing `m21-flat-check.spec.ts` establishes the pattern.
- **Alternatives considered**: Unit tests only (no E2E). Rejected for M29 and M30 — these are the most visible defects and warrant E2E coverage given the existing E2E infrastructure.

---

## No Remaining NEEDS CLARIFICATION Items

All six defects have identified files, line ranges, and fix strategies. Implementation may proceed to Phase 1.
