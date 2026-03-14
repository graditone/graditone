# Feature Specification: Scales Generation

**Feature Branch**: `001-scales-generation`  
**Created**: 2026-03-14  
**Status**: Complete  
**Input**: User description: "Generate in scores/scales subfolder musicxml files for all major and minor scales for C4 and C5 octaves and add support for the load score dialog to show subfolders and load scores from them"

## Clarifications

### Session 2026-03-14

- Q: Should the Scales group in the load score dialog use a static labeled section header or a collapsible toggle? → A: Collapsible/expandable toggle — "Scales" header acts as a toggle to show/hide the list.
- Q: What note duration and time signature should scale MusicXML files use? → A: Quarter notes in 4/4 time — 4 notes per bar, 4 bars total (2 ascending + 2 descending).
- Q: In what order should scale scores appear within the Scales group in the dialog? → A: Circle of fifths order (C, G, D, A, E, B, F#, D♭, A♭, E♭, B♭, F); major before minor; octave 4 before octave 5.
- Q: If the Scales subfolder is empty or missing, should the dialog hide the group entirely or show an empty state message? → A: Hide the group entirely — the "Scales" section does not appear if the subfolder is empty or missing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Load Scale Score from Dialog (Priority: P1)

A musician using the app wants to practice scales. They open the load score dialog, navigate to a "Scales" category, select a scale (e.g., C major), and the app loads it for display and playback — just like any other preloaded score.

**Why this priority**: Scale scores are only useful if users can access them through the app. The dialog enhancement is the gateway to all the generated content; without it the scales files are unreachable.

**Independent Test**: Can be fully tested by opening the load score dialog, confirming a "Scales" group/section is visible, selecting any scale score from within it, and verifying the score renders correctly in the viewer.

**Acceptance Scenarios**:

1. **Given** the load score dialog is open, **When** the user views the preloaded score list, **Then** a "Scales" subfolder group is visible alongside existing top-level scores.
2. **Given** the "Scales" subfolder group is visible, **When** the user selects a scale (e.g., "C Major — Octave 4"), **Then** the score loads and renders in the score viewer.
3. **Given** a scale score is loaded, **When** the user triggers playback, **Then** the scale plays back note-by-note correctly.

---

### User Story 2 - Access All Major Scales Across C4 and C5 Starting Octaves (Priority: P2)

A music student wants to practice all 12 major scales. They browse the Scales section and find each major scale as an individual score, available in both C4 (starting at octave 4) and C5 (starting at octave 5) ranges.

**Why this priority**: The scale content is the core value; the dialog improvement (P1) is worthless without the actual scales to show.

**Independent Test**: Can be tested by verifying that 12 major scale files exist in `scores/scales/` for each starting octave (C4 and C5), each playable correctly.

**Acceptance Scenarios**:

1. **Given** the Scales section is open, **When** the user browses major scales, **Then** all 12 major scales (C, D♭, D, E♭, E, F, F#, G, A♭, A, B♭, B) are listed for each of C4 and C5 starting octaves.
2. **Given** a major scale score is selected (e.g., G Major starting at octave 4), **When** the score loads, **Then** it displays 8 ascending notes from G4 to G5 followed by 8 descending notes back to G4, using the correct key signature.
3. **Given** a major scale in octave 5 is selected, **When** the score loads, **Then** it displays 8 ascending notes starting from the root at octave 5.

---

### User Story 3 - Access All Minor Scales Across C4 and C5 Starting Octaves (Priority: P3)

A music student wants to practice minor scales in addition to major ones. They find all 12 natural minor scales available for the same two starting octaves.

**Why this priority**: Minor scales are the natural companion to major scales and complete the full scale library, but major scales alone already deliver core value (P2).

**Independent Test**: Can be tested by verifying that 12 natural minor scale files exist for each starting octave (C4 and C5), each loading and rendering the correct ascending and descending pattern using natural minor intervals.

**Acceptance Scenarios**:

1. **Given** the Scales section is open, **When** the user browses minor scales, **Then** all 12 minor scales are listed for each of C4 and C5 starting octaves.
2. **Given** a minor scale score is selected (e.g., A Minor starting at octave 4), **When** the score loads, **Then** it displays 8 ascending notes followed by 8 descending notes using natural minor intervals (whole, half, whole, whole, half, whole, whole).
3. **Given** minor scale scores use distinct display names, **When** the user browses the list, **Then** each scale name clearly indicates root note, scale type (Natural Minor), and starting octave.

---

### Edge Cases

- What happens when a scale file in `scores/scales/` is malformed or fails to parse? The dialog should skip the broken entry gracefully, not crash the entire scores list.
- What if a user selects a very high-octave scale (e.g., B5 starting octave 5) where notes go above the typical staff range? Each scale file should remain within a musically reasonable range (ascending one octave from root).
- What happens if the Scales subfolder is empty or missing? The Scales group does not appear in the dialog; it is hidden entirely when the group would be empty.
- How should enharmonic equivalents be labelled (e.g., F#/G♭)? Use the conventional major-scale spelling (sharps for sharp keys, flats for flat keys) as per circle-of-fifths convention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST include MusicXML files for all 12 major scales stored in `scores/scales/`, each covering one ascending and one descending octave, in two variants: one starting at octave 4 and one at octave 5 (24 files total for major scales).
- **FR-002**: The system MUST include MusicXML files for all 12 natural minor scales stored in `scores/scales/`, in the same two octave variants (24 files total for minor scales), for a combined total of 48 scale files. Each file uses natural minor intervals (W-H-W-W-H-W-W) with the same ascending and descending pitches.
- **FR-003**: Each scale MusicXML file MUST use the correct key signature for its root note and scale type (major or minor).
- **FR-004**: Each scale score MUST contain exactly one ascending octave run (8 notes, root to root) followed by one descending octave run (8 notes, root back to root).
- **FR-005**: Scale file names MUST follow a consistent, machine-readable convention that encodes root note, scale type, and starting octave (e.g., `C_major_oct4.mxl`, `As_minor_oct5.mxl`).
- **FR-006**: The load score dialog MUST display preloaded scores organised by subfolder group, with scores at the top level shown ungrouped and scores in subfolders shown under a collapsible/expandable group header (toggle); the Scales group is collapsed by default and the user can expand it to reveal the scale score list.
- **FR-007**: The load score dialog MUST render a "Scales" group listing all scale scores from `scores/scales/`, with human-readable display names (e.g., "C Major — Octave 4", "A Minor — Octave 5").
- **FR-008**: Users MUST be able to select and load any scale score from the dialog in the same way as any other preloaded score, resulting in the score being rendered in the score viewer.
- **FR-009**: The subfolder grouping in the dialog MUST support at least one level of nesting (a single subfolder layer); deeper nesting is not required.
- **FR-010**: Each scale MusicXML file MUST use 4/4 time signature with quarter notes, producing 4 bars total: 2 bars of ascending notes (root to octave) and 2 bars of descending notes (octave back to root), 4 notes per bar.
- **FR-011**: Scale scores within the Scales group in the load score dialog MUST be ordered by circle of fifths (C, G, D, A, E, B, F#, D♭, A♭, E♭, B♭, F), with all major scales listed before minor scales, and octave 4 variants listed before octave 5 variants.

### Assumptions

- Each scale spans exactly one octave ascending followed by one octave descending (16 notes total), starting and ending on the root note.
- "C4 and C5 octaves" means scales whose root note begins in octave 4 (e.g., C4, D4, …, B4) and octave 5 (C5, D5, …, B5) respectively.
- Natural minor is used for all minor scales (confirmed: natural minor, not harmonic or melodic).
- Enharmonic equivalents use the conventional major-scale spelling (e.g., B♭ major not A# major).
- The existing preloaded scores (Bach, Beethoven, etc.) remain unchanged and visible in the dialog as before.

### Key Entities

- **Scale Score File**: A MusicXML (`.mxl`) file representing one musical scale. Attributes: root note, scale type (major/minor), starting octave, file path.
- **Score Group**: A named collection of scores originating from the same subfolder. Attributes: group name, ordered list of scale scores.
- **Preloaded Score Catalog**: The full collection of scores available in the app, now structured as a mix of ungrouped top-level scores and grouped subfolder entries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 48 scale MusicXML files (24 major + 24 minor across two octaves) are present in `scores/scales/` and pass MusicXML validity checks.
- **SC-002**: 100% of scale files load and render without errors in the score viewer.
- **SC-003**: Users can select and load any scale score from the dialog in 3 clicks or fewer (open dialog → select group → select score).
- **SC-004**: The load score dialog displays the Scales group alongside existing scores without visual regression to the current preloaded scores section.
- **SC-005**: Each scale score plays back correctly — the correct number of notes (16) in the correct order with the correct pitches — as verified by automated playback tests.

