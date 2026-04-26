# Feature Specification: Fix Note Detection at Ultra-Low Tempos

**Feature Branch**: `086-fix-note-detection-slow-tempo`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "Fix note detection at ultra-low tempos: long notes at end of measure require too long to be detected correctly at tempos below 20 BPM"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Long Notes at Measure End Detected Promptly at Ultra-Low Tempo (Priority: P1)

A musician is practicing at a very slow tempo (e.g., 10 BPM) and plays a whole note or half note that falls at the end of a measure. The system should register the note as correctly played as soon as the musician has held it for its required musical duration — not require holding it for an unreasonably longer time before it is accepted.

**Why this priority**: This is the core reported bug. At ultra-low tempos, the note duration in wall-clock time is very long (e.g., a quarter note at 10 BPM = 6 seconds). If the detection threshold doesn't scale with tempo, musicians must hold notes far longer than musically required, making ultra-slow practice frustrating and unusable.

**Independent Test**: At 10 BPM, play a whole note (4 beats = 24 seconds). The system should accept the note after approximately 24 seconds, not require 40+ seconds.

**Acceptance Scenarios**:

1. **Given** tempo is set to 10 BPM, **When** the musician plays and holds a whole note for its exact musical duration (24 seconds), **Then** the note is detected and accepted without requiring additional hold time.
2. **Given** tempo is set to 15 BPM, **When** the musician plays a half note at the end of a measure and holds it for its musical duration, **Then** the note is detected correctly at the expected time.
3. **Given** tempo is set to 20 BPM, **When** the musician plays a long note at the end of a measure, **Then** detection latency is proportional to the note's musical duration at that tempo — no extra hold time needed.
4. **Given** tempo is set to a normal value (e.g., 120 BPM), **When** the musician plays any note, **Then** note detection behaviour is unchanged from before this fix.

---

### User Story 2 - Consistent Detection Across All Note Values at Ultra-Low Tempos (Priority: P2)

At ultra-low tempos, all note durations (whole, half, quarter, eighth) should be detected with the same proportional accuracy. The bug should not be limited to whole notes — any note that spans a long real-time duration should be detected correctly.

**Why this priority**: If only one note value is fixed, musicians still encounter unpredictable detection at other durations, undermining trust in the system at slow tempos.

**Independent Test**: At 10 BPM, play a quarter note, half note, and whole note in sequence. All three should be detected and accepted at the expected musical moment.

**Acceptance Scenarios**:

1. **Given** tempo is 10 BPM, **When** the musician plays a quarter note (6 seconds), **Then** it is detected correctly after ~6 seconds.
2. **Given** tempo is 10 BPM, **When** the musician plays a half note (12 seconds), **Then** it is detected correctly after ~12 seconds.
3. **Given** tempo is 10 BPM, **When** the musician plays a whole note (24 seconds), **Then** it is detected correctly after ~24 seconds.
4. **Given** tempo is 10 BPM, **When** any note ends at a measure boundary, **Then** detection accuracy is the same as for notes ending mid-measure.

---

### Edge Cases

- What happens when the musician releases a note just before the required duration at ultra-low tempo? The system should apply the same early-release tolerance as at normal tempos, scaled proportionally.
- What happens when tempo changes mid-session from ultra-low to normal? Detection thresholds should adjust immediately for subsequent notes.
- What happens at exactly 20 BPM (the boundary of the reported failure range)? Detection should work correctly at and around this threshold.
- What happens with tied notes spanning multiple measures at ultra-low tempo? The full combined duration should be required, not each measure separately.
- What happens if the musician holds a note past its required duration at ultra-low tempo? The note should be accepted at the correct time and not penalised for over-holding.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Note detection thresholds MUST scale proportionally with the current tempo so that the required hold time in real seconds equals the note's musical duration at that tempo.
- **FR-002**: The note detection system MUST NOT use a fixed wall-clock timeout that is calibrated for normal tempos (e.g., 60–180 BPM) and applied unchanged at ultra-low tempos (< 20 BPM).
- **FR-003**: All note durations (whole, half, quarter, eighth, and shorter) MUST be detected correctly at all tempos in the supported range (10–300 BPM).
- **FR-004**: Notes positioned at the end of a measure MUST be detected with the same accuracy as notes positioned mid-measure, at any tempo.
- **FR-005**: The fix MUST NOT regress note detection accuracy or latency at normal tempos (60–180 BPM).
- **FR-006**: Early-release tolerance (if any) MUST be proportional to the note duration at the current tempo, not a fixed absolute value.

### Assumptions

- "Detected correctly" means the note is accepted within ≤ 500 ms of the note's musical end time (its onset time plus its theoretical duration at the current tempo).
- The bug is isolated to the note detection/validation layer, not to audio input capture.
- The supported tempo range is 10–300 BPM, consistent with the metronome fix in spec 085.
- Normal tempo behaviour (60–180 BPM) must remain unchanged — no regressions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 10 BPM, a whole note is accepted within ≤ 500 ms of its theoretical musical end (24 seconds after onset), with no requirement to hold it beyond that point.
- **SC-002**: At 10 BPM, detection latency for a quarter note, half note, and whole note each fall within ≤ 500 ms of their respective expected musical durations.
- **SC-003**: At 120 BPM, note detection latency and accuracy are unchanged compared to the pre-fix baseline — zero regressions at normal tempos.
- **SC-004**: Notes at the end of a measure are detected with the same ≤ 500 ms tolerance as notes mid-measure, at any tempo in 10–300 BPM.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Long Notes at Measure End Require Excessive Hold Time at Ultra-Low Tempos

**Discovered**: 2026-04-26 during user testing

**Symptom**: At tempos below 20 BPM, notes positioned at the end of a measure (especially long values like whole or half notes) are not detected as correctly played until the musician has held them for significantly longer than their musical duration requires. The detection appears to use a fixed timeout not scaled to the current tempo.

**Root Cause**: To be determined during implementation — likely a hardcoded or insufficiently tempo-scaled duration threshold in the note detection/validation logic, causing the acceptance window to be calibrated for normal tempos and therefore far too long in absolute terms at ultra-low tempos.

**Affected Components**: Note detection / score validation layer (frontend).

**Regression Test**: To be created — unit test asserting that at 10 BPM, a whole-note detection fires within ≤ 500 ms of the 24-second mark, and at 120 BPM, detection timing is unchanged.

