# Feature Specification: Fix Chord Hold Validation at the Measure Boundary

**Feature Branch**: `098-fix-chord-hold-validation`
**Created**: 2026-09-02
**Status**: Implemented
**Input**: User description: "When practicing chords of long duration (for example in a 4/4 measure, a 3 notes chord lasting the full measure 1/1, followed by another chord of the same characteristics), using the metronome at 1/4 I play the chord for the 4 ticks of the measure and with the 5 tick I change and I play the next chord. But the chord detection does not validate my first chord play because it seems it is expecting a longer duration for the chord, which is not right, because I change when the measure has finished as expected. We need to review this chord detection logic to fix it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Whole-Measure Chord Validated After a Full Measure Hold (Priority: P1)

A learner is practicing a passage of long chords (e.g., a 3-note chord written as a whole note in 4/4 time, followed by another whole-note chord). They follow the quarter-note metronome: they press the first chord on beat 1, hold it through beats 2–4, and release it exactly at beat 5 (the downbeat of the next measure) while pressing the next chord. This is musically correct. Today the first chord is NOT validated — the system behaves as if a longer hold was required, discouraging the learner and producing a wrong result.

**Why this priority**: This is the core reported defect. A learner who holds a chord for exactly its notated duration and changes on the downbeat is playing correctly and must be confirmed as correct. Until this is fixed, long-chord practice is unusable.

**Independent Test**: Load a score with two consecutive whole-note chords in 4/4. Start practice, press chord 1 on beat 1, hold it for the full measure, and release it at the next measure's downbeat while pressing chord 2. Chord 1 must be recorded as correct and the session must advance to chord 2.

**Acceptance Scenarios**:

1. **Given** a 4/4 practice session with two consecutive whole-note chords at tempo T, **When** the learner presses all pitches of chord 1 on beat 1, holds them for exactly one full measure (4 quarter-note ticks), and releases them at the downbeat of the next measure while pressing chord 2, **Then** chord 1 is recorded as correct and the session advances to chord 2.
2. **Given** the same session, **When** the learner completes the hold described in scenario 1, **Then** no "released too early" / early-release result is recorded for chord 1.
3. **Given** the same session, **When** the learner holds chord 1 for the full measure and also keeps holding it past the downbeat (over-hold), **Then** chord 1 is still recorded as correct at approximately the moment its notated duration completes.
4. **Given** a 4/4 session with whole-note chords at 40, 60, and 120 BPM, **When** the learner plays scenario 1 at each tempo, **Then** chord 1 is validated correctly at every tempo.

---

### User Story 2 - The Required Hold Never Exceeds the Notated Duration (Priority: P1)

The learner is told that the maximum hold requested for a chord equals its notated musical duration at the current tempo. Changing the chord on the downbeat of the following measure always satisfies the hold requirement, regardless of how the completion check and the note release are processed.

**Why this priority**: The reported symptom is the system "expecting a longer duration". Users must be able to trust that the hold requirement is bounded by the notation, so they can align with the metronome and the measure boundary.

**Independent Test**: At any supported tempo, compare the hold time the system requires for a whole-note chord against one full measure at that tempo. They must be equal (within rounding), never greater.

**Acceptance Scenarios**:

1. **Given** a whole-note chord at tempo T, **When** the practice session computes the hold requirement for that chord, **Then** the requirement is no longer than one full measure at tempo T.
2. **Given** a hold that has reached the required duration, **When** the learner releases the chord, **Then** the chord is validated as correct even if the release happens in the same instant as the hold completing (i.e., decision depends on how long the note was held, not on the order of events).
3. **Given** a chord held longer than its required duration, **When** the learner finally releases it, **Then** the release is never classified as an early release.

---

### User Story 3 - Genuine Early Releases Are Still Detected and Penalised (Priority: P1)

The fix must not remove duration checking. If the learner changes the chord well before the measure ends (e.g., releases after 2 beats of a 4-beat chord), the chord must still be marked as released too early, hold the session on that chord, and apply the existing score penalty.

**Why this priority**: Duration accuracy (Feature 042) is an intended behaviour. The fix must only correct the boundary case — it must not weaken early-release detection.

**Independent Test**: Load a whole-note chord exercise. Press the chord and release it after only half the measure. Verify the session does not advance and the result is early-release.

