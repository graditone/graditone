# Feature Specification: Music Dynamics Score Display

**Feature Branch**: `072-dynamics-score-display`  
**Worktree**: `../worktrees/072-dynamics-score-display`  
**Created**: 2026-04-04  
**Status**: Draft — Clarified  
**Input**: User description: "music dynamics must be shown in the score. We support music dynamics when reproducing the sound. We need to show them also in the score layout and the rendering."

## Clarifications

### Session 2026-04-04

- Q: How should dynamic symbols (pp, mf, ff, etc.) be visually rendered in the score? → A: Music font glyphs using the existing SMuFL-compatible font (Bravura or equivalent), consistent with all other notation symbols.
- Q: How should a hairpin that spans a system line break be rendered? → A: Split across both lines — hairpin draws to the end of the first system and resumes from the left margin of the next system, both segments sharing the same wedge direction.
- Q: What is the baseline vertical clearance between the bottom staff line and the top of a dynamic symbol? → A: 2 staff spaces.
- Q: Should the feature display a fallback indicator for unrecognised dynamic markings (e.g., sfz, fp) that the importer skips? → A: Yes — show a generic fallback indicator (e.g., italic "dyn") at the correct position so the reader knows a dynamic was present but is not fully supported.
- Q: Should dynamic symbols and hairpin graphics scale with the staff size? → A: Yes — scale proportionally with staff size, consistent with all other notation elements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Static Dynamic Markings Visible in Score (Priority: P1)

A musician opens a score that contains dynamic markings such as *p*, *mf*, and *ff*. As they read through the score they can clearly see each dynamic symbol placed below the relevant staff at the position where the dynamic change occurs — exactly as they would expect in a printed edition.

**Why this priority**: Static dynamic markings are the most common form of dynamics notation and are the baseline expectation for any score viewer. Without this, dynamics are invisible and the score is incomplete for reading purposes. This alone constitutes a meaningful MVP that delivers immediate value.

**Independent Test**: Can be fully tested by rendering any MusicXML score that contains `<dynamics>` direction elements and confirming that the corresponding symbols (e.g., *p*, *mf*, *ff*) are visible in the score view at the correct positions.

**Acceptance Scenarios**:

1. **Given** a score containing a *p* marking at beat 1 of measure 3 on the violin staff, **When** the score is rendered, **Then** the *p* symbol appears below the violin staff aligned with beat 1 of measure 3.
2. **Given** a score containing consecutive dynamics (*p* at beat 1, *ff* at beat 3 of the same measure), **When** the score is rendered, **Then** both symbols appear below the staff at their respective beat positions without overlapping.
3. **Given** a score with no dynamic markings at all, **When** the score is rendered, **Then** the score displays normally with no errors and no unexpected symbols.

---

### User Story 2 - Hairpin Crescendo and Decrescendo Visible in Score (Priority: P2)

A musician opens a score containing a crescendo hairpin spanning several notes. They see the characteristic wedge graphic opening from left to right beneath the staff, starting at the note where the gradual increase begins and closing at the note where it ends. Diminuendo (decrescendo) hairpins appear as the mirror image — closing from left to right.

**Why this priority**: Hairpins are the second most common dynamic notation. While scores without them are technically readable, hairpins communicate essential phrasing information. This story extends P1 to complete the full dynamics reading experience.

**Independent Test**: Can be fully tested by rendering a MusicXML score that contains `<wedge>` direction elements and confirming the hairpin graphics are present, correctly oriented, and span the right note range.

**Acceptance Scenarios**:

1. **Given** a score with a crescendo spanning from beat 2 of measure 5 to beat 4 of measure 6, **When** the score is rendered, **Then** a growing wedge graphic appears below the staff from the start note to the end note.
2. **Given** a score with a diminuendo (decrescendo), **When** the score is rendered, **Then** a shrinking wedge graphic appears, wide at the start and tapering to a point at the end.
3. **Given** a hairpin that spans a barline, **When** the score is rendered, **Then** the hairpin graphic continues visually across the barline without being cut off.
4. **Given** a hairpin that spans a system line break, **When** the score is rendered, **Then** the hairpin graphic extends to the end of the first system and a continuation segment begins from the left margin of the next system, both segments preserving the same wedge direction.

---

### User Story 3 - Dynamics Consistent Between Visual Score and Audio Playback (Priority: P3)

A musician plays back a score and notices the sound becomes louder at a certain passage. They pause playback and look at the score at that position — they can see a *ff* marking exactly where the volume increased. The visual score and the audio are in full agreement.

**Why this priority**: Consistency between what is seen and what is heard is an important quality-of-life guarantee. This is achievable because dynamics data is already shared between layout and playback, and this story validates that neither pipeline diverges.

**Independent Test**: Can be fully tested by comparing the dynamic markings visible in the score view against the velocity changes produced during playback for the same score, using a score with diverse dynamics.

**Acceptance Scenarios**:

1. **Given** a score with a *ff* marking at measure 10, **When** the user views the rendered score and also plays back measure 10, **Then** the *ff* symbol is visible in the score and the playback volume at measure 10 corresponds to that *ff* level.
2. **Given** a score with a crescendo hairpin in measures 4–8, **When** the user views the score and listens to playback of those measures, **Then** the hairpin is visible in the score and the volume gradually increases during playback of those measures.

---

### Edge Cases

