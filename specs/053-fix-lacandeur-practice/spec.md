# Feature Specification: Fix Practice Issues in La Candeur

**Feature Branch**: `053-fix-lacandeur-practice`  
**Created**: 2026-03-23  
**Status**: Draft  
**Input**: User description: "Fix practice issues in La Candeur: With both hands, LH chord is not green during all duration (it is in LH only mode). M3-M4 chords duration is only M3 duration. When a system changes to a new line, the green dot is shown but removed. M15 it was expecting only a G4 RH but LH 1/2 notes are always present. M17 in the second RH 1/2 rest, it is accepted that it is pressed. Is it accepted in general to play more notes if you play the valid ones? During practice you must not have the possibility of change the position. If you Stop the practice, the partial results should be shown."

## Clarifications

### Session 2026-03-23

- Q: What is the extra-notes policy when the player presses more keys than required? → A: Semi-strict — extra notes pressed during a rest count as a mistake; extra notes pressed alongside all correct notes are silently ignored and the player still gets credit.
- Q: Should fixes apply only to La Candeur or to all scores in the app? → A: All scores — these are practice engine bugs; fixes apply engine-wide and regression tests must cover at least one score beyond La Candeur.
- Q: Does the practice session have a pause state, or only running and stopped? → A: No pause — only two states: running and stopped. Stopping ends the session and shows partial results.
- Q: When one hand has a rest, does pressing a key with the resting hand count as a mistake even if the other hand is actively playing? → A: Hand-specific — each hand's rest is evaluated independently; pressing any key with the resting hand is a mistake regardless of what the other hand is doing.
- Q: What information does the partial results summary show when the player stops early? → A: Score % + measures reached — percentage of notes correctly played and which measure was reached out of the total (e.g., "M12 of 32").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Note Highlighting Correctness in Both-Hands Mode (Priority: P1)

A student practicing La Candeur in both-hands mode expects played notes and chords to turn green for their full rhythmic duration, just as they do when practicing left-hand only. Currently, LH chord notes do not stay green for their full duration during both-hands practice, breaking visual feedback of correct timing.

**Why this priority**: Visual feedback of held notes is the core confirmation mechanism in practice mode. Incorrect highlighting gives false signals about performance quality, directly undermining the practice goal.

**Independent Test**: Open La Candeur in both-hands practice mode and play a LH chord. Verify the chord turns green and remains green for the full note duration, matching what happens in LH-only mode.

**Acceptance Scenarios**:

1. **Given** both-hands practice mode is active, **When** the player correctly plays a LH chord, **Then** all notes of the chord turn green and remain green for the full notated duration.
2. **Given** LH-only practice mode is active, **When** the player correctly plays a LH chord, **Then** the chord stays green for the same duration as in both-hands mode, confirming consistent behavior.
3. **Given** both-hands mode, **When** the player releases a LH chord note before its notated duration ends, **Then** the green indicator ends at release (not earlier due to a bug).

---

### User Story 2 - Chord Duration Detection for Multi-Measure Chords (Priority: P1)

A student plays tied or sustained chords that span measures M3–M4. The system must evaluate the chord's full natural duration (across both measures) rather than treating it as ending at the barline of M3.

**Why this priority**: Incorrect duration evaluation causes the system to advance prematurely or count notes as missed too early, degrading score accuracy and trust in the practice feedback.

**Independent Test**: Play La Candeur in practice mode reaching M3–M4. Hold the chords as written. Verify the system advances to M5 only after the chord's full written duration has elapsed, not immediately at the M3 barline.

**Acceptance Scenarios**:

1. **Given** practice is at M3, **When** the player holds a chord that spans M3–M4, **Then** the system keeps the chord highlighted as active until the full M4 duration is complete.
2. **Given** practice is at M3, **When** the player releases the chord at the M3 barline prematurely, **Then** the system correctly registers the note as incomplete rather than advancing.
3. **Given** practice is at M4, **When** the chord's full duration has elapsed, **Then** the system advances to the next required notes in M5.

---

### User Story 3 - Green Dot Persistence Across System Line Breaks (Priority: P2)

A student is practicing and the score scrolls to a new system (line). The green dot that marks the current position should remain visible after the line change, confirming where the student is in the piece. Currently, the dot briefly appears at the new system position and then disappears.

**Why this priority**: Losing the position indicator during line breaks causes disorientation and breaks practice flow, especially in a scrolling score view.

**Independent Test**: Practice La Candeur past the first system line break. Verify the green position indicator remains visible and stable on the new system without disappearing.

**Acceptance Scenarios**:

