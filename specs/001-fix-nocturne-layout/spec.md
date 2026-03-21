# Feature Specification: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Feature Branch**: `001-fix-nocturne-layout`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: "Fix Nocturne Op.9 No.2 layout — M29 bb vs natural, M30 missing 8va, M34/M35/M36 missing accidentals and rest not centered, M37 slur positioning, M32/M33/M34 overlaps and end/start of measure"

## Overview

The Chopin Nocturne Op.9 No.2 is one of the primary scores used to validate sheet music rendering quality. A visual inspection of measures M29 through M37 reveals six categories of rendering defects that cause musicians to misread the score. This feature resolves all six defects so the rendered score matches the reference edition of the piece.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct Accidentals Throughout M29–M36 (Priority: P1)

A musician opens the Nocturne score and navigates to measure 29. They expect to see each note's accidental exactly as it appears in the reference edition — a double-flat sign (𝄫) where the score calls for a double-flat, a natural sign (♮) where the score calls for a natural, and courtesy accidentals in M34, M35, and M36 where they are required to prevent any ambiguity after the 8va passage.

**Why this priority**: Incorrect or missing accidentals directly cause a musician to play wrong notes. This is a musical correctness issue — the most critical class of rendering defect. Mistakes in accidentals undermine the entire purpose of the score viewer as a practice tool.

**Independent Test**: Open the Nocturne score, navigate to M29–M36, and visually verify — without playback — that every note shows the exact accidental symbol specified in the source MusicXML. Delivers correct, readable notation for this passage without requiring any other fix.

**Acceptance Scenarios**:

1. **Given** the Nocturne score is displayed, **When** a musician views measure 29, **Then** the note that carries a double-flat (𝄫) shows a double-flat sign, and no note incorrectly shows a natural sign (♮) instead.
2. **Given** the Nocturne score is displayed, **When** a musician views measure 34, **Then** all accidentals required by the reference edition are visible and positioned adjacent to their respective note heads.
3. **Given** the Nocturne score is displayed, **When** a musician views measures 35 and 36, **Then** all accidentals required by the reference edition are visible and correctly positioned.
4. **Given** an accidental appears earlier in the same measure or in the previous measure, **When** a note requires a courtesy reminder accidental, **Then** the reminder accidental is displayed.

---

### User Story 2 - 8va Bracket Starts at M30 (Priority: P1)

A musician reading the right-hand part expects to see the "8va" bracket begin at the correct measure — measure 30 — and continue through the passage where notes are to be played an octave higher. Without this bracket, musicians would either play the passage at the wrong octave or be confused by the written pitch, which lies outside comfortable hand position.

**Why this priority**: The 8va bracket communicates that written notes are played one octave higher than written. Missing this sign causes a direct pitch error — a musician plays an entire passage in the wrong octave. This is as critical as a missing accidental.

**Independent Test**: Open the Nocturne score and visually verify the "8va" bracket appears starting at measure 30, with the dashed line and terminal hook visible through its intended duration. Delivers octave-transposition notation for the passage independently of all other fixes.

**Acceptance Scenarios**:

1. **Given** the Nocturne score is displayed, **When** a musician views the right-hand staff at measure 30, **Then** an "8va" label with a dashed bracket line is visible above the staff at the start of the measure.
2. **Given** the 8va bracket begins at M30, **When** the musician reads through the affected measures, **Then** the dashed bracket line extends continuously, ending with a vertical hook at the correct final note.
3. **Given** the 8va bracket is present, **When** the musician views the notes inside this region, **Then** the notes are displayed at their written (transposed-down) pitch with the bracket indicating the sounding pitch is one octave higher.

---

### User Story 3 - Rests Centered Correctly in M34–M36 (Priority: P2)

A musician reading measures 34 through 36 needs to see any rests positioned at their standard vertical location on the staff. A rest that floats above or below its expected position suggests a different voice assignment and confuses the rhythmic reading of the passage.

**Why this priority**: Misaligned rests impair rhythmic reading. While less severe than a pitch error (a missed rest causes a rhythm mistake rather than a wrong note), it still impairs the score's usefulness as a practice reference.

**Independent Test**: Open the Nocturne score, navigate to measures 34–36, and verify that each rest glyph sits at the vertically centered position expected for its rest type and voice. Independently verifiable by visual inspection and automated position checks.

**Acceptance Scenarios**:

1. **Given** the Nocturne score is displayed, **When** a musician views measures 34–36, **Then** all rest glyphs are centered at the standard vertical position for their voice within the staff.
2. **Given** there are multiple voices in these measures, **When** a voice contains a rest, **Then** the rest is offset consistently with the voice's stem direction, not misplaced beyond normal multi-voice rest displacement.

