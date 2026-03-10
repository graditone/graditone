# Feature Specification: Time Signatures

**Feature Branch**: `044-time-signatures`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "Add support for time signatures. Right now all scores are displayed as 4/4. But for example, Arabesque is 2/4. Implement the support for Arabesque 2/4 trying to do it in a generic way."

## Clarifications

### Session 2026-03-10

- Q: How should the anacrusis (pickup measure) be numbered? → A: Anacrusis is measure 1; full measures start at 2 (standard notation convention).
- Q: How should beamed note grouping work in compound time signatures (e.g., 6/8)? → A: Group by dotted beats — 6/8 → 2 groups of 3 eighths; 9/8 → 3 groups of 3; 12/8 → 4 groups of 3 (standard compound meter interpretation).
- Q: On which systems should the time signature glyph be displayed? → A: First system only.
- Q: Are mid-piece time signature changes in scope (display, layout, or playback)? → A: Fully out of scope — mid-piece changes are ignored entirely (no glyph, no layout adaptation, no playback adaptation).
- Q: What does BPM refer to when the time signature denominator is not a quarter note (e.g., 6/8)? → A: BPM always refers to the quarter note, regardless of denominator. Tempo implementation is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct Measure Layout for Non-4/4 Scores (Priority: P1)

A user opens Burgmüller's Arabesque (a 2/4 piece) in Graditone. The score displays with measures that match the 2/4 time signature — each measure contains two quarter-note beats worth of content. Barlines appear in the correct positions, and the measure numbering is accurate throughout the piece.

**Why this priority**: This is the core value of the feature. Without correct measure boundaries, every downstream behavior (playback, highlighting, scrolling) will be wrong for any non-4/4 score. The current system hardcodes 4/4 measure boundaries, causing Arabesque and other non-4/4 scores to display with incorrect barline placement.

**Independent Test**: Open Arabesque in the score viewer and verify that barlines divide the score into 2-beat measures rather than 4-beat measures. Compare measure count with the original sheet music.

**Acceptance Scenarios**:

1. **Given** a user opens Burgmüller's Arabesque (2/4), **When** the score renders, **Then** each measure spans exactly 2 quarter-note beats and barlines appear at the correct positions.
2. **Given** a user opens a 4/4 score (e.g., Für Elise), **When** the score renders, **Then** measures still span 4 quarter-note beats — existing behavior is preserved.
3. **Given** a user opens Arabesque, **When** the score renders, **Then** the total number of measures matches the original composition.

---

### User Story 2 - Time Signature Imported from MusicXML (Priority: P1)

When a user loads a MusicXML file that contains a time signature other than 4/4, the system reads and preserves that time signature in the internal score model, so all downstream features (layout, playback, display) use the correct meter.

**Why this priority**: Equally critical to Story 1 — without importing the time signature from MusicXML, the layout engine has no information to work with. The parser already reads this data, but the converter discards it and re-inserts a 4/4 default.

**Independent Test**: Import Arabesque's MusicXML and inspect the internal score model (via automated test) to confirm a 2/4 time signature event at tick 0.

**Acceptance Scenarios**:

1. **Given** a MusicXML file with a `<time><beats>2</beats><beat-type>4</beat-type></time>` element, **When** the file is imported, **Then** the score model contains a time signature event with numerator=2 and denominator=4 at tick 0.
2. **Given** a MusicXML file with a `<time><beats>3</beats><beat-type>4</beat-type></time>` element, **When** the file is imported, **Then** the score model contains a time signature event with numerator=3 and denominator=4 at tick 0.
3. **Given** a MusicXML file with no explicit `<time>` element, **When** the file is imported, **Then** the score model defaults to 4/4 time signature.

---

### User Story 3 - Playback Respects Time Signature (Priority: P2)

A user plays back Arabesque and the playback cursor advances through measures that match the 2/4 meter. Note highlighting, scroll-following, and any visual beat indicators align with the actual time signature rather than assuming 4/4.

**Why this priority**: Correct playback is essential for a practice tool but depends on Stories 1 and 2 being implemented first. Once measure boundaries are correct, playback alignment follows naturally.

**Independent Test**: Play Arabesque and verify that the playback highlight advances through measures at the correct pace — reaching a new barline every 2 beats, not every 4 beats.

**Acceptance Scenarios**:

1. **Given** a user plays Arabesque (2/4), **When** playback progresses, **Then** the playback cursor crosses barlines every 2 beats.
2. **Given** a user plays a 4/4 score, **When** playback progresses, **Then** the playback cursor still crosses barlines every 4 beats — no regression.

---

### User Story 4 - Time Signature Symbol Displayed Correctly (Priority: P2)

When a score is rendered, the time signature symbol (e.g., "2/4", "3/4", "6/8") is displayed at the beginning of the first system, matching the imported time signature.

**Why this priority**: Visual correctness matters for users reading the score, but the system already has partial glyph rendering for time signatures. This story ensures the displayed symbol matches the actual imported meter rather than always showing 4/4.

**Independent Test**: Open Arabesque and verify the time signature glyph at the start of the first system shows "2/4" rather than "4/4".

**Acceptance Scenarios**:

1. **Given** a user opens Arabesque (2/4), **When** the score renders, **Then** the time signature glyph at the first system shows 2 over 4.
2. **Given** a user opens Canon in D (4/4), **When** the score renders, **Then** the time signature glyph at the first system shows 4 over 4.

