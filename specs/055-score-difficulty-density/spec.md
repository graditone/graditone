# Feature Specification: Score Difficulty Rate for Note Density

**Feature Branch**: `055-score-difficulty-density`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "Score difficulty rate for note density — Compute the score difficulty rate for note density when loading a score and store it as a score field. Use this field to show an Easy/Medium/Hard tag in the load score dialog."

## Clarifications

### Session 2026-03-25

- Q: How should chord notes be counted for bar density — each pitch separately, or each chord as one onset? → A: Each pitch is counted separately (a 4-note chord = 4 notes).
- Q: Should the difficulty rating be recomputed on every load, or computed once and cached? → A: Compute once on first load; recompute only if the score file changes (re-import or update).
- Q: Is difficulty computation synchronous (before score appears in dialog) or asynchronous (tag fills in later)? → A: Synchronous — difficulty is computed during import/load before the score entry becomes visible in the dialog.
- Q: For multi-instrument scores, how is bar density computed — all instruments pooled, or per-instrument with the hardest rating used? → A: Density is computed per instrument; the score's difficulty rating is the maximum (hardest level) across all instruments.
- Q: What tempo should be used when a bar has no explicit tempo marking? → A: The density formula is tempo-independent (notes per beat, not notes per second), so tempo is not needed for density computation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Difficulty Tag When Choosing a Score (Priority: P1)

A user opens the load score dialog to pick a piece to play or practice. Each score in the list displays an Easy, Medium, or Hard tag so the user can quickly gauge whether the piece matches their skill level before selecting it.

**Why this priority**: This is the primary user-facing benefit of the feature — without the tag being visible in the dialog, the difficulty computation has no value to the user.

**Independent Test**: Can be fully tested by opening the load score dialog and verifying that each available score shows a difficulty tag (Easy/Medium/Hard) alongside its title.

**Acceptance Scenarios**:

1. **Given** a score with low note density has been loaded before, **When** the user opens the load score dialog, **Then** the score shows an "Easy" tag.
2. **Given** a score with moderate note density has been loaded before, **When** the user opens the load score dialog, **Then** the score shows a "Medium" tag.
3. **Given** a score with high note density has been loaded before, **When** the user opens the load score dialog, **Then** the score shows a "Hard" tag.
4. **Given** a score that has never been analyzed, **When** the user opens the load score dialog, **Then** no difficulty tag is shown for that score.

---

### User Story 2 - Difficulty Computed Automatically on Score Load (Priority: P1)

When a user loads a score, the system automatically computes the note-density difficulty rating and stores it with the score metadata. No manual action is required from the user.

**Why this priority**: The difficulty rating is only useful if it is reliably derived from the actual score content. Computing it automatically on load ensures accuracy with no user burden.

**Independent Test**: Can be fully tested by loading a known score and verifying that the stored difficulty rating matches the expected level based on the score's note density.

**Acceptance Scenarios**:

1. **Given** a score is opened for the first time, **When** the score finishes loading, **Then** the difficulty rating is computed synchronously as part of the load pipeline and stored as part of the score's metadata, so the tag is immediately available.
2. **Given** a score's difficulty rating has already been stored, **When** the user opens the load score dialog without reloading the score, **Then** the stored tag is shown immediately without recomputation.
3. **Given** a score contains bars of varying note density, **When** difficulty is computed, **Then** the result reflects both note density and polyphony via a combined formula: `final_score = 0.6 × note_density + 0.4 × polyphony`, where:
   - `note_density = 0.7 × avg(bar_density) + 0.3 × peak(bar_density)`, with `bar_density = pitches_in_bar / bar_duration_beats` (tempo-independent, per-staff max)
   - `polyphony = 0.7 × avg_polyphony + 0.3 × max_polyphony`, where polyphony at time t = number of notes sounding simultaneously (sampled at each note onset, per-staff max)

---

### User Story 3 - Correct Difficulty Level Mapping (Priority: P2)

The computed density score maps predictably to one of three human-readable levels — Easy, Medium, or Hard — using defined thresholds, so that the tag is consistent and trustworthy across all scores.

**Why this priority**: Consistent, correct level assignment is important for user trust; if a simple piece is rated Hard or a demanding piece is rated Easy, the feature loses credibility.

**Independent Test**: Can be fully tested by computing the density score for reference scores with known characteristics and asserting the correct Easy/Medium/Hard level is assigned.

**Acceptance Scenarios**:

1. **Given** a combined difficulty score below 2.5, **When** the level is determined, **Then** it is classified as "Easy" (level 1).
2. **Given** a combined difficulty score between 2.5 and 3.5 (inclusive bounds), **When** the level is determined, **Then** it is classified as "Medium" (level 2).
3. **Given** a combined difficulty score above 3.5, **When** the level is determined, **Then** it is classified as "Hard" (level 3).

---

### Edge Cases

