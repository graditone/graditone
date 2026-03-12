# Feature Specification: Volta Bracket Playback (Repeat Endings)

**Feature Branch**: `047-repeat-volta-playback`  
**Created**: 2026-03-12  
**Status**: Draft  
**Input**: User description: "implement measure jumps after repetition — A measure with the label 1 over it and which is the last one from a repetition it must be jumped when the repeat measures region playback is repeated."

## Background

Feature 041 (Repeat Barlines) implemented playback jumps at end-repeat barlines and explicitly deferred volta bracket (first/second ending) support. This feature builds on that foundation.

A **volta bracket** is the horizontal bracket printed above one or more measures, labelled "1." or "2.", that indicates alternate endings for a repeated section:

- **First ending (1.)**: played on the first pass through the repeated section; skipped (jumped over) on the second pass.
- **Second ending (2.)**: skipped on the first pass; played on the second pass after the jump-back.

Scores with volta brackets in the repository: `Burgmuller_Arabesque.mxl`, `Beethoven_FurElise.mxl`, and `Burgmuller_LaCandeur.mxl`. These provide concrete reference material for all scenarios.

## Clarifications

### Session 2026-03-12

- Q: Should `VoltaBracket` store tick positions (`start_tick`/`end_tick`) alongside measure indices, or should the playback engine derive ticks from measure data at runtime? → A: Store ticks directly in `VoltaBracket`, mirroring the `RepeatBarline` pattern.
- Q: What is the canonical expected sounded measure count for La Candeur once volta bracket logic is applied? → A: 38 sounded measures (the first-ending measure 16 is now heard only once).
- Q: When first-ending measures are skipped on the second pass, what happens to the note highlight cursor? → A: The highlight skips forward with the playback cursor; no highlight appears in first-ending measures on the second pass because those notes are never sounded (natural consequence, no extra visual logic required).
- Q: How should a pre-feature saved score (with no `volta_brackets` field) be deserialized? → A: The missing field defaults to an empty list; no migration step is required (serde `default` / optional field).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Playback Skips First Ending on Repeat (Priority: P1)

A user opens a score that has a repeated section with a first-ending bracket and presses play. On the first pass the bracket measures sound normally. When playback jumps back for the repeat, the first-ending measures are silently skipped and playback resumes at the correct measure immediately after the skipped bracket.

**Why this priority**: This is the core playback correctness requirement. Without it, the first-ending measures are heard twice (or the jump never happens at the right time), which contradicts standard music notation and produces an incorrect musical result. It is directly observable by the user.

**Independent Test**: Can be fully tested by playing Burgmuller La Candeur from start to finish and verifying that measure 16 (which carries the "1." bracket) is heard exactly once — only on the first pass — and that playback continues correctly on the second pass without replaying that measure.

**Acceptance Scenarios**:

1. **Given** a score with a first-ending bracket over one or more measures, **When** playback reaches the end-repeat barline at the close of the first ending for the first time, **Then** playback jumps back to the nearest preceding start-repeat barline exactly as in Feature 041.
2. **Given** playback has already executed the repeat jump once for a given section, **When** playback reaches the first measure of the first-ending bracket on the second pass, **Then** all first-ending measures are skipped and playback jumps directly to the measure immediately following the last first-ending measure (i.e., the second-ending measure or the first measure after the repeat region).
3. **Given** a score where the first-ending bracket spans multiple consecutive measures, **When** playback is on its second pass through the repeated section, **Then** all measures under the first-ending bracket are skipped as a single block.
4. **Given** playback starts from any position inside the repeat region (not from the beginning), **When** the end-repeat barline is encountered, **Then** repeat state is fresh: the first-ending bracket measures are played normally and the jump-back fires once, as if it were the first pass.

---

### User Story 2 - Second Ending Plays Correctly After Jump (Priority: P2)

A user opens a score that has both a first-ending and a second-ending bracket for the same repeated section. On the second pass through the section, playback skips the first-ending measures and plays the second-ending measures instead, then continues forward past the repeat region.

**Why this priority**: Many pieces (including Burgmuller Arabesque and Beethoven Für Elise in the repository) have both first and second endings. Correct second-ending playback is necessary for these scores to sound right. It depends on first-ending skip being implemented, making it a natural P2.