**Acceptance Scenarios**:

1. **Given** a whole-note chord requiring a full-measure hold, **When** the learner releases it at 50% of the required duration, **Then** the chord is recorded as early-release and the session does not advance.
2. **Given** the early-release result from scenario 1, **When** the learner plays the chord again and now holds it for the full measure, **Then** the chord is validated as correct and the session advances (retry succeeds).
3. **Given** a completed session containing a genuine early release, **When** the results are shown, **Then** the early released note is classified separately and reduces the score as before this fix.

---

### User Story 4 - No Regression for Short Notes and Normal Tempos (Priority: P2)

Quarter notes, eighth notes and shorter must continue to advance immediately (no hold), half notes and longer must continue to require a hold, at all supported tempos, exactly as before this fix.

**Why this priority**: This is a boundary fix. Changing core note-duration behaviour for the general case would be a regression with wide impact.

**Independent Test**: Run the existing duration-checking test suite (Feature 042) — all previously passing cases must remain green.

**Acceptance Scenarios**:

1. **Given** a practice session at 120 BPM, **When** the learner plays a quarter note, **Then** the note advances immediately and no hold is required (unchanged).
2. **Given** a practice session at 120 BPM, **When** the learner plays a half note, **Then** a hold is still required and early release is still detected (unchanged).
3. **Given** tempos across the full supported range (10–300 BPM), **When** the learner plays short notes, **Then** behaviour matches the pre-fix behaviour for every case except the reported measure-boundary defect.

---

### Edge Cases

- What happens when the note release and the hold-completion check occur in the same instant (event ordering)? The chord must be validated as correct whenever the held time reached the required duration, independent of processing order.
- What happens when consecutive chords share one or more pitches (e.g., C major → G major sharing G)? Changing at the downbeat must still validate the first chord; shared pitches must not delay or invalidate it.
- What happens at measure boundaries in compound or other time signatures (3/4, 6/8, 9/8)? A chord written to fill the measure must be validated when held for that full measure.
- What happens when the device delays the periodic duration check (e.g., power saving or a temporary rendering stall) and the release is processed before the check runs? The hold must still be judged on actual held duration: a release that happens after the required hold was reached must validate as correct.
- What happens when the tempo changes mid-session? The required hold for each subsequent chord is computed from its own notated duration and the tempo in force when it is played.
- What happens when a chord overlaps another voice (sustained pitches)? Sustained-note handling is unchanged; only the hold-requirement boundary logic is reviewed.
- What happens if the learner changes the chord slightly before the downbeat? A release margin of up to 15% of the required duration (capped at 750 ms) is granted — a hold reaching that fraction is accepted; only holds that genuinely fall short of the threshold are early-release.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A chord held for at least its full notated duration at the current tempo and released at the next attack point MUST be validated as correct — the system MUST NOT require a hold longer than the notated duration.
- **FR-002**: The decision to accept or reject a hold MUST be based on the actual elapsed hold time versus the required hold time, independent of whether the note-release event or the periodic hold-completion check is processed first.
- **FR-003**: Releasing any pitch of a held chord MUST be classified as an early release ONLY when the elapsed hold time is below the acceptable threshold; a release at or above the threshold MUST be treated as a successful hold.
- **FR-004**: Chord change aligned with the metronome at the measure boundary (downbeat) MUST always satisfy the hold requirement for a chord whose notated duration fills the measure.
- **FR-005**: Genuine early releases (hold shorter than the threshold) MUST continue to be recorded as early-release, keep the session on the same note, and apply the existing score penalty.
- **FR-006**: The fix MUST NOT change hold behaviour for notes requiring no hold (quarter notes and shorter, staccato) or the hold thresholds for normal tempo practice.
- **FR-007**: The fix MUST work consistently across the full supported tempo range (10–300 BPM) and across time signatures where a chord may fill an entire measure.
- **FR-008**: Over-holding (holding past the required duration) MUST still validate the chord at the moment the minimum hold is reached and MUST never be penalised.

### Key Entities