- What happens when a score has only one bar? Peak density equals the average density; the formula still applies normally.
- What happens when a bar contains only rests (zero notes)? Its density is 0 notes/second, which correctly reduces the average.
- What happens when a bar has no explicit tempo? The density formula is tempo-independent (notes per beat), so tempo is not needed for density. Only if the time signature is missing is the bar excluded from computation.
- What happens when a score file is malformed or partially parsed? No difficulty rating is stored; no tag is shown in the dialog for that score.
- What happens with very short pick-up bars (anacrusis)? They are included in the computation as they represent real note density within their actual duration.
- What happens with a multi-instrument score where one instrument is trivial (e.g., a single-note bass line) and another is complex? The score is rated by the hardest instrument's density; the easy instrument does not reduce the overall rating.
- What happens when all bars have zero density (a score of all rests)? The score density rate is 0, which maps to Easy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compute a per-bar note density for each bar in a score, defined as the total number of individual pitches in the bar (each pitch in a chord counts separately, per-staff maximum — hardest single hand) divided by the bar's duration in beats (tempo-independent: `bar_duration_beats = bar_duration_ticks / PPQ`).
- **FR-002**: The system MUST derive a combined difficulty score by computing both note density and polyphony per instrument, then combining them: `final_score = 0.6 × note_density + 0.4 × polyphony`, where `note_density = 0.7 × avg(bar_density) + 0.3 × peak(bar_density)` and `polyphony = 0.7 × avg_polyphony + 0.3 × max_polyphony`.
- **FR-002a**: Polyphony is defined as the number of notes sounding simultaneously at a given time, sampled at each note onset tick within each bar. Per-staff maximum is used (hardest single hand). Average polyphony and maximum polyphony across all bars are combined with weights 0.7 and 0.3 respectively.
- **FR-003**: The system MUST map the combined difficulty score to a difficulty level: below 2.5 → Easy (1); 2.5–3.5 → Medium (2); above 3.5 → Hard (3).
- **FR-004**: The system MUST compute and store the difficulty rating the first time a score is loaded. If a rating is already stored for a score, it MUST NOT be recomputed unless the score is re-imported or its content has changed.
- **FR-005**: The stored difficulty rating MUST be persisted as part of the score's metadata so it is retrievable without re-parsing the score.
- **FR-006**: The load score dialog MUST display the difficulty tag (Easy / Medium / Hard) alongside each score entry for which a rating has been stored.
- **FR-007**: For scores without a stored rating, the load score dialog MUST display no difficulty tag (tag absent, not blank or "Unknown").
- **FR-008**: The density formula is tempo-independent (notes per beat: `pitches_in_bar / (bar_duration_ticks / PPQ)`). BPM is not required for density computation. A bar is only excluded from computation if its time signature is missing and its tick-based duration cannot be determined.
- **FR-009**: Difficulty computation MUST be performed synchronously during the score import or load pipeline, so that the difficulty tag is present the first time the score entry appears in the load score dialog. No deferred or background computation is permitted.
- **FR-010**: For multi-instrument scores, the system MUST compute the density rate independently per instrument track. The score's final difficulty level MUST be the maximum (hardest) level across all instrument tracks.

### Key Entities

- **Score Metadata**: Stores properties associated with a score, extended with the computed difficulty rating (numeric level 1/2/3) and its human-readable label (Easy/Medium/Hard).
- **Bar Density**: A per-bar intermediate value — `pitches_in_bar ÷ bar_duration_beats` — used as input to the note density formula. `pitches_in_bar` is the per-staff maximum count of individual pitches (hardest single hand); rests, tied note continuations, and grace notes are excluded.
- **Bar Polyphony**: A per-bar intermediate value — the average and maximum number of simultaneously sounding notes, sampled at each note onset tick. Per-staff maximum (hardest single hand).
- **Note Density**: The weighted aggregate `0.7 × avg(bar_density) + 0.3 × peak(bar_density)`, computed per instrument track.
- **Polyphony Score**: The weighted aggregate `0.7 × avg_polyphony + 0.3 × max_polyphony`, computed per instrument track.
- **Combined Difficulty Score**: `0.6 × note_density + 0.4 × polyphony_score`. For multi-instrument scores, the score's final difficulty score is the maximum across all tracks.
- **Difficulty Level**: A discrete classification (Easy / Medium / Hard) derived from the combined difficulty score: < 2.5 → Easy, 2.5–3.5 → Medium, > 3.5 → Hard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every score that has been loaded at least once displays its Easy/Medium/Hard tag in the load score dialog without any additional user action.
- **SC-002**: The difficulty tag computed for each pre-loaded reference score (e.g., Fur Elise, Arabesque, Pachelbel Canon, Chopin Nocturne) matches the expected human-perceived difficulty for that piece.
- **SC-003**: The difficulty tag is visible in the load score dialog immediately upon opening — no perceptible delay from re-computation at dialog-open time.
- **SC-004**: Scores for which difficulty cannot be computed (malformed or missing required metadata) display no tag rather than an incorrect or placeholder tag.

## Assumptions

- Bar duration in seconds is derived from the score's tempo (BPM) and time signature. When no explicit tempo is present for a bar, 120 BPM is used as the default. A bar is excluded from computation only if its time signature is also unavailable.
- Note density counts individual pitches — each pitch in a chord is counted separately; rests and tied note continuations are excluded from the count.
- The difficulty thresholds (< 2.5 Easy, 2.5–3.5 Medium, > 3.5 Hard) are fixed as specified and are not user-configurable as part of this feature.
- The score difficulty rating is computed once on first load and persisted. It is recomputed only when the score is re-imported or its content changes; subsequent loads of the same unchanged score use the cached rating.
- The load score dialog is an existing UI component (feature 028-load-score-dialog); this feature extends it with a difficulty tag display only.