**Independent Test**: Can be fully tested by playing Burgmuller Arabesque from the beginning of its first repeated section and verifying that the second-ending measure (measure 11) is played on the second pass instead of the first-ending measure (measure 10), and that playback then continues past the repeat region.

**Acceptance Scenarios**:

1. **Given** a score has a second-ending bracket immediately following the end of a first-ending bracket, **When** playback is on the second pass and skips the first-ending measures, **Then** playback resumes at the first measure of the second-ending bracket.
2. **Given** playback is inside a second-ending bracket, **When** the end of the second-ending bracket is reached and there is no further end-repeat barline, **Then** playback continues forward normally past the repeat region.
3. **Given** a second-ending bracket that ends with a `discontinue` marker (open bracket at the right, as in Arabesque measure 28), **When** playback reaches the end of that bracket, **Then** playback continues forward without any additional jump.

---

### User Story 3 - Volta Brackets Rendered Visually (Priority: P3)

A user opens a score with volta brackets and sees the bracket lines and number labels ("1." and "2.") rendered above the correct measures on the staff, distinguishable from other annotations.

**Why this priority**: Visual accuracy is expected for a score viewer. Users correlate what they hear with what they see; missing brackets make the notation incomplete and confusing. It depends on volta data being parsed (FR-001 to FR-003) and is therefore lower priority than correct playback.

**Independent Test**: Can be fully tested by loading Burgmuller Arabesque and visually confirming that the "1." bracket appears over measure 10 and the "2." bracket appears over measure 11 at both repeat sections, with correct left-closed/right-closed or left-closed/right-open appearance.

**Acceptance Scenarios**:

1. **Given** a score containing a first-ending bracket, **When** the score is displayed, **Then** a horizontal bracket line with the label "1." appears above the measures it covers, with a closed right end when the bracket ends before the end-repeat barline.
2. **Given** a score containing a second-ending bracket that ends with a `stop` marker, **When** the score is displayed, **Then** the bracket has both a closed left end and a closed right end.
3. **Given** a second-ending bracket that ends with a `discontinue` marker, **When** the score is displayed, **Then** the bracket has a closed left end and an open right end (no closing vertical stroke).

---

### User Story 4 - MusicXML Ending Elements Imported (Priority: P4)

The system imports a MusicXML file and correctly extracts volta bracket data from `<ending>` elements, storing it in the score model alongside the existing repeat barline data.

**Why this priority**: Import is the foundational data step. Playback and rendering both depend on it, but it can be validated in isolation by inspecting the parsed model, making it independently verifiable first.

**Independent Test**: Can be fully tested by importing Burgmuller La Candeur and asserting that the parsed score model contains a first-ending bracket starting at measure 16 with the correct start and stop positions.

**Acceptance Scenarios**:

1. **Given** a MusicXML file where a barline contains `<ending number="1" type="start">`, **When** the file is imported, **Then** the score model records the start of a first-ending volta bracket at the corresponding measure index.
2. **Given** a MusicXML file where a barline contains `<ending number="1" type="stop">`, **When** the file is imported, **Then** the score model records the closed end of that first-ending bracket at the corresponding measure boundary.
3. **Given** a MusicXML file where a barline contains `<ending number="2" type="start">` and `<ending number="2" type="discontinue">`, **When** the file is imported, **Then** the score model records a second-ending bracket with a closed start and an open (discontinue) end.
4. **Given** a MusicXML file with no `<ending>` elements, **When** imported, **Then** the score model contains no volta brackets and all existing behaviour is unchanged.

---

### Edge Cases

