# Feature Specification: Rest Symbols in Scores

**Feature Branch**: `043-score-rests`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "add rests to scores"

## Clarifications

### Session 2026-03-10

- Q: During playback, should rest symbols be visually highlighted when the cursor is in their duration? → A: No — rest symbols are always static; no highlight or cursor effect applied to rest glyphs during playback.
- Q: How should the system determine whether a rest spans the full measure (for centering)? → A: A rest is a full-measure rest if its duration in divisions equals the measure's total duration derived from the time signature; no dependency on the MusicXML `measure="yes"` attribute.
- Q: What is the measurable performance floor for scrolling a rest-heavy score? → A: 30 fps minimum — consistent with the beaming feature threshold.
- Q: Should rests participate in horizontal spacing (push adjacent notes apart based on duration)? → A: Yes — a rest's beat duration determines the horizontal space it occupies, exactly as a note does.
- Q: How should visual correctness of rest symbols be validated? → A: Automated snapshot tests — render a fixture score with each rest type and compare pixel output against a committed reference image.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visible Rest Symbols in Imported Scores (Priority: P1)

A musician imports a MusicXML score that contains rests (quarter rests, half rests, whole rests, etc.). Instead of seeing an unexplained gap of empty space where the rests should be, they see the appropriate rest symbol drawn at the correct staff position. The score is immediately readable and visually matches standard printed sheet music.

**Why this priority**: Currently rests are completely invisible — they advance timing but produce no visual output. A score with rests but no rest symbols looks broken and incomplete. This is the foundational deliverable: before worrying about multi-voice or measure-spanning scenarios, a musician must see standard rest symbols where rests exist.

**Independent Test**: Import a MusicXML file containing a 4/4 measure with a quarter note followed by a quarter rest followed by a half note. Verify that the quarter rest symbol appears in the correct horizontal position between the first note and the half note, positioned on the middle staff line.

**Acceptance Scenarios**:

1. **Given** a MusicXML file with a quarter rest in a measure, **When** the user imports the file, **Then** a quarter rest symbol is displayed at the correct horizontal position within the measure, centered vertically on the middle staff line.
2. **Given** a MusicXML file with a half rest in a measure, **When** the user imports the file, **Then** a half rest symbol (hat shape sitting on the middle line) is displayed at the correct horizontal position.
3. **Given** a MusicXML file with a whole rest in a measure, **When** the user imports the file, **Then** a whole rest symbol (inverted hat hanging from the second-to-top line) is displayed at the correct horizontal position.
4. **Given** a MusicXML file with an eighth rest in a measure, **When** the user imports the file, **Then** an eighth rest symbol is displayed at the correct horizontal position on the staff.
5. **Given** a MusicXML file with a sixteenth rest in a measure, **When** the user imports the file, **Then** a sixteenth rest symbol is displayed at the correct horizontal position on the staff.

---

### User Story 2 - Full-Measure Rest Centered in Measure (Priority: P2)

A musician views a score where an entire measure is a rest (a common pattern in orchestral and ensemble music when one instrument has nothing to play for a full measure). The whole rest symbol is displayed centered horizontally within the measure, clearly indicating the player rests for the entire bar, matching standard engraving conventions.

**Why this priority**: Full-measure rests are extremely common in multi-instrument scores. Centering the symbol within the measure is a specific engraving convention that distinguishes a measure-rest from a partial-measure whole-note rest. It is a self-contained visual behavior that can be validated independently.

**Independent Test**: Import a MusicXML file where one measure is a full-measure rest. Verify that the whole rest symbol is horizontally centered within the measure's available space, rather than left-aligned at the measure's start position.

**Acceptance Scenarios**:

1. **Given** a measure marked as a full-measure rest in MusicXML, **When** the score is displayed, **Then** the whole rest symbol is centered horizontally between the opening and closing bar lines of that measure.
2. **Given** a measure containing a single whole rest (implicit full-measure rest based on duration), **When** the score is displayed, **Then** the rest symbol is centered within the measure.
3. **Given** a score where multiple consecutive measures are full-measure rests, **When** the score is displayed, **Then** each measure displays its own centered whole rest symbol.

---

### User Story 3 - Rest Symbols in Multi-Voice Staves (Priority: P3)

A musician views a piano score where the treble clef staff has two voices active simultaneously: Voice 1 has notes on beats 1 and 3, Voice 2 has notes on beats 2 and 4. The rest symbols for each voice appear at the correct staff positions — Voice 1 rests on the upper half of the staff, Voice 2 rests on the lower half — following standard multi-voice engraving conventions.

**Why this priority**: Multi-voice notation is common in piano and choral music. Without voice-specific rest positioning, rests from different voices would overlap or be ambiguous. This story builds on the basic rest rendering delivered in Story 1 and adds positional awareness.

**Independent Test**: Import a MusicXML file with two simultaneous voices in one staff, each with rests at different beat positions. Verify that the rest symbols for Voice 1 appear above the middle staff line and Voice 2 rests appear below the middle staff line.

**Acceptance Scenarios**:

1. **Given** a staff with two voices where Voice 1 has a rest, **When** the score is displayed, **Then** the Voice 1 rest symbol is positioned above the middle staff line (staff position 4 or higher).
2. **Given** a staff with two voices where Voice 2 has a rest, **When** the score is displayed, **Then** the Voice 2 rest symbol is positioned below the middle staff line (staff position 3 or lower).
3. **Given** a staff where both voices have rests at the same beat, **When** the score is displayed, **Then** both rest symbols are drawn without overlapping, each at their respective voice positions.

