# Feature Specification: Fix Practice Mode MIDI Detection

**Feature Branch**: `001-fix-practice-midi-detection`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: "Fix practice mode score MIDI detection in user recording. When you fail a HL chord with HR note is hard to replay it to continue. Staccato chords are not detected OK in practice."

## Clarifications

### Session 2026-03-21

- Q: Which component/layer is responsible for processing MIDI note events during practice mode? → A: Frontend TypeScript — Web MIDI API captured and all beat detection logic lives in the TS/React layer.
- Q: When the user triggers "staccato" chords in practice, does the score explicitly mark notes as staccato, or is it purely player behaviour? → A: Score-marked — notes have staccato articulation marks in the score; the system reads these and should adjust its detection window accordingly.
- Q: When the user is stuck on a failed beat and cannot satisfy it, how can they exit the "waiting for retry" state? → A: Auto-advance after N failures — the system automatically skips the beat after a configurable number of consecutive failed attempts.
- Q: Does the order of individual notes within a chord (HL vs HR arrival order) matter within the grouping window? → A: Order-agnostic — any ordering of HL and HR note-on events within the grouping window is accepted as a valid beat.
- Q: Does a failed beat that is auto-advanced carry a heavier score penalty than a single-attempt failure? → A: Same weight — auto-advanced beats count identically to a single-attempt failure in the session score.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Recover and continue after failing a two-hand chord (Priority: P1)

A student is practising a passage that contains a left-hand (HL) chord played simultaneously with a right-hand (HR) note. They play it wrong, the system marks it as a failure, and they want to retry that specific beat without having to restart the entire exercise. Currently, re-attempting that beat leaves the system in a confused state — the wrong-hand event from the previous attempt interferes, making it impossible to move on.

**Why this priority**: This is a session-ending bug. When a two-hand chord is failed the student cannot continue the session without restarting, making the practice feature unusable for any multi-hand piece.

**Independent Test**: Can be fully tested by loading a score that has an HL chord coinciding with an HR note, deliberately playing the chord incorrectly, and verifying that the retry attempt is correctly accepted and the exercise advances as normal.

**Acceptance Scenarios**:

1. **Given** a practice session is active on a score containing an HL+HR chord beat, **When** the user plays the chord incorrectly (wrong notes or missing notes), **Then** the system marks that beat as failed and waits for the user to replay it without requiring a full session restart.
2. **Given** the system is in a "failed beat" waiting state for an HL+HR chord, **When** the user plays all required notes of that beat correctly, **Then** the system accepts the beat, clears the failure state, and advances the exercise to the next beat.
3. **Given** the system is in a "failed beat" waiting state, **When** the user plays a partial chord (only HL chord notes or only the HR note), **Then** the system does not accept it as a complete beat and continues waiting.
4. **Given** the system is in a "failed beat" waiting state, **When** the user plays an entirely different set of notes, **Then** the system continues to wait and provides visual feedback that the expected beat has not been satisfied.

---

### User Story 2 — Correctly detect staccato chords during practice (Priority: P2)

A student is practising a score that contains staccato-marked chords — notes played in quick, detached fashion where the key is released almost immediately after being pressed. The system currently fails to register these as valid chord detections, causing the exercise to stall even when the student plays them correctly.

**Why this priority**: Staccato detection is required for any repertoire that includes staccato articulation. Failure to detect these chords makes the practice feature unusable for a significant class of pieces.

**Independent Test**: Can be fully tested by loading a score with staccato chords, playing them with deliberate short key presses, and confirming the system registers each chord as a successful detection.

**Acceptance Scenarios**:

1. **Given** a practice session is active on a score with staccato-marked chords, **When** the user plays a chord with very short key hold durations (consistent with staccato articulation), **Then** the system registers the chord as a successful detection and advances.
2. **Given** a practice session is active, **When** the user plays the same chord in a non-staccato manner (normal held duration), **Then** the system also registers it correctly (no regression on normal chord detection).
3. **Given** a staccato chord requires multiple simultaneous notes, **When** the user plays all required pitches within the chord detection window, **Then** the system recognises the complete chord regardless of how briefly each key was held.
4. **Given** the user plays only a subset of the required staccato chord pitches, **When** the detection window closes, **Then** the system does not accept the partial chord and waits for a correct attempt.