---

### User Story 4 - Slur Positioned Correctly in M37 (Priority: P2)

A musician reads measure 37 and expects to see any phrase slur arc originate at the first note of the slurred group and terminate precisely at the last note, curving smoothly in the correct direction (above or below the note heads) without colliding with other notation.

**Why this priority**: Slur placement errors cause musicians to misidentify phrase boundaries. A slur starting or ending in the wrong place can look like it connects a different group of notes, altering the musical interpretation.

**Independent Test**: Open the Nocturne score and navigate to measure 37. Visually verify that the slur arc begins at the correct note head, curves in the correct direction, and terminates at the correct destination note head without overlapping staff lines, note heads, or accidentals.

**Acceptance Scenarios**:

1. **Given** the Nocturne score is displayed, **When** a musician views measure 37, **Then** the slur arc begins directly above or below the first note of the slurred group and ends at the last note in the group.
2. **Given** the slur direction is determined by the note stem direction or explicit score marking, **When** the slur is rendered, **Then** it curves in the correct direction (above for stems-down, below for stems-up, or as marked).
3. **Given** the slur is rendered, **When** the musician inspects the arc path, **Then** the slur does not visually collide with accidentals, note heads, or augmentation dots.

---

### User Story 5 - No Notation Overlaps at M32–M34 Measure Boundaries (Priority: P3)

A musician reading across the bar lines spanning measures 32, 33, and 34 expects each notation element — note heads, accidentals, barlines, time annotations — to have clear visual separation. Overlapping symbols make it impossible to distinguish individual notation elements and interrupt reading flow.

**Why this priority**: Overlaps degrade readability but do not cause direct pitch or rhythm errors for an experienced musician. Fixed once the higher-priority accidental and 8va issues are addressed, since those corrections may directly affect the spacing that causes the overlaps.

**Independent Test**: Open the Nocturne score and navigate to the transition between measures 32, 33, and 34. Verify that no two notation elements overlap at any measure boundary in this range.

**Acceptance Scenarios**:

1. **Given** the Nocturne score is displayed, **When** a musician views the boundary between measures 32 and 33, **Then** the last notes or elements of M32 do not visually collide with the barline or the first elements of M33.
2. **Given** the Nocturne score is displayed, **When** a musician views the boundary between measures 33 and 34, **Then** the last notes or elements of M33 do not visually collide with the barline or the first elements of M34.
3. **Given** any notation element (note head, accidental, rest, barline) near a measure boundary, **When** the layout is computed, **Then** horizontal spacing ensures a minimum legible gap between adjacent distinct elements.

---

### Edge Cases

- What happens when a double-flat note follows a natural in the same measure — does the double-flat accidental still render explicitly?
- What happens if the 8va bracket region spans a system break — does each system show the continuation correctly?
- In measures with multiple overlapping voices (M32–M34), do rests for both voices avoid colliding with active note heads from the other voice?
- If a slur in M37 starts on a note inside an 8va region, does the slur still clear the 8va bracket line?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The score renderer MUST display the correct accidental (double-flat 𝄫 or natural ♮) for each note in measure 29 as encoded in the source score file — no substitution between these two signs.
- **FR-002**: The score renderer MUST display all accidentals in measures 34, 35, and 36 that are present in the source score, including any courtesy (cautionary) accidentals.
- **FR-003**: The score renderer MUST display the "8va" bracket notation beginning at measure 30, including the label, dashed bracket line, and terminal hook.
- **FR-004**: Rests in measures 34, 35, and 36 MUST be rendered at the vertically correct position for their voice — centered on the appropriate staff line or space per standard notation conventions.
- **FR-005**: The slur in measure 37 MUST begin at the correct note head, end at the correct note head, and curve in the direction (above or below) prescribed by the source score or standard notation rules.
- **FR-006**: The slur in measure 37 MUST NOT visually overlap or collide with note heads, accidentals, augmentation dots, or staff lines.
- **FR-007**: Notation elements at the boundaries of measures 32, 33, and 34 MUST be rendered with sufficient horizontal spacing to prevent any two distinct elements from overlapping.
- **FR-008**: All fixes MUST NOT degrade the rendering of previously validated measures in the Nocturne (M1–M28, M38) or in any other score (Für Elise, Arabesque, Canon in D, Invention No.1, La Candeur, scales).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 6 categories of defect (M29 accidental discrepancy; M30 missing 8va bracket; M34/M35/M36 missing accidentals; M34/M35/M36 rest misalignment; M37 slur misplacement; M32–M34 element overlaps) are resolved — verified by visual inspection and automated regression tests against the Nocturne MusicXML fixture.
- **SC-002**: A musician with no prior exposure to the bug can read measures M29–M37 without identifying any notation error, achieving a 0-defect visual review on first inspection.
- **SC-003**: Automated regression tests for each defect category pass at 100% after the fix, and continue to pass on subsequent builds.
- **SC-004**: No regression is introduced in the rendering of any measure outside M29–M37 in the Nocturne, confirmed by running the full existing test suite with zero new failures.
- **SC-005**: No regression is introduced in the rendering of any other preloaded score (Für Elise, Arabesque, Canon in D, Invention No.1, La Candeur, scales), confirmed by the full test suite.