- What happens when a score contains no dynamic markings? The score renders normally with no errors and no placeholder symbols.
- What happens when a score contains an unrecognised dynamic marking (e.g., *sfz*)? A generic fallback indicator (italic "dyn") is shown at the correct staff position instead of nothing.
- What happens when a static dynamic and a hairpin start at the same beat position? Both are rendered without either one obscuring the other.
- What happens when consecutive dynamic markings appear at adjacent note positions? All markings are shown; none is silently dropped.
- What happens when a hairpin is very short (spanning only two adjacent notes)? A compact but still recognisable wedge graphic is shown.
- What happens when a dynamic marking appears on the very first or very last note of the score? The symbol is positioned correctly at the boundary without visual clipping.
- What happens when multiple staves each carry their own dynamics at the same measure? Each staff's dynamics are displayed independently, aligned to their own staff, without crossing into adjacent staves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The score rendering MUST display all static dynamic level markings present in a score (ppp, pp, p, mp, mf, f, ff, fff) as standard dynamic symbols below the staff to which they apply, rendered using SMuFL-compatible music font glyphs (e.g., Bravura) consistent with all other notation symbols in the score.
- **FR-002**: Each static dynamic symbol MUST be positioned horizontally at the beat or note position where the dynamic change occurs.
- **FR-003**: The score rendering MUST display gradual dynamic markings (crescendo and diminuendo) as hairpin wedge graphics below the staff to which they apply.
- **FR-004**: Hairpin graphics MUST extend horizontally from the beat position where the gradual dynamic begins to the beat position where it ends. When a hairpin spans a system line break, it MUST be split into two segments: the first segment runs to the end of the first system, and the second segment resumes from the left margin of the next system, both sharing the same crescendo or diminuendo wedge direction.
- **FR-005**: A crescendo hairpin MUST be rendered as a wedge that opens from left to right; a diminuendo hairpin MUST be rendered as a wedge that closes from left to right.
- **FR-006**: When a score contains multiple staves, each staff's dynamic markings MUST be rendered relative to that staff only and MUST NOT visually intrude on adjacent staves.
- **FR-007**: Dynamic markings rendered in the score MUST be derived from the same underlying dynamic data that drives audio playback velocity, ensuring visual and audio consistency.
- **FR-008**: The layout engine MUST reserve a minimum vertical clearance of 2 staff spaces between the bottom staff line and the top of any dynamic symbol or hairpin graphic, preventing overlap with lyrics, articulations, or other below-staff annotations.
- **FR-009**: Scores containing no dynamic markings MUST render without errors, visual artifacts, or unexpected spacing changes.
- **FR-010**: When a MusicXML score contains a dynamic marking that the importer does not recognise (e.g., *sfz*, *fp*), the score rendering MUST display a generic fallback indicator (italic "dyn") at the correct staff position and beat, making the omission visible rather than silent.
- **FR-011**: Dynamic symbols and hairpin graphics MUST scale proportionally with the staff size so that they remain visually consistent with all other notation elements at any zoom level or print size.

### Key Entities

- **Dynamic Marking**: An instantaneous dynamic level indicator (ppp through fff) associated with a specific staff and a specific beat position in the score. Determines the intensity at which notes are performed from that point onward.
- **Gradual Dynamic (Hairpin)**: A directional intensity transition (crescendo or diminuendo) associated with a specific staff and spanning a range of beats from a start position to a stop position. Visually represented as a wedge graphic.

## Assumptions

- The scope of fully supported dynamic markings for this feature is: ppp, pp, p, mp, mf, f, ff, fff for static markings, and crescendo/diminuendo for gradual dynamics. Extended notations such as *sfz* or *fp* are not rendered as their precise symbols; instead a generic fallback indicator is shown at the correct position (see FR-010).
- Dynamic markings follow standard Western notation conventions and are always placed below the staff (above-staff placement for vocal or conductor scores is not required at this stage).
- The existing dynamic data already present in the score data model is sufficient; no changes to how dynamics are imported or stored are needed for this feature.
- Dynamic markings displayed at the same beat position as other below-staff elements (e.g., lyrics) use standard engraving priority without needing an explicit conflict-resolution setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of static dynamic markings present in a loaded score (ppp through fff) are visually displayed in the rendered score view.
- **SC-002**: 100% of gradual dynamic markings (crescendo and diminuendo hairpins) present in a loaded score are visually displayed in the rendered score view.
- **SC-003**: Every dynamic symbol is horizontally aligned with the note or beat it applies to; no symbol is misplaced by more than one note-width from its correct position.
- **SC-004**: Every hairpin graphic starts and ends at its correct boundary notes, with no hairpin truncated short or extended past its intended range.
- **SC-005**: The dynamics displayed in the score and the velocity changes produced during audio playback are derived from the same data source, with no discrepancies for any score tested.
- **SC-006**: Scores with no dynamic markings render without errors and do not exhibit unexpected vertical spacing compared to how they rendered before this feature was introduced.
- **SC-007**: Every dynamic symbol and hairpin graphic is placed with a minimum of 2 staff spaces of vertical clearance from the bottom staff line; no dynamic element overlaps the staff itself or other below-staff annotations.

---

### Issue #2: [Next Issue if any]

[Repeat structure above]

<!--
  NOTE: This section grows organically during development and maintenance.
  Each issue becomes documentation + a regression test.
  Over time, this builds a comprehensive record of edge cases and failure modes.
-->

