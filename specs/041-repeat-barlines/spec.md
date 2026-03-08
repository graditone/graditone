# Feature Specification: Repetition Bar Lines

**Feature Branch**: `041-repeat-barlines`  
**Created**: 2026-03-08  
**Status**: Draft  
**Input**: User description: "Support repetition bar lines in scores. Understand MusicXML repeat barline notations and support them in score layout and playback. Focused on Burgmuller La Candeur which has start-repeat, end-repeat, and both-sides repeat barlines."

## Clarifications

### Session 2026-03-08

- Q: When playback starts from a position inside a repeat section (not from the beginning), should the end-repeat still fire? → A: Yes — repeat state is always fresh on any playback start; the end-repeat fires once regardless of the entry position.
- Q: When a previously saved score (stored before this feature shipped) is loaded and contains no repeat barline data, what should happen? → A: Treat absence of repeat data as no repeat barlines — the score loads and plays normally without any jumps.
- Q: How many measures does the full playback of La Candeur produce when all repeats are included? → A: 39 sounded measures (23 raw; measures 1–8 repeated once adding 8, measures 9–16 repeated once adding 8; measures 17–23 played straight).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Playback Follows Repeat Sections (Priority: P1)

A user opens Burgmuller La Candeur and presses play. The score contains repeat sections — the playback automatically follows standard repetition rules: each repeated section is played twice (once on the first pass, once after jumping back to the repeat start), then playback continues forward.

**Why this priority**: This is the core user-visible value of the feature. Without correct playback the score sounds incomplete — musical content is either missing or duplicated incorrectly. It directly impacts the listening and practice experience.

**Independent Test**: Can be fully tested by playing La Candeur from start to finish and verifying that the total sounding duration matches the expected musical duration including all repeats, and that the correct note sequences occur in the correct order.

**Acceptance Scenarios**:

1. **Given** La Candeur is loaded and playback starts from the beginning, **When** the playback cursor reaches an end-repeat barline for the first time, **Then** playback jumps back to the nearest preceding start-repeat barline and continues from there.
2. **Given** playback has already executed the jump once for a given repeat section, **When** the playback cursor reaches the same end-repeat barline a second time, **Then** playback continues forward past the barline without jumping again.
3. **Given** a score with no start-repeat barline before an end-repeat barline, **When** the playback cursor reaches that end-repeat barline for the first time, **Then** playback jumps back to the very beginning of the score.
4. **Given** a both-sides repeat barline (closing one section and opening the next), **When** playback passes through it for the first time, **Then** it acts as an end-repeat for the preceding section and as a start-repeat for the following section.

---

### User Story 2 - Repeat Barlines Rendered in Score (Priority: P2)

A user opens a score with repeat sections and sees the repeat barlines rendered visually in the correct positions, clearly distinguishable from regular barlines.

**Why this priority**: Visual accuracy is expected for a music score viewer. Without correct rendering users cannot correlate what they hear with what they see on the page, which impairs practice use.

**Independent Test**: Can be fully tested by loading La Candeur and visually inspecting that all three repeat barline types appear at the correct measure boundaries with the standard music notation appearance (thick bar + dots).

**Acceptance Scenarios**:

1. **Given** a score containing a start-repeat barline, **When** the score is displayed, **Then** a visual indicator (thick bar on the left, two dots on the right) appears at that measure boundary.
2. **Given** a score containing an end-repeat barline, **When** the score is displayed, **Then** a visual indicator (two dots on the left, thick bar on the right) appears at that measure boundary.
3. **Given** a both-sides repeat barline, **When** the score is displayed, **Then** a combined visual indicator (dots — thick bar — dots) appears at that measure boundary.
4. **Given** any repeat barline, **When** displayed, **Then** it replaces the plain thin barline at that position rather than being drawn on top of a separate barline.

---

### User Story 3 - MusicXML Repeat Barlines Imported (Priority: P3)

A developer or the system imports La Candeur (or any compatible MusicXML file) and the repeat barline information is correctly extracted from the file and stored in the internal score model.

**Why this priority**: Import is the foundational data step enabling both playback and rendering. It can be tested in isolation by inspecting the parsed score model, making it independently verifiable before the other stories are complete.

**Independent Test**: Can be fully tested by importing La Candeur's MusicXML file and asserting that the parsed score model contains start-repeat, end-repeat, and both-sides repeat markers at the exact expected measure positions.

**Acceptance Scenarios**:

1. **Given** a MusicXML file with a forward-direction repeat barline element, **When** the file is imported, **Then** the score model contains a start-repeat marker at the corresponding measure boundary.
2. **Given** a MusicXML file with a backward-direction repeat barline element, **When** the file is imported, **Then** the score model contains an end-repeat marker at the corresponding measure boundary.
3. **Given** a MusicXML file where a measure boundary has both forward and backward repeat barline elements, **When** the file is imported, **Then** the score model contains a both-sides repeat marker at that boundary.
4. **Given** a MusicXML file with no repeat barlines, **When** the file is imported, **Then** the score model contains no repeat markers and all existing import behaviour is unchanged.