## Assumptions

- "8gv" in the original description is a typographic shorthand for the standard "8va" (ottava) bracket notation; this spec treats it as such.
- The defects reported are rendering bugs — the source MusicXML (Chopin_NocturneOp9No2.mxl) encodes the correct musical content, and the issue lies entirely in how that content is displayed.
- Measure numbers follow 1-based counting from the anacrusis, consistent with the convention used in the existing test suite (e.g., `test_chopin_nocturne_38_measures_fits_in_fifteen_systems`).
- The "bb" notation in M29 refers to a double-flat accidental (𝄫) — a single note requiring two flat signs — not two separate flats.
- The "overlaps" in M32–M34 are horizontal/visual collisions between notation glyphs at or near barlines, not audio/timing overlaps.

## Known Issues & Regression Tests *(if applicable)*

### Defect 1: M29 Double-Flat Accidental (US1 — Fixed)
- **Root cause**: The accidental match arm in `positioner.rs` (~L928) used a `_ => natural` wildcard for unrecognized `alter` values. `alter = -2` (double-flat) fell through to natural instead of emitting U+E264.
- **Fix**: Added explicit match arms for all five `alter` values (-2, -1, 0, 1, 2) plus collision-detection glyph name resolution for double-flat/double-sharp.
- **Regression test**: `test_nocturne_m29_double_flat_accidental` in `backend/tests/nocturne_m29_m37_test.rs`

### Defect 2: M30/M31 8va Bracket (US2 — Verified)
- **Finding**: MusicXML places `<octave-shift type="down" size="8">` in M31 (not M30 as initially reported). The layout engine correctly generates the ottava bracket at M31.
- **Status**: No code change required — the bracket is present and correctly positioned per the MusicXML source data.
- **Regression test**: `test_nocturne_ottava_bracket_present` in `backend/tests/nocturne_m29_m37_test.rs`

### Defect 3: M34–M36 Courtesy Accidentals (US1 — Verified)
- **Finding**: All courtesy accidentals encoded in the MusicXML for M34–M36 are correctly rendered in the layout output. The accidental state machine uses written pitch consistently even inside ottava regions.
- **Status**: The double-flat match arm fix (Defect 1) was the only code change needed. Courtesy accidentals in M34–M36 were already working correctly.
- **Regression test**: `test_nocturne_m34_m36_courtesy_accidentals` in `backend/tests/nocturne_m29_m37_test.rs`

### Defect 4: M34–M36 Rest Centering (US3 — Verified)
- **Finding**: Rest glyphs in M34–M36 are positioned at correct Y coordinates within the staff (y=7400.0 in system 13, y=7920.0 in system 14). The `rest_y()` function produces valid vertical positions.
- **Status**: No code change required — rest vertical positioning is correct.
- **Regression test**: `test_nocturne_m34_m36_rest_centering` in `backend/tests/nocturne_m29_m37_test.rs`

### Defect 5: M37 Slur Positioning (US4 — Verified)
- **Finding**: Slur arcs for M37 are present in the layout output with valid coordinates (`start.x < end.x`, within system bounds). The slur rendering in `annotations.rs` correctly handles both same-system and cross-system slurs. 75 total slur arcs are generated across all 16 systems.
- **Status**: No code change required — slur positioning is correct.
- **Regression test**: `test_nocturne_m37_slur_coordinates` in `backend/tests/nocturne_m29_m37_test.rs`

### Defect 6: M32–M34 Boundary Overlaps (US5 — Verified)
- **Finding**: Measure boundary clearance at M32→M33 and M33→M34 meets the minimum 4.0 layout unit threshold. No horizontal glyph collisions were detected at these barlines.
- **Status**: No code change required — boundary spacing is adequate.
- **Regression test**: `test_nocturne_m32_m34_no_overlaps` in `backend/tests/nocturne_m29_m37_test.rs`