1. **Given** practice reaches the end of a system, **When** the score moves to the next line, **Then** the green dot appears at the correct note on the new system and does not disappear.
2. **Given** multiple system line breaks in the score, **When** the student progresses past each one, **Then** the green dot remains stable at every transition.

---

### User Story 4 - Correct Expected-Note Set at M15 (Priority: P1)

At measure M15, the practice engine asks for a specific RH note (G4) but simultaneously treats LH half-note accompaniment notes as required, causing the player to fail unless all LH notes are also held. The system should evaluate only the hand's expected notes at each moment and not require held notes of the other hand beyond their defined entry point.

**Why this priority**: Incorrect note expectation makes measures unpractically impossible to pass, blocking the student's progress through the piece.

**Independent Test**: Start practice at M15. Play only the expected RH G4 as indicated. Verify this is accepted without needing to sustain LH half-notes past their already-activated duration.

**Acceptance Scenarios**:

1. **Given** both-hands mode at M15, **When** the player plays the required RH G4, **Then** the system accepts the input, even if LH half-notes from earlier in the measure are no longer held.
2. **Given** both-hands mode at M15, **When** the player omits the RH G4 but holds only LH notes, **Then** the system does not accept this as correct for the RH beat.
3. **Given** LH-only mode at M15, **When** LH half-notes are present across the measure, **Then** they are evaluated correctly per their defined duration.

---

### User Story 5 - "Extra Notes" Policy: Playing More Than Required (Priority: P2)

A student playing M17 discovers that pressing keys beyond the expected notes (e.g., playing a note during a rest, or playing additional notes alongside correct ones) is silently accepted. The system should define and enforce a clear policy: playing exactly the valid notes is accepted; playing extra notes beyond what is required should be evaluated consistently across the score, not just in M17.

**Why this priority**: Inconsistent validation undermines practice discipline and leads to students developing imprecise playing habits.

**Independent Test**: During a rest in M17, press any key and verify the system rejects or accepts it per the defined policy. During a beat where one note is expected, press that note plus an extra note and verify behavior matches the defined policy.

**Acceptance Scenarios**:

1. **Given** a rest is active for one hand (e.g., RH rest while LH is playing), **When** the player presses any key with the resting hand, **Then** the system registers a mistake for that hand and does not advance — each hand's rest is evaluated independently.
2. **Given** a beat expects specific notes, **When** the player plays all required notes plus additional ones, **Then** the system awards credit — the extra notes are silently ignored.
3. **Given** the same extra-note scenario across different measures, **Then** the semi-strict policy applies identically — score-wide, no measure-specific exceptions.

---

### User Story 6 - Position Lock During Active Practice (Priority: P2)

A student who is in the middle of a practice session cannot accidentally change the score position (e.g., by clicking a measure, dragging the playhead, or using keyboard shortcuts that jump to another position). Position navigation controls should be disabled or locked while practice is actively running.

**Why this priority**: Accidental position changes mid-session corrupt the practice state and force the student to restart, which is frustrating.

**Independent Test**: Start a practice session and attempt to click a different measure, drag the playhead, or use position shortcuts. Verify these actions are all blocked during active practice.

**Acceptance Scenarios**:

1. **Given** a practice session is running, **When** the user taps or clicks any measure on the score, **Then** the position does not change and no feedback suggests it can be changed.
2. **Given** a practice session is running, **When** the user attempts to use navigation controls (previous/next measure, playhead drag), **Then** those controls are visually disabled and non-responsive.
3. **Given** the practice session has been stopped, **When** the user interacts with navigation controls, **Then** the controls work normally.

---

### User Story 7 - Show Partial Results When Stopping Practice Early (Priority: P2)

A student who stops a practice session before finishing the piece sees a summary of their results up to the point they stopped, rather than no results at all. This gives meaningful feedback even for interrupted sessions.

**Why this priority**: Students often stop sessions early due to time constraints or difficulties. Discarding all results is wasteful and discouraging.

**Independent Test**: Begin a practice session, play several measures, then press Stop. Verify a results screen or summary is shown reflecting the notes/measures completed so far.

**Acceptance Scenarios**:

1. **Given** a practice session is in progress with at least one measure completed, **When** the user presses Stop, **Then** a results summary is displayed showing: (a) the percentage of notes correctly played up to the stop point, and (b) the last measure reached out of the total (e.g., "M12 of 32").
2. **Given** a practice session with zero notes played, **When** the user presses Stop, **Then** an appropriate "no results" message is shown rather than crashing or showing an empty screen.
3. **Given** a completed session (all notes played), **When** results are shown, **Then** the results reflect the full piece performance.

---

### Edge Cases