### Edge Cases

- What happens when there is no preceding start-repeat barline before an end-repeat? Playback jumps to the score beginning.
- What happens when the same end-repeat barline is reached more than once during a single playback session? It fires only the first time; on all subsequent encounters it is skipped and playback continues forward.
- What happens if a MusicXML file has malformed or unrecognised repeat barline attributes? The barline is silently treated as a plain barline; no crash or data loss occurs.
- What happens with nested repeats (a repeat section inside another repeat section)? Out of scope; behaviour is undefined and not handled.
- What happens with volta brackets (1st/2nd ending markings)? Out of scope for this feature.
- What happens when playback starts from a position inside a repeat section (e.g., user seeks to measure 5 and the repeat section starts at measure 3)? Repeat state is always fresh on any playback start; the end-repeat barline will still fire once and redirect back to the nearest start-repeat marker as normal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The MusicXML importer MUST parse forward-direction repeat barline elements and record them as start-repeat markers at the corresponding measure boundary in the score model.
- **FR-002**: The MusicXML importer MUST parse backward-direction repeat barline elements and record them as end-repeat markers at the corresponding measure boundary in the score model.
- **FR-003**: The MusicXML importer MUST recognise when a measure boundary carries both a forward and a backward repeat element and record it as a both-sides repeat marker.
- **FR-004**: The score layout engine MUST render start-repeat barlines using standard music notation: thick bar on the measure-start side, two dots on the interior side.
- **FR-005**: The score layout engine MUST render end-repeat barlines using standard music notation: two dots on the interior side, thick bar on the measure-end side.
- **FR-006**: The score layout engine MUST render both-sides repeat barlines using standard music notation: dots — thick bar — dots.
- **FR-007**: Repeat barlines MUST replace the regular thin barline at their position; the thin barline MUST NOT also be drawn at the same boundary.
- **FR-008**: The playback engine MUST, upon reaching an end-repeat marker for the first time during a playback session, redirect playback to the position of the nearest preceding start-repeat marker.
- **FR-009**: When no start-repeat marker precedes an end-repeat marker, the playback engine MUST redirect to the very beginning of the score.
- **FR-010**: Each end-repeat marker MUST be triggered at most once per full playback session; subsequent encounters MUST be skipped and playback MUST continue forward.
- **FR-011**: A both-sides repeat marker MUST act as an end-repeat for the section closing at that boundary and as a start-repeat for the section opening at that boundary.
- **FR-012**: Scores that contain no repeat barlines MUST produce identical playback output and visual rendering before and after this feature is introduced.
- **FR-013**: Repeat state MUST be initialised as fresh (no end-repeats pre-fired) whenever playback starts or resumes, regardless of the entry position in the score.

### Key Entities

- **RepeatBarline**: Represents a repeat barline on a measure boundary. Carries a type (start-repeat, end-repeat, or both-sides) and a position (the measure boundary it belongs to). Part of the persistent score model.
- **Measure Boundary**: The logical dividing point between two adjacent measures (or before the first / after the last measure). A boundary can carry at most one RepeatBarline in addition to the standard barline.
- **Playback Repeat State**: Runtime state tracking which end-repeat markers have already been executed in the current playback session. Used to enforce the "trigger at most once" rule. Resets when playback is restarted from the beginning.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When La Candeur is played from start to finish, the total number of measures sounded is exactly 39 (23 raw measures in the file; measures 1–8 play twice, measures 9–16 play twice, measures 17–23 play once). The correct note sequence must occur in the correct order.
- **SC-002**: All three repeat barline types present in La Candeur (start-repeat, end-repeat, both-sides) are visually distinct from each other and from regular barlines; a user familiar with music notation can identify each type at a glance.
- **SC-003**: Importing La Candeur's MusicXML file produces a score model where every repeat barline is recorded at the correct measure boundary with the correct type — no repeat markers are missing or misplaced.
- **SC-004**: Every pre-existing score (without repeat barlines) plays back and renders identically after this feature is introduced — zero regressions.

## Assumptions

- The Burgmuller La Candeur MusicXML file (`Burgmuller_LaCandeur.mxl`) is the primary reference and validation target for this feature.
- Each repeat section is played exactly twice per playback session (first pass + one repetition); repeat counts greater than one are not required.
- Volta brackets (1st/2nd endings) are out of scope.
- Nested overlapping repeat sections are out of scope.
- The MusicXML input follows the standard `<barline location="..."><repeat direction="..."/></barline>` schema.
- Previously saved scores that contain no repeat barline data (stored before this feature was introduced) are treated as having no repeat markers; no migration or re-import is required.

## Known Issues & Regression Tests *(if applicable)*

*This section is empty initially and will grow as issues are discovered during implementation.*