- **Practice note entry**: A practice step with one or more pitches (chord), a start tick, and a notated duration determined at session setup; the basis for the required hold.
- **Hold session record**: The per-note context that captures when the hold started, how long it must last, and the response/expected timing — used to decide correct vs. early-release.
- **Note result**: The outcome recorded per practice step (`correct`, `correct-late`, `early-release`, `wrong`), which feeds the final score; early-release must only appear when the hold genuinely fell short.
- **Practice session clock**: The shared timing reference (current tick, tempo, practice start time) that maps musical duration to wall-clock hold time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of whole-measure chords played for the full measure and changed on the next downbeat are validated as correct in automated boundary tests, at 40, 60, and 120 BPM.
- **SC-002**: 100% of tested cases show a required hold no greater than the chord's notated duration at the current tempo (rounded to normal scheduling precision).
- **SC-003**: 100% of genuine early releases (release before the acceptable threshold) still produce an early-release result and block advancement.
- **SC-004**: 0 regressions in the existing duration-checking test suite (Feature 042 behaviour, short-note immediate advancement, normal-tempo holds).
- **SC-005**: The chord-hold acceptance decision is correct 100% of the time regardless of event ordering when a release coincides with the hold-completion instant (verified by automated race-style tests).
- **SC-006**: A learner who holds a full-measure chord and changes at the downbeat completes the exercise on the first attempt without correcting or repeating any chord.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Whole-Measure Chords Are Not Validated When Changed at the Downbeat

**Discovered**: 2026-09-02 during user practice in a piece of consecutive whole-note chords (4/4, metronome at quarter notes).

**Symptom**: The first of two consecutive whole-note chords is not validated even though it was held for the entire measure (4 quarter-note ticks) and changed at beat 5. The chord validation behaves as if a longer hold was required.

**Root Cause**: The hold validation classifies a chord release as an early release when the release is processed while the hold is still being assessed, without confirming that the required hold duration had not yet been satisfied. At the measure boundary the release and the hold-completion check coincide, so a musically correct full-measure hold can be rejected as "released too early".

**Affected Components**: Practice duration-hold validation (hold assessment and chord-release handling in the practice view), note-duration checking introduced in Feature 042.

**Regression Test**: To be added following plan/tasks:
- `frontend/plugins/practice-view-plugin/useHoldProgress.test.ts` and `usePracticeMidi.test.ts` — cover a full-measure chord released at the downbeat being accepted, and the identical-duration/event-ordering boundary.
- `frontend/plugins/practice-view-plugin/practiceEngine.test.ts` — cover that a release at/after the threshold is correct and only sub-threshold releases are early-release.

**Resolution**: Implemented (feature 098). A single pure hold-acceptance rule
(`isHoldAccepted(requiredHoldMs, elapsedMs)` — ≥75% of the required duration,
i.e. a release margin of up to 15% capped at 750 ms) is applied at every decision
point: the MIDI release
handler, the press-during-hold handler, and the reducer's `EARLY_RELEASE` case.
A release that has already reached the acceptance threshold is treated as a
successful hold (`HOLD_COMPLETE`), never an `early-release`; the decision depends
only on measured hold duration. Regression tests added:
- `frontend/plugins/practice-view-plugin/practiceEngine.test.ts` (T008-red/T015/T019)
- `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts` (T007-red/T009-red/T016/T020)
- `frontend/plugins/practice-view-plugin/holdDuration.test.ts` (acceptance-rule contracts)
- `frontend/src/plugin-api/computePracticeScore.test.ts` (early-release 0.5× penalty)

**Lessons Learned**: Hold-validation decisions must depend only on measured hold duration versus the required duration, never on which event is processed first; release handling must not reject a hold that has already satisfied its requirement.

---

## Assumptions

- The chord's notated duration for a whole note filling a 4/4 measure equals the measure at the current tempo; the required hold must equal that duration (subject to the release margin).
- The supported tempo range is 10–300 BPM, consistent with specs 085/086.
- The release margin is 15% of the required duration, capped at 750 ms (feature 099): a chord held for at least that fraction is accepted, requiring ~85% accuracy while leaving a modest margin for finger changes; genuine early releases (below the margin) remain penalised.
- "Validated as correct" means the chord is accepted at (or slightly before) the moment its notated duration completes at the current tempo, and is recorded as `correct` (or `correct-late` per the existing timing rules), never as `early-release`.
- The defect is in the duration-hold validation of the practice view, not in audio/MIDI capture or in the initial chord-group detection (ChordDetector window).