- What happens when a chord spans both a line break and a measure boundary simultaneously?
- How does the system handle a player who plays all correct notes plus the sustain pedal (extra notes from pedal)?
- If the player presses Stop before any note is played, is an empty results screen handled gracefully?
- What happens if the position is changed (via an external mechanism) while practice is locked — is the session invalidated?
- How does extra-note policy interact with grace notes or ornaments that are not strictly required?

## Requirements *(mandatory)*

### Functional Requirements

> **Scope**: All bugs described below are practice engine defects. Fixes apply to **all scores** in the application. La Candeur is the primary validation vehicle; at least one additional score must be included in regression tests.

- **FR-001**: The system MUST keep LH chord notes highlighted as active for their full notated duration in both-hands practice mode, matching the behavior observed in LH-only mode.
- **FR-002**: The system MUST calculate chord duration based on the note's full written value (including ties across barlines), not truncated to the current measure boundary.
- **FR-003**: The system MUST keep the position indicator (green dot) visible and stable after every system line break during practice.
- **FR-004**: The system MUST evaluate only the expected notes for each hand at each moment; sustained notes from a prior beat in the opposite hand must not be re-required as new input at subsequent beats.
- **FR-005**: The system MUST enforce a score-wide **semi-strict extra-notes policy**: (a) rests are evaluated **per hand independently** — pressing any key with a hand that is currently resting is counted as a mistake for that hand and does not advance the practice position, regardless of what the other hand is doing; (b) pressing additional notes beyond the required set, when all required notes are also pressed, is silently ignored and the player receives full credit for that beat.
- **FR-006**: The system MUST disable all score position navigation controls (measure click, playhead drag, navigation shortcuts) while a practice session is in active or running state.
- **FR-007**: The system MUST display a partial practice results summary when the user stops a practice session before completion, showing: (a) the percentage of notes correctly played up to the stop point, and (b) the last measure reached out of the total measure count.
- **FR-008**: The system MUST present an appropriate message when a user stops a practice session with zero progress rather than showing a broken or empty results view.

### Assumptions

- **Partial results format** (FR-007): Two metrics displayed — (a) percentage of notes correctly played up to the stop point, (b) last measure reached out of total (e.g., "M12 of 32"). No per-measure breakdown is required for partial results. This is a resolved decision (Session 2026-03-23).
- **Practice session state model**: Two states only — **Running** (position locked, input evaluated, results accumulating) and **Stopped** (position navigation re-enabled, partial results displayed). There is no pause state. This is a resolved decision (Session 2026-03-23).
- **Fix scope**: All fixes target the practice engine and apply to every score. La Candeur is used as the primary test vehicle; regression tests must also cover at least one other score (e.g., Arabesque or Für Elise). This is a resolved decision (Session 2026-03-23).
- **Rest evaluation** (FR-005): Rests are **hand-specific** — when Hand X has a rest, pressing any key with Hand X is a mistake, independently of Hand Y's state. This is a resolved decision (Session 2026-03-23).
- **Extra-notes policy** (FR-005): **Semi-strict** — pressing any key during a rest for a given hand counts as a mistake; pressing extra keys alongside all required notes is silently ignored and earns full credit. This is a resolved decision (Session 2026-03-23).
- Rests for a given hand must be observed; pressing any note during a rest for that hand counts as a mistake.
- "Position change" covers any mechanism available to the user in the UI: clicking on the score, drag navigation, keyboard shortcuts, or any other navigation affordance.
- Partial results use the same results format as a completed session, filtered to only the completed portion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In both-hands mode, LH chord note highlights remain green for 100% of the notated note duration across all scores — verified in La Candeur and at least one additional score; no premature drop observed.
- **SC-002**: Chord duration is correctly evaluated across barlines in all scores — verified in La Candeur M3–M4 and in at least one equivalent cross-barline chord in another score; zero early advancement in a run of at least 10 consecutive test plays.
- **SC-003**: The green position dot remains visible at the correct note in 100% of system line-break transitions across all scores — verified in La Candeur and at least one multi-system score.
- **SC-004**: At M15, playing only the required RH G4 is accepted by the system without requiring active LH sustain, verified across both-hands and RH-only modes.
- **SC-005**: The extra-notes policy is applied consistently across all measures — behavior in M17 matches behavior in every other measure when extra notes are pressed, with no measure-specific exceptions.
- **SC-006**: All score position navigation controls are non-responsive during an active practice session — verified by attempting at least 3 different navigation methods while practice is running.
- **SC-007**: Stopping an in-progress practice session always displays a results summary within 1 second, showing the percentage of notes correctly played and the last measure reached out of the total (e.g., "M12 of 32").
- **SC-008**: Zero user-reported crashes or empty screens when stopping a practice session at any point (before, during, or after completion).