---

### User Story 3 — Practice session continues without interruption across varied articulations (Priority: P3)

A student runs through an entire practice session that mixes sustained chords, staccato chords, single notes, and two-hand beat combinations without encountering false positives, missed detections, or hangs at any beat.

**Why this priority**: Overall session continuity is the quality bar that makes the practice feature pleasant to use. Individual detection fixes (P1, P2) must compose correctly.

**Independent Test**: Can be tested by loading a score that contains all four note types (single notes, sustained chords, staccato chords, two-hand beats) and completing a full run-through, verifying every beat is detected exactly once with no hangs.

**Acceptance Scenarios**:

1. **Given** a full practice session on a mixed-articulation score, **When** the student plays it correctly all the way through, **Then** every beat is accepted in order with no hangs, skips, or double-detections.
2. **Given** the session contains both staccato and non-staccato chords, **When** the student plays through the session, **Then** detection accuracy for single-note beats is not degraded compared to the behaviour before this fix.

---

### Edge Cases

- What happens when the user presses and immediately releases all keys of an HL+HR chord so quickly it might be treated as staccato? → The system must still evaluate it as a chord attempt (success or failure) rather than ignoring it.
- What happens when a score-marked staccato beat is played with a longer-than-staccato hold? → The note is still accepted; the shorter staccato window opens sooner but pitch matching is not affected by hold duration. There is no upper-bound penalty for holding a staccato note longer than expected.
- What happens when MIDI events from an HL chord and an HR note arrive in rapid succession but not strictly simultaneously? → The system must group them within a chord-grouping window and evaluate them as a single beat.
- What happens if the user triggers extra MIDI events (pedal noise, accidental key brushes) while in a "failed beat" waiting state? → Spurious events are ignored and do not reset or corrupt the waiting state.
- What happens when the user replays a failed beat before the system has fully reset its internal state? → The system must handle rapid retries without double-counting or skipping a beat.
- What happens when the auto-advance threshold is reached? → The beat is recorded as failed, a brief visual indication is shown (e.g., the beat highlights red and advances), and the session continues from the next beat with the failure count reset to zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST correctly detect a beat that consists of a simultaneous left-hand (HL) chord and right-hand (HR) note by grouping all MIDI note-on events that arrive within a configurable chord-grouping window (default 50 ms) into a single logical beat event. The grouping MUST be order-agnostic: any arrival ordering of HL and HR events within the window is treated as equivalent.
- **FR-002**: When a beat is evaluated as a failure, the system MUST transition to a "waiting for retry" state that accepts only the specific set of pitches required for that beat, without requiring the user to restart the entire session.
- **FR-003**: While in the "waiting for retry" state, any incoming MIDI events that do not complete the required beat MUST be discarded without advancing the exercise or altering the session state.
- **FR-003a**: The system MUST track the number of consecutive failed attempts for the current beat. After a configurable threshold (default 3 consecutive failures), the system MUST automatically advance to the next beat, recording the skipped beat as a failure in the session results with the same score weight as a single-attempt failure. The threshold MUST be configurable without a code change.
- **FR-004**: When a beat contains notes that are score-marked as staccato, the system MUST read those staccato articulation flags from the score model and apply a shorter chord-completion window for that beat, allowing very brief key presses (≤ ~80 ms hold) to be accepted as valid detections. Detection is still based on pitch matching; hold duration only gates when the window closes, not whether a note is counted.
- **FR-005**: The chord-grouping window MUST apply uniformly to both staccato and non-staccato chords so that no articulation style causes a chord to be split into multiple independent note events.
- **FR-006**: The fix MUST NOT alter the detection behaviour for single-note beats or sustained (non-staccato) chords that are currently working correctly.
- **FR-007**: The system MUST provide clear visual feedback on the current beat being evaluated, including the "waiting for retry" state, so the user understands what is expected of them.

### Key Entities

