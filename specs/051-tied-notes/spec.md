# Feature Specification: Tied Notes Support

**Feature Branch**: `051-tied-notes`  
**Created**: 2026-03-16  
**Status**: Implemented  
**Input**: User description: "add support for tied notes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Display of Tied Notes (Priority: P1)

When a user views a score that contains tied notes, the score correctly displays a curved arc (tie) connecting the noteheads of the same pitch. The tied note pair appears as a single sustained note visually, with the arc clearly showing that the second notehead is a continuation of the first.

**Why this priority**: Tied notes are extremely common in standard repertoire (Chopin, Beethoven, Burgmüller scores already in the app) — the arc is the most fundamental visual element of a tie. Without it, the score looks incorrect and the notation is unreadable.

**Independent Test**: Can be fully tested by loading a MusicXML score containing tied notes (e.g., `Chopin_NocturneOp9No2.mxl`) and verifying that a curved arc appears above or below the notehead pair connecting notes of the same pitch.

**Acceptance Scenarios**:

1. **Given** a score containing a tie between two quarter notes of the same pitch within a measure, **When** the user views the score, **Then** a curved arc connects the two noteheads and the second notehead is visually distinguishable as the tied (continuation) note
2. **Given** a score containing a tie that crosses a barline, **When** the user views the measures around the barline, **Then** the arc starts at the notehead before the barline and ends at the notehead after the barline
3. **Given** a chord where only some notes are tied, **When** viewing the score, **Then** arcs appear only on the specific pitches that are tied, not on all notes in the chord

---

### User Story 2 - Correct Playback Duration for Tied Notes (Priority: P2)

When a user plays back a score containing tied notes, the audio reflects the combined duration of tied notes as a single sustained sound. The second tied note is not re-attacked; instead, the held note continues uninterrupted through the tie.

**Why this priority**: Without correct playback, tied notes would sound like two separate short notes instead of one long held note — fundamentally changing the musical meaning. Correct duration is critical for the app's usefulness as a practice and listening tool.

**Independent Test**: Can be fully tested by playing back a measure containing a tie between a half note and a quarter note of the same pitch, and verifying that the resulting sound lasts 3 beats without a re-attack, compared to the non-tied version which would produce two separate attacks.

**Acceptance Scenarios**:

1. **Given** a tie connecting two quarter notes (same pitch), **When** the user plays back the score, **Then** the note sounds for the combined duration (2 beats) with no re-attack at the boundary
2. **Given** a tie crossing a barline (e.g., half note in measure 4 tied to a quarter note in measure 5), **When** playback passes the barline, **Then** the note continues without interruption for the full combined duration
3. **Given** a chord with a partial tie (only one pitch tied), **When** the user plays back the score, **Then** the tied pitch sustains while the untied pitches in the chord re-attack normally at the second chord position

---

### User Story 3 - Practice Mode Interaction with Tied Notes (Priority: P3)

When a user practices a score containing tied notes in step-by-step or note-by-note practice mode, tied note groups are treated as a single note event. The user presses the key once for the tied group and advances to the next distinct note, rather than needing to press the same key again for the continuation note.

**Why this priority**: In practice mode, requiring the user to "play" the tied continuation note would be musically incorrect and confusing — the tied note is not a new attack. This completes the feature by ensuring practice interaction matches real musical playing.

**Independent Test**: Can be tested by entering practice mode on a score with a tie and navigating through notes: stepping forward should skip over the continuation note of a tie, advancing directly to the next independently-played note.

**Acceptance Scenarios**:

1. **Given** a score in practice mode with a tie between two quarter notes, **When** the user plays or advances the first tied note, **Then** the cursor advances past the tied continuation note to the next independent note without requiring an additional input
2. **Given** a tie crossing a barline in practice mode, **When** the user advances through the note before the barline, **Then** the practice cursor moves to the first note after the tied note in the next measure

---

### Edge Cases

- What happens when a tie connects notes of different pitches (which is musically invalid — that would be a slur, not a tie)?
  - System treats it as a slur and does not merge durations; only notes explicitly marked as ties in the source are processed as ties
- What happens when a tied note chain involves more than two notes (e.g., three notes all tied together)?
  - All notes in the chain are merged into a single combined duration; the arc spans each pair sequentially
- What happens when a tie is present in the MusicXML but the two notes have different pitches (corrupt data)?
  - System ignores the tie and renders both notes normally with a warning logged; no arc is drawn
- How does the tie arc placement work when ties overlap with other notation elements (slurs, dynamics, articulations)?
  - Tie arcs are placed on the stem side opposite slurs; standard engraving rules apply (ties above for notes with stems down, below for stems up)
- What happens when a score has a tied note at the very end of the piece (the continuation note has no following attack)?
  - The tied continuation note at the end is rendered normally and plays back for its full written duration

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse tied note information from imported MusicXML scores and represent the tie relationship in the internal score model
- **FR-002**: System MUST render a visible curved arc between noteheads of the same pitch that are tied, following standard engraving conventions for arc direction (above for stem-down notes, below for stem-up notes)
- **FR-003**: System MUST correctly combine the durations of all notes in a tie chain for playback, producing a single sustained sound equal to the sum of all tied note durations
- **FR-004**: System MUST NOT re-attack a tied note during playback — the note must sustain continuously through the tie without a new onset
- **FR-005**: System MUST render tie arcs that cross barlines, with the arc starting before the barline and ending after it
- **FR-006**: System MUST support tie chains of more than two notes (multiple consecutive ties on the same pitch)
- **FR-007**: In practice mode, System MUST treat a tied note group as a single playable event, advancing past the continuation note(s) without requiring user input for each tied note
- **FR-008**: System MUST distinguish ties from slurs — only notes explicitly marked as tied are processed as ties; slurs are a separate visual element

### Key Entities

- **Tie**: A connection between two notes of the same pitch indicating that the second note's duration is added to the first rather than being played as a new attack. Has a start note, an end note, and a visual arc placement (above/below).
- **Tied Note Chain**: A sequence of two or more consecutive notes of the same pitch all connected by ties, resulting in a single combined duration for playback and practice purposes.
- **Tie Arc**: The visual curved line rendered between two tied noteheads, following musical engraving conventions for curvature direction and placement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing scores in the app that contain tied notes (e.g., Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D) display tie arcs correctly with no missing or misplaced arcs
- **SC-002**: Playback duration of tied notes matches the musically expected combined duration — a half note tied to a quarter note plays for exactly 3 beats with no audible gap or re-attack at the tie boundary
- **SC-003**: Importing a MusicXML file with 100% of its ties correctly encoded results in 100% of those ties being shown in the rendered score
- **SC-004**: In practice mode, users navigate through a piece with tied notes without encountering stalls or double-input requirements at tie boundaries
- **SC-005**: No regression in rendering or playback of existing scores that do not contain ties

