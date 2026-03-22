# Feature Specification: Fingering Support from MusicXML to Scores Layout

**Feature Branch**: `001-fingering-layout`  
**Created**: 2026-03-22  
**Status**: Draft  
**Input**: User description: "Add fingering support from MusicXML to scores layout"

## Overview

Sheet music for piano and other instruments routinely includes fingering annotations — small numerals (1–5, where 1 = thumb, 5 = pinky) printed above or below noteheads — to guide the musician's hand position. These annotations are encoded in MusicXML files inside `<notations><technical><fingering>` elements but are currently silently ignored by the import and layout pipeline. This feature closes that gap: fingering numbers encoded in a MusicXML source file must be parsed, carried through the layout pipeline, and displayed in the rendered score. The feature applies uniformly to all instrument types that use `<fingering>` elements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fingering Numbers Visible in Rendered Score (Priority: P1)

A musician opens a score that contains fingering annotations (e.g., the Chopin Nocturne Op. 9 No. 2, which has extensive fingering throughout both the treble and bass staves). They expect to see the same finger numbers printed near the corresponding noteheads that appear in the original printed edition, so they know exactly which finger to use for each note.

**Why this priority**: Fingering is the primary user-visible deliverable. Without this, the whole feature has zero value. All other stories are refinements of this core outcome.

**Independent Test**: Load the Chopin Nocturne MXL file and visually confirm that fingering numerals appear adjacent to notes that carry `<fingering>` elements in the source XML. This is a complete, demonstrable MVP.

**Acceptance Scenarios**:

1. **Given** a MusicXML score with `<fingering>` elements on selected notes, **When** the score is rendered, **Then** the fingering numerals (1–5) appear visually adjacent to the correct noteheads in the rendered output.
2. **Given** a fingering element on a treble-staff note, **When** the score is rendered, **Then** the numeral is positioned above the notehead (standard convention for treble staff).
3. **Given** a fingering element on a bass-staff note, **When** the score is rendered, **Then** the numeral is positioned below the notehead (standard convention for bass staff).
4. **Given** a score with no `<fingering>` elements, **When** the score is rendered, **Then** the visual output is identical to today's output — no regressions, no extra whitespace or changed spacing.

---

### User Story 2 - Multiple Fingerings on the Same Note (Priority: P2)

A musician encounters a chord or a note with a fingering substitution (e.g., a thumb-under crossing annotated with two fingers on the same note). The MusicXML source encodes two `<fingering>` elements under the same note's `<technical>` block. Both fingering numbers must be displayed.

**Why this priority**: Multiple fingerings on a single note occur in advanced pedagogical editions. Missing the second (or third) number would silently drop editorial information.

**Independent Test**: The Chopin Nocturne contains at least one note with two simultaneous fingering numbers (e.g., measure 29). Load the file and verify both numerals appear adjacent to that note.

**Acceptance Scenarios**:

1. **Given** a note with two `<fingering>` elements in the MusicXML source, **When** the score is rendered, **Then** both numerals appear near that notehead without overlap.
2. **Given** multiple fingerings that would stack vertically, **When** the score is rendered, **Then** the numerals are arranged so each is individually legible.

---

### User Story 3 - Fingering Coexists with Other Annotations (Priority: P3)

A musician views a score passage where a fingered note also carries a slur, tie, staccato dot, or ottava bracket. All annotations — including the fingering number — must be visible simultaneously without one covering another.

**Why this priority**: Real-world scores combine many notation types. A fingering numeral that vanishes behind a slur arc defeats its purpose, but resolving coexistence is only needed after the core display is working.

**Independent Test**: Find a note in the Chopin Nocturne that has both a fingering and a slur (`slur_next` + `<fingering>`). Render and confirm the numeral and the slur arc are simultaneously visible and not overlapping.

**Acceptance Scenarios**:

1. **Given** a note with both a fingering and a slur, **When** the score is rendered, **Then** the fingering numeral and the slur arc are both visible and not overlapping each other.
2. **Given** a note with both a fingering and a staccato dot, **When** the score is rendered, **Then** both the numeral and the dot appear in their expected positions without collision.

---

### Edge Cases