- **Beat**: A logical unit in the practice exercise representing one or more simultaneous notes (from either hand) that the user must play. A beat is evaluated as a whole — all required pitches must be detected within the chord-grouping window.
- **Chord-grouping window**: A short time interval (default 50 ms) during which consecutive MIDI note-on events are grouped into a single beat event. This is what enables both two-hand and staccato chords to be treated as one logical press.
- **Detection state**: The current state of the beat evaluator — either "waiting for the next beat", "waiting for retry of a failed beat" (tracks consecutive failure count), or "session complete". The fix must ensure failed two-hand chords transition correctly into "waiting for retry" rather than an undefined state. When the consecutive failure count reaches the configured threshold, the state machine auto-advances to "waiting for the next beat" and records the skipped beat as failed.
- **Articulation**: The manner in which notes are played, as encoded in the score model. A note flagged as staccato in the score triggers a shorter chord-completion window for that beat. The system reads staccato flags from the score rather than inferring articulation from raw key-hold durations alone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can fail a two-hand chord beat and successfully retry it without restarting the session in 100% of attempts during acceptance testing.
- **SC-002**: Staccato chords played correctly are detected and accepted in at least 95% of attempts across standard staccato articulation patterns.
- **SC-003**: No regression is introduced: single-note beats and sustained-chord beats that were correctly detected before this fix continue to be detected correctly in 100% of tests.
- **SC-004**: The system never enters a hung or unresponsive state during a practice session that contains two-hand chords or staccato chords; the session always reaches a defined state (success, failure, waiting, or auto-advanced).
- **SC-005**: False-positive detections (beats accepted when the user played incorrect pitches) remain at zero for all beat types.
- **SC-006**: When a beat reaches the auto-advance threshold (default 3 consecutive failures), the session advances automatically in 100% of cases; the beat is recorded as a standard failure with the same score weight as a single-attempt failure, and no separate "repeated failure" penalty is applied.

## Assumptions

- "HL" refers to left-hand (Hand Left) notes/chords and "HR" refers to right-hand (Hand Right) notes/chords, as labelled in the score model.
- The application receives input from a MIDI-capable instrument (digital piano/keyboard connected via MIDI). Audio-based pitch detection is out of scope for this fix.
- **MIDI events are captured via the Web MIDI API in the frontend TypeScript/React layer. All chord grouping, beat evaluation, and detection state-machine logic is implemented in TypeScript. No WASM/Rust involvement is required for this fix.**
- The chord-grouping window default of 50 ms is a starting value; it may need tuning during implementation but must remain configurable.
- Staccato notes are identified via score-model articulation flags, not inferred from raw key-hold durations. The bug is that the system does not read these flags and therefore applies the same (too-long) hold-duration threshold to staccato beats, causing them to time out undetected.
- The failed-beat retry issue is caused by the detection state machine not having a defined "waiting for retry" state for multi-note beats, leaving it in an undefined or reset state after a failure.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Failed HL+HR chord leaves detection in undefined state

**Discovered**: 2026-03-21 during user practice session (reported by user).

**Symptom**: When a beat consisting of a left-hand chord and a right-hand note is played incorrectly, attempting to replay the beat does not register correctly. The exercise stalls and cannot be continued.

**Root Cause**: To be determined during implementation — suspected: the beat evaluator has no dedicated "waiting for retry" state for multi-hand beats, and a failed attempt leaves the state machine in an undefined or reset position.

**Affected Components**: Practice mode beat evaluator / MIDI detection state machine.

**Regression Test**: To be created during implementation — a test that simulates failing an HL+HR chord beat and verifies the system transitions to "waiting for retry" and correctly accepts the subsequent correct attempt.

**Resolution**: Pending.

---

### Issue #2: Staccato chords not detected during practice

**Discovered**: 2026-03-21 during user practice session (reported by user).

**Symptom**: Staccato chords (notes played with very short key-hold durations) are not registered by the beat detection system, causing the exercise to stall on staccato beats even when the correct pitches are played.

**Root Cause**: To be determined during implementation — suspected: the detection logic waits for note-off events or uses key-hold duration as part of chord finalisation, which fails for staccato articulation where keys are released almost immediately.

**Affected Components**: Practice mode MIDI event grouping / chord detection logic.

**Regression Test**: To be created during implementation — a test that supplies staccato-duration note-on/note-off MIDI events for a known chord and verifies the system detects the chord correctly.

**Resolution**: Pending.