---

### Edge Cases

- What happens when a rest falls in a measure that already has a whole rest? The whole rest symbol should be displayed once, centered in the measure; duplicate rests within the same voice for the same full measure should not cause double-rendering.
- How does the system handle a rest with an unrecognized or unsupported duration? The closest standard duration symbol should be used as a fallback, or the rest should be omitted from rendering with no visible artifact.
- What happens when a rest falls outside the visible viewport during scrolling? Rests outside the viewport should not be rendered, consistent with how notes outside the viewport are handled.
- How does the system handle a rest in a MusicXML file with no explicit staff or voice attribute? The rest should default to staff 1, voice 1, matching the behavior for notes with missing attributes.
- What happens when a rest occurs at the same horizontal position as a barline due to layout rounding? The rest symbol must always appear inside the measure, never overlapping or crossing a barline.
- What happens when a measure contains a mix of notes and rests whose combined beat durations exactly fill the measure? The spacing algorithm must treat rests and notes equivalently so the total measure width remains consistent with adjacent note-only measures.
- How does the system render uncommon rest durations (32nd, 64th)? SMuFL provides glyphs for these; they should be rendered using the appropriate glyph, falling back to a quarter rest symbol if the glyph is unavailable in the loaded font.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a rest symbol glyph for every `Rest` element in the score model, using the SMuFL glyph corresponding to the rest's duration (whole, half, quarter, eighth, sixteenth, thirty-second, sixty-fourth).
- **FR-002**: System MUST position each rest symbol at the correct horizontal position within its measure, determined by the rest's beat offset within the measure.
- **FR-003**: System MUST position rest symbols at their standard vertical staff positions: whole rest hanging from the second-to-top staff line, half rest sitting on the middle staff line, quarter/eighth/sixteenth rests centered on the middle staff line.
- **FR-004**: System MUST center whole rest symbols horizontally within the measure when the rest's duration in divisions equals the measure's total duration derived from the active time signature. This detection MUST NOT require or depend on the MusicXML `measure="yes"` attribute.
- **FR-005**: System MUST adjust rest symbol vertical position based on voice number in multi-voice staves: Voice 1 rests shift to a position above the middle staff line, Voice 2 rests shift to a position below the middle staff line.
- **FR-006**: System MUST include rest glyphs in the layout output so that measures containing only rests still have visible content and correct horizontal spacing.
- **FR-007**: System MUST NOT render rest symbols outside measure boundaries or overlapping bar lines.
- **FR-008**: System MUST maintain the existing timing behavior: rests continue to advance the beat position and affect note positioning within the measure.
- **FR-009**: System MUST include rest symbols in the layout bounding box calculations, and a rest's beat duration MUST determine the horizontal space it occupies within the measure — proportional to its duration relative to adjacent notes and rests, exactly as note spacing is determined.
- **FR-010**: System MUST NOT regress existing note rendering, beaming, or playback behavior when rest rendering is added.
- **FR-011**: System MUST NOT apply any playback highlight, cursor effect, or visual state change to rest symbols during playback — rest symbols are always rendered in a static, neutral state regardless of playback position.

### Key Entities

- **Rest Symbol**: A visual glyph drawn on the staff to represent a period of silence. Characterized by its duration (which determines the glyph shape), voice number (which determines vertical position in multi-voice staves), staff number, and horizontal beat position within the measure.
- **Full-Measure Rest**: A rest whose duration in divisions equals the measure's total duration as defined by the active time signature. Positioned centered horizontally within the measure rather than at its beat offset. Detection is based purely on duration comparison — not on the presence of the MusicXML `measure="yes"` attribute.
- **Rest Glyph**: The specific SMuFL Unicode symbol rendered for a given rest duration. Each duration maps to a distinct symbol (whole, half, quarter, eighth, sixteenth, thirty-second, sixty-fourth rest glyphs).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All rest symbols in imported MusicXML files are rendered as visible glyphs matching the rest duration, verified against the five standard bundled test scores (Bach Invention, Fur Elise, Arabesque, Canon in D, Nocturne).
- **SC-002**: Full-measure rest symbols are centered horizontally within their measures, with no rests misaligned to the left edge.
- **SC-003**: Multi-voice staves display Voice 1 and Voice 2 rests at distinct non-overlapping vertical positions when both voices have rests at the same beat.
- **SC-004**: Scrolling a score with 10 staves and 100 measures where 50% or more of note slots are rests maintains a frame rate above 30 frames per second — consistent with the beaming feature performance threshold.
- **SC-005**: 100% of existing test cases continue to pass after rest rendering is implemented, ensuring no regressions in note rendering, beaming, playback, or layout.
- **SC-006**: Automated snapshot tests render a fixture score containing one measure for each supported rest duration (whole, half, quarter, eighth, sixteenth, thirty-second, sixty-fourth) and compare the pixel output against committed reference images; all snapshots must pass with zero unexpected pixel differences.

## Assumptions

- The existing `RestData` struct (with `duration`, `voice`, and `staff` fields) already parsed from MusicXML provides sufficient information to render all standard rest symbols without additional parsing changes.
- The SMuFL font already loaded for note glyph rendering contains all required rest glyph codepoints for durations from whole through sixty-fourth.
- Dotted rests (rests with augmentation dots) are out of scope for this feature and will be addressed in a future feature.
- Tuplet rests (rests inside a tuplet group) are out of scope and will be handled when tuplet rendering is added.
- Multi-measure rest symbols (a thick bar with a number above, common in orchestral parts) are out of scope for this feature.