- A score file contains `<fingering>` elements with values outside the standard range (e.g., 0, or non-numeric content): the annotation should be dropped silently with no crash.
- A fingering is attached to a grace note: the numeral must scale appropriately (grace notes are rendered smaller than regular notes).
- A fingering is attached to a note on a ledger line far from the staff: the numeral must not overlap the ledger line.
- A note has a fingering on a voice assigned to the second staff (bass): placement logic must reference the correct staff's geometry.
- An `.mxl` compressed file is used (vs. plain `.musicxml`): the behavior must be identical since decompression is already handled upstream.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse the numeric value of every `<fingering>` element found inside `<notations><technical>` blocks in MusicXML source files.
- **FR-002**: The system MUST associate each parsed fingering value with its parent note and carry it through the full data pipeline from import to layout output.
- **FR-003**: The layout engine MUST compute a position (x, y) for each fingering annotation relative to its associated notehead using the following placement priority: (1) if the MusicXML `<fingering>` element has an explicit `placement` attribute (`above` or `below`), use that; (2) otherwise fall back to staff-based convention — above the notehead on the treble staff, below on the bass staff.
- **FR-004**: The layout output MUST include fingering annotations as discrete, addressable elements (positioned numerals) so the rendering layer can draw them without additional computation.
- **FR-005**: The system MUST support multiple fingering values on a single note, arranging them so all numerals are individually legible.
- **FR-006**: Fingering annotations MUST be visually distinct from noteheads, stem numbers, and other annotation types — rendered as small numerals in a style consistent with standard engraving.
- **FR-007**: Scores that contain no `<fingering>` elements MUST produce layout output identical to today's output (no spacing changes, no regression).
- **FR-008**: Fingering elements with invalid or non-numeric content MUST be discarded silently without causing a parse error or crash.
- **FR-009**: Fingering support MUST work for all staves in a score, regardless of instrument type. Every `<fingering>` element encountered during parsing is displayed; no instrument-based filtering is applied.
- **FR-010**: Fingering numerals MUST NOT affect horizontal note spacing. They occupy only vertical space outside the staff lines; the horizontal positions of noteheads, stems, and barlines remain unchanged regardless of whether fingering annotations are present.
- **FR-011**: Fingering annotations MUST be displayed in both the score viewer (read-only display) and the practice mode (active MIDI session). No rendering context suppresses fingering.

### Key Entities

- **Fingering Annotation**: A numeric digit (1–5) associated with a specific note, carrying a placement preference (above or below the notehead). It originates from a MusicXML `<technical><fingering>` element. A single note may have more than one fingering annotation.
- **Note** (domain): The existing core entity representing a pitched event. It must be extended to carry zero or more fingering annotations through the pipeline.
- **Fingering Glyph** (layout): A positioned numeral in the layout output that the renderer draws as a small digit near a notehead. It carries an (x, y) coordinate, the digit value, and a placement direction.

## Assumptions

- Fingering values of 1–5 are the standard piano fingering range; values outside this range may appear in other instrument contexts and are displayed as-is without validation (assumption: treat any numeric string value as valid).
- **Placement rule**: When a `<fingering>` element carries an explicit `placement` attribute (`above` / `below`), that value takes precedence. When the attribute is absent, the layout engine falls back to the staff-based convention: above the notehead on the treble staff, below on the bass staff.
- MusicXML `default-y` hint coordinates are used as a secondary reference only if the computed position creates a collision; otherwise the layout engine applies its own positioning rules for consistency.
- Fingering digits are rendered as plain text numerals using the same font family as other score text, at a smaller size than the main time-signature/dynamic text (assumption: no special SMuFL glyph needed for standard piano fingering numerals 1–5).
- Fingering numerals are single characters (digits 1–5) positioned outside the staff lines (above or below). Because they do not intrude into the horizontal note-spacing zone, horizontal spacing calculations remain unchanged.
- The feature is scoped to display only — no editing, adding, or removing fingerings through the UI.

## Clarifications

### Session 2026-03-22

- Q: When a MusicXML `<fingering>` element has an explicit `placement` attribute, should it take precedence over the staff-based convention (above treble / below bass)? → A: Yes — honor the `placement` attribute when present; fall back to staff-based convention only when it is absent.
- Q: Should fingering numerals affect horizontal note spacing? → A: No — fingering numerals occupy vertical space only (outside the staff lines, single character 1–5); horizontal note spacing is not adjusted for them.
- Q: Should fingering annotations be visible in both the score viewer and practice mode, or score viewer only? → A: Both — fingering annotations are displayed in the score viewer and in practice mode.
- Q: How is SC-001 (100% fingering elements rendered) verified — backend unit test on layout output JSON, or Playwright visual test? → A: Backend unit/integration test asserting that layout output JSON contains the correct fingering positions for known measures of the Chopin Nocturne.
- Q: Should `<fingering>` elements be displayed only for piano scores, or uniformly across all instrument types? → A: Uniformly across all instruments — no instrument-specific filtering; every `<fingering>` element is parsed and displayed regardless of instrument.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `<fingering>` elements present in the Chopin Nocturne Op. 9 No. 2 source file appear as fingering glyphs in the layout output JSON, with zero omissions. Verified by a backend unit/integration test that parses the score, runs the full layout pipeline, and asserts the expected fingering positions for known measures.
- **SC-002**: No fingering numeral overlaps its associated notehead — each numeral is fully visible and clear of the notehead bounds.
- **SC-003**: All existing scores that currently have no `<fingering>` elements render with zero visual difference after this change (verified by pixel-level or bounding-box comparison of layout output).
- **SC-004**: Scores with fingering annotations render without any layout artifacts (torn beams, misaligned barlines, displaced noteheads) attributable to the addition of fingering data.
- **SC-005**: The end-to-end pipeline (MusicXML import → layout compute → rendered output) for a fingered score completes within the same time budget as today — no measurable performance regression.