---

### Edge Cases

- What happens when a MusicXML file contains a time signature change mid-piece? Mid-piece time signature changes are fully out of scope. The system uses the time signature declared at the beginning of the piece for all measure boundaries, layout, display, and playback throughout the entire score. Any subsequent `<time>` elements in the MusicXML are ignored.
- What happens when a MusicXML file has a compound time signature (e.g., 6/8)? The system should import and display it correctly — measure boundaries should span 6 eighth-note beats.
- What happens when a MusicXML file has an unusual time signature (e.g., 5/4, 7/8)? The system should import the numerator and denominator as-is and calculate measure boundaries generically using the formula: ticks per measure = PPQ × (4 / denominator) × numerator.
- What happens when a pickup measure (anacrusis) is present? The first measure may contain fewer beats than the time signature indicates. The anacrusis is counted as measure 1 (standard notation convention — consistent with Sibelius, Finale, and MuseScore); subsequent full measures are numbered 2, 3, 4, etc. Tick-to-measure calculations must account for the partial first measure without failing or producing an off-by-one error.
- What happens when multiple staves in a multi-instrument score have different time signatures? This is out of scope — all staves share the same global time signature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read the time signature (numerator and denominator) from MusicXML files during import and store it in the score's global structural events.
- **FR-002**: System MUST use the imported time signature to calculate measure boundaries, using the formula: ticks per measure = PPQ × (4 / denominator) × numerator, instead of hardcoding 3840 ticks (4/4).
- **FR-003**: System MUST default to 4/4 time signature when no explicit time signature is present in the imported file.
- **FR-004**: System MUST display the correct time signature glyph (numerator/denominator) at the beginning of the first system only, matching the time signature declared at the start of the piece. The glyph is not repeated on subsequent systems and mid-piece time signature changes are not displayed.
- **FR-005**: System MUST place barlines at measure boundaries derived from the actual time signature, not a hardcoded 4/4 assumption.
- **FR-006**: System MUST calculate correct measure numbers based on the actual time signature for the entire score. When a pickup measure (anacrusis) is present, it is counted as measure 1 and subsequent full measures are numbered starting from 2.
- **FR-007**: System MUST align playback cursor, note highlighting, and scroll behavior to measure boundaries defined by the actual time signature.
- **FR-008**: System MUST support standard simple time signatures (2/4, 3/4, 4/4) and compound time signatures (3/8, 6/8, 9/8, 12/8) with correct measure boundary calculation.
- **FR-009**: System MUST preserve correct behavior for all existing 4/4 scores — no regression in current functionality.
- **FR-010**: System MUST correctly group beamed notes according to the time signature's beat structure. For compound time signatures, grouping follows dotted-beat divisions: 6/8 → 2 groups of 3 eighth notes; 9/8 → 3 groups of 3 eighth notes; 12/8 → 4 groups of 3 eighth notes.

### Key Entities

- **Time Signature Event**: A global structural event on the score that specifies the meter. Key attributes: tick position, numerator (beats per measure), denominator (beat unit). One time signature event exists at minimum at tick 0. Relates to the Score's global structural events collection.
- **Measure**: A segment of the score bounded by barlines. Its duration in ticks is determined by the active time signature. Key attributes: measure number, start tick, end tick, ticks per measure.
- **Score**: The root entity. Contains global structural events including time signature events. The time signature affects how the score is partitioned into measures for layout, display, and playback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Arabesque (2/4) displays with the correct number of measures matching the original composition, with barlines at 2-beat intervals.
- **SC-002**: All existing 4/4 scores (Für Elise, Canon in D, Nocturne, etc.) continue to render identically — zero visual regressions.
- **SC-003**: The time signature glyph displayed at the start of each score matches the imported time signature for all preloaded scores.
- **SC-004**: Playback of Arabesque advances through barlines at 2-beat intervals, with note highlighting and scrolling aligned to measure boundaries.
- **SC-005**: Any standard time signature (2/4, 3/4, 4/4, 6/8) imported from MusicXML is correctly reflected in measure boundaries and display.
- **SC-006**: Users can practice Arabesque with correct measure structure without any manual configuration or workarounds.

## Assumptions

- Mid-piece time signature changes are fully out of scope. The system reads only the first time signature in the score and uses it for the entire piece — for all measure boundaries, layout, glyph display, and playback. Subsequent `<time>` elements in the MusicXML are ignored. This is a future enhancement.
- All staves within a score share the same time signature (no polymetric support).
- The PPQ (pulses per quarter note) value of 960 is the standard used in the system. Measure tick calculations will use this constant.
- BPM (tempo) always refers to quarter-note beats per minute, regardless of the time signature denominator. A score in 6/8 uses the same BPM interpretation as one in 4/4. The existing tempo implementation requires no changes for this feature.
- Pickup measures (anacrusis) may exist in some scores. The system should handle a partial first measure gracefully, but detailed anacrusis handling is not a primary goal of this feature.
- The MusicXML parser already reads time signature data correctly — the gap is in the converter (which discards parsed time signatures) and the layout engine (which hardcodes 4/4 measure boundaries).

## Known Issues & Regression Tests *(if applicable)*

<!--
  This section is intentionally empty at specification time.
  It will be populated during implementation as issues are discovered.
-->