- What happens to the note highlight when first-ending measures are skipped? The playback cursor jumps forward instantly; since no notes are sounded in the skipped measures, no note highlight appears there on the second pass. No additional highlight logic is required.
- What happens if a first-ending bracket has no matching second-ending bracket (as in La Candeur)? On the second pass, playback skips the first-ending measures and jumps to the first measure after the end-repeat barline position, continuing forward normally.
- What happens when a volta bracket spans multiple measures? All measures under the bracket are treated as a single unit — either all played or all skipped together.
- What happens when playback is started from a position inside a first-ending bracket? Repeat state is fresh; the first-ending measures play normally and the end-repeat fires once.
- What happens when a volta bracket `number` attribute is a value other than "1" or "2" (e.g., "3")? The bracket is treated as a subsequent ending and is played only on the corresponding pass. Out of scope for this feature — brackets numbered above 2 may be parsed but are not required to be handled by playback logic.
- What happens if the MusicXML `<ending>` element is missing a `type` attribute? The element is silently ignored; no crash or data loss occurs.
- What happens when the user seeks playback to a position after the first-ending bracket but before the end-repeat? Repeat state is fresh; the end-repeat will fire once at the normal position.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MusicXML importer MUST parse `<ending>` elements at barline locations and record them as volta bracket markers in the score model, preserving the `number` (1 or 2), `type` (start / stop / discontinue), and associated measure index.
- **FR-002**: The score model MUST store volta brackets as an ordered collection of bracket regions, each identified by ending number, start measure index, end measure index, start tick (inclusive), end tick (exclusive), and whether the right end is closed (stop) or open (discontinue).
- **FR-003**: When importing a score that has no `<ending>` elements, the score model MUST contain an empty volta bracket collection and all existing playback and display behaviour MUST remain unchanged.
- **FR-004**: During playback, when the playback cursor enters a set of measures covered by a first-ending (number=1) bracket and the current pass through the repeat region is the second pass (i.e., the end-repeat for that region has already fired once), the playback engine MUST skip all first-ending measures and advance directly to the first measure after the last first-ending measure.
- **FR-005**: During playback, after skipping first-ending measures on the second pass, if a second-ending (number=2) bracket begins at exactly the measure the playback engine jumps to, playback MUST continue through that bracket normally.
- **FR-006**: After playback completes a second-ending bracket that ends with a `stop` or `discontinue` marker, the playback engine MUST continue forward past the bracket without any additional jump.
- **FR-007**: The repeat pass counter for any given repeat region MUST be reset to zero whenever playback is stopped and restarted, regardless of where the new start position is, so that volta bracket logic always begins fresh.
- **FR-008**: The layout and rendering layer MUST display a volta bracket as a horizontal line above the measures it covers, with the assigned number label ("1." or "2.") at the left side, a closing vertical stroke at the right end for `stop` type, and no closing stroke for `discontinue` type.
- **FR-009**: Previously saved scores that pre-date this feature and contain no `volta_brackets` field MUST deserialize with an empty volta bracket list (via a `default`/optional-field mechanism); no migration step is required, and those scores MUST load and play correctly with no volta bracket logic applied.

### Key Entities

- **VoltaBracket**: Represents one bracket region in the score. Attributes: ending number (1 or 2), start measure index (0-based), end measure index (0-based, inclusive), start tick (inclusive), end tick (exclusive), right-end type (closed/open). Tick fields mirror the `RepeatBarline` pattern so the playback engine can resolve positions without a runtime lookup. Belongs to a score alongside the existing `repeat_barlines` collection.
- **RepeatRegion** (logical concept for playback): A pairing of a start-repeat position and an end-repeat position. Each region tracks how many times its end-repeat barline has been traversed during the current playback session, enabling the playback engine to determine which pass is active.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When Burgmuller La Candeur is played from start to finish, measure 16 (the first-ending measure) is heard exactly once — on the first pass — and the total sounding measure count is **38 measures** (23 raw measures; measures 1–15 repeated once adding 15, measure 16 skipped on second pass, measures 17–23 played straight).
- **SC-002**: When Burgmuller Arabesque is played from start to finish, each first-ending measure is heard exactly once and each corresponding second-ending measure is also heard exactly once, for both repeat sections in the piece.
- **SC-003**: When Beethoven Für Elise is played from start to finish, playback navigates all volta brackets correctly without any measure being replayed or omitted unexpectedly.
- **SC-004**: A score with no volta brackets continues to play back identically to its behaviour before this feature, with zero change in sounding note sequence or timing.
- **SC-005**: Volta bracket visuals (bracket line and number label) are present and correctly positioned for all three reference scores when displayed.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will be populated during implementation when bugs or regressions are discovered.

