# Feature Specification: Score Phrase Detection

**Feature Branch**: `062-score-phrase-detection`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: User description: "Identify phrases in a score. The goal is to define the phrases in a score and to visualize them in the score viewer pressing a Phrases button in the toolbar. We will use the phrases later to practice with them as region, so the practice has musicality. During the research, explore algorithms to detect the phrases."

## Clarifications

### Session 2026-03-29

- Q: Which visualization style should phrases use (color bands, bracket arcs, or border bars)? → A: Semi-transparent color bands behind the measures (alternating 2 colors), with phrase label at the start.
- Q: Where should phrase detection execute (frontend, backend, or hybrid)? → A: Backend — detect phrases during/after MusicXML import, store results in the Score data model, serve to frontend.
- Q: Should tapping a phrase auto-open the practice view or just pre-set the region? → A: Only pre-set the loop region. Phrases can be played in the play view or practiced in the practice view; the user chooses which view to use.
- Q: What is the primary signal for phrase detection — slur chains or structural markers? → A: Slur chains are the primary signal when present (they represent the composer's actual phrasing). Structural markers (repeats, key/time changes) act as hard boundaries that override slurs.
- Q: For multi-staff instruments (piano), detect phrases per-staff or per-instrument? → A: Per-instrument — detect phrases once using the primary staff's signals and apply to all staves of that instrument.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Detected Phrases on Score (Priority: P1)

A musician opens a score in the score viewer and wants to see the natural musical phrases identified in the piece. They press a "Phrases" toggle button in the toolbar. The system analyzes the score and visually highlights each detected phrase with a distinct color band or bracket over the relevant measures. The musician can see at a glance how the piece is structured into musical phrases, helping them understand the musical form before practicing.

**Why this priority**: This is the core value proposition — without phrase detection and visualization, no other phrase-related features can exist. It delivers immediate understanding of musical structure.

**Independent Test**: Can be fully tested by loading any preloaded score (e.g., Burgmuller Arabesque), pressing the Phrases button, and verifying that colored phrase regions appear overlaid on the score notation.

**Acceptance Scenarios**:

1. **Given** a score is loaded in the viewer, **When** the user presses the "Phrases" button in the toolbar, **Then** the system detects phrases and displays them as visually distinct regions (e.g., alternating color bands or brackets) overlaid on the score.
2. **Given** phrases are displayed, **When** the user presses the "Phrases" button again, **Then** the phrase visualization is hidden and the score returns to its normal appearance.
3. **Given** a score is loaded, **When** the user presses "Phrases," **Then** each phrase is labeled with a sequential identifier (e.g., "Phrase 1," "Phrase 2") visible on or near the score.
4. **Given** a score with repeat barlines or volta brackets, **When** phrases are detected, **Then** repeat boundaries are respected as natural phrase boundaries.

---

### User Story 2 - Select a Phrase as a Practice Region (Priority: P2)

A musician has phrase visualization enabled and wants to practice a specific phrase. They tap or click on a highlighted phrase region in the score. The system sets that phrase as the active practice loop region, so playback and practice will be constrained to that phrase's measure range. This lets the musician practice musically meaningful sections rather than arbitrary measure selections.

**Why this priority**: This connects phrase detection to the existing practice workflow, delivering the core goal of "practice with musicality." It builds directly on P1's phrase regions and the existing practice loop infrastructure.

**Independent Test**: Can be tested by enabling phrases, tapping on a phrase, and verifying the practice loop region boundaries match the selected phrase's start and end measures.

**Acceptance Scenarios**:

1. **Given** phrase visualization is active, **When** the user taps on a phrase region, **Then** that phrase's measure range is set as the active loop region (start and end ticks), usable in both play and practice views.
2. **Given** a phrase is selected as a loop region, **When** the user starts playback in the play view, **Then** playback loops within the selected phrase boundaries.
3. **Given** a phrase is selected as a loop region, **When** the user opens the practice view, **Then** practice is constrained to the selected phrase boundaries.
4. **Given** a phrase is selected, **When** the user taps a different phrase, **Then** the loop region updates to the newly selected phrase.

---

### User Story 3 - Navigate Between Phrases (Priority: P3)

A musician is studying a score and wants to step through it phrase by phrase. With phrase visualization active, they use "Previous Phrase" and "Next Phrase" navigation controls to jump the viewport and/or playback cursor to the beginning of the adjacent phrase. This allows sequential study of the piece's structure.

**Why this priority**: This is a convenience feature that enhances the phrase exploration experience but is not strictly required for the primary detect-and-practice workflow.

**Independent Test**: Can be tested by enabling phrases, using next/previous controls, and verifying the score viewport scrolls to the start of each successive phrase.

**Acceptance Scenarios**:

1. **Given** phrase visualization is active, **When** the user presses "Next Phrase," **Then** the score viewport scrolls to show the beginning of the next phrase and the cursor moves to its first beat.
2. **Given** the user is viewing the last phrase, **When** they press "Next Phrase," **Then** navigation wraps to the first phrase.
3. **Given** the user is viewing the first phrase, **When** they press "Previous Phrase," **Then** navigation wraps to the last phrase.

---

### Edge Cases

- What happens when a score has no detectable phrases (e.g., a single-measure score or a scale exercise)? The system treats the entire score as a single phrase (consistent with FR-011).
- What happens when a score has very long phrases (e.g., 16+ measures)? Phrases should still be displayed correctly, with the visualization scaling to accommodate them.
- What happens when the score has only one voice vs. multiple voices? Phrase detection should use the primary voice (voice 1) by default. If multiple staves exist, phrases should be detected per instrument.
- What happens with pickup measures (anacrusis)? A pickup measure should be included as part of the first phrase rather than treated as a separate phrase.
- What happens when slur annotations in the score conflict with structural boundaries (e.g., a slur spans across a repeat barline)? Structural boundaries (repeats, key/time changes) take precedence over slur chains for phrase boundary detection.
- What happens when the user toggles phrases on/off rapidly? The system should debounce the toggle and not re-run detection if the results are already cached.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST analyze a score during import and identify phrase boundaries as contiguous ranges of measures, storing them in the Score data model so they are available to the frontend without a separate detection pass.
- **FR-002**: System MUST provide a "Phrases" toggle button in the score viewer toolbar that enables/disables phrase visualization.
- **FR-003**: System MUST visually overlay detected phrases on the score as semi-transparent color bands behind the measures, alternating between two distinct colors for adjacent phrases, so they are easily distinguishable.
- **FR-004**: System MUST label each phrase with a sequential identifier (e.g., "Phrase 1," "Phrase 2") displayed at the start of each phrase's color band, visible in the score when phrase visualization is active.
- **FR-005**: System MUST detect phrase boundaries using a combination of heuristics where slur chains are the primary signal when present (representing the composer's intended phrasing), and structural markers act as hard boundaries that override slurs:
  1. **Structural markers (hard boundaries)**: Repeat barlines, volta brackets, key signature changes, and time signature changes always force a phrase boundary, even if a slur spans across them. *(Note: double barlines are out of scope for v1 — the domain model does not currently track barline styles.)*
  2. **Slur chains (primary signal)**: Connected slur annotations in the score data define phrase groupings within structural sections. When slurs are present, they are the primary determinant of phrase extent.
  3. **Rest patterns**: Rests across all active voices at the same position serve as natural breathing points and secondary phrase boundary indicators. *(Note: fermata detection is out of scope for v1 — the domain model does not currently track fermata annotations.)*
  4. **Regular grouping (fallback)**: When no slurs, structural markers, or rest patterns are available, group measures into phrases of typical length (4 or 8 measures, depending on time signature).
- **FR-006**: System MUST cache phrase detection results for a given score so that toggling the visualization on/off does not re-run the analysis.
- **FR-007**: System MUST allow the user to select a detected phrase by tapping/clicking on its color band region and set it as the active loop region. The selected phrase region is usable in both the play view (playback loops within the phrase) and the practice view (practice is constrained to the phrase).
- **FR-008**: When a phrase is selected as a loop region, the system MUST set the loop start tick to the first beat of the phrase's first measure and the loop end tick to the last beat of the phrase's last measure. The system MUST NOT automatically switch views; the user decides whether to play or practice.
- **FR-009**: System MUST provide "Next Phrase" and "Previous Phrase" navigation controls when phrase visualization is active.
- **FR-010**: System MUST detect phrases per instrument (not per staff). For multi-staff instruments such as piano, phrases are detected once using the primary staff's signals (typically the treble/right-hand staff which carries melodic slurs) and the same phrase boundaries apply to all staves of that instrument.
- **FR-011**: System MUST handle scores where no distinct phrases can be detected by treating the entire score as a single phrase.

### Phrase Detection Heuristic Details

The phrase detection algorithm applies the following signals. **Slur chains are the primary phrasing signal** when present (they represent the composer's actual phrasing marks). **Structural markers are hard boundaries** that always force a phrase break, even mid-slur. Within structural sections, slurs drive the phrasing.

1. **Structural markers** (hard boundaries — always override other signals):
   - Repeat barlines (start/end/both) always create a phrase boundary at that measure.
   - Volta bracket start/end positions create phrase boundaries.
   - Key signature changes create phrase boundaries.
   - Time signature changes create phrase boundaries.
   - These boundaries cannot be overridden by slurs or rest patterns.
   - *(v1 scope note: double barlines are excluded — the domain model tracks RepeatBarline types only, not visual barline styles.)*

2. **Slur chains** (primary signal within structural sections):
   - Walk the `slur_next` chain from each slur-start note until the chain ends.
   - A slur chain spanning multiple measures defines those measures as a single phrase.
   - When multiple overlapping slur chains exist, the longest chain determines the phrase extent.
   - Slurs are the most reliable indicator of the composer's intended phrasing in classical scores.

3. **Rest patterns** (medium confidence):
   - A rest that appears in all active voices at the same beat position suggests a phrase boundary immediately before the rest.
   - *(v1 scope note: fermata and long-note detection excluded — the domain model does not currently track fermata annotations. This can be added in a future iteration when fermata support is added to the importer.)*

4. **Regular grouping fallback** (lowest confidence):
   - When none of the above signals are present, group measures into phrases of 4 measures (for 4/4, 3/4 time) or 8 measures (for 2/4, 6/8 time).
   - Align phrase boundaries to measure boundaries.

### Key Entities

- **Phrase**: A contiguous region of a score representing a musically coherent unit. Defined by a start measure index, end measure index (inclusive), a sequential label, and the instrument it belongs to. For multi-staff instruments (piano), the same phrase boundaries apply to all staves. Mapped to tick ranges via the existing `measure_end_ticks` array.
- **Phrase Set**: The complete collection of detected phrases for a given score and instrument. Cached after first detection.
- **Phrase Boundary**: A point between two adjacent phrases, defined by a measure index. Determined by one or more detection heuristic signals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view detected phrases on any preloaded score within 2 seconds of pressing the "Phrases" button.
- **SC-002**: At least 80% of detected phrase boundaries in the preloaded classical scores (Bach Invention, Beethoven Fur Elise, Burgmuller Arabesque, Chopin Nocturne) align with musically reasonable boundaries as judged by a musician.
- **SC-003**: Users can select a phrase and begin practicing it within 3 taps/clicks from the score viewer.
- **SC-004**: Phrase detection produces at least 2 phrases for any score longer than 8 measures.
- **SC-005**: Toggling phrase visualization on/off after initial detection completes instantly (no perceptible delay) due to caching.
- **SC-006**: Phrase navigation (next/previous) moves the viewport to the correct phrase within 1 second.

## Assumptions

- Phrase detection operates on the score's notated structure (measures, slurs, repeats) rather than on audio analysis. This is a rule-based heuristic approach, not a machine-learning approach.
- The 960 PPQ tick resolution used throughout the system provides sufficient granularity for phrase boundary placement at measure boundaries.
- Phrases are always aligned to measure boundaries (a phrase starts at the beginning of a measure and ends at the end of a measure). Sub-measure phrase boundaries are not supported in this initial version.
- The phrase detection runs in the backend during or after MusicXML import. The detected phrases are stored in the Score data model and served to the frontend alongside the existing score data.
- Users can override phrase detection manually in a future iteration; this spec covers only automatic detection.
- The existing practice loop mechanism (start tick / end tick) can be reused to constrain playback to a selected phrase.

