# Feature Specification: Fix Delayed Chord Detection on Phrase Repeat

**Feature Branch**: `100-fix-practice-repeat-delay`
**Created**: 2026-09-04
**Status**: Implemented
**Input**: User description: "In score practice mode I am working with the Arabesque. In the first phrase with the first two measures (M1 and M2), that it is only left hand with 4 chords (2 per measure), I am using the metronome to be sure I play accurate. Graditone records correctly the first 4 chords, but when I play the 5th chord (the first note of the second iteration of the phrase in the practice), that it is the first one of the M1, no matter I do it with the metronome tic, it records a delay of >600ms."

## Summary

In Score Practice, a left-hand phrase of 4 chords (2 per measure, measures M1 and M2, e.g. the Arabesque) is practised with the metronome. The first 4 chords of the first phrase iteration are detected with correct timing. However, the 5th chord — the first chord of measure M1 in the **second iteration** of the same repeated phrase — is consistently recorded as late by more than 600 ms, even when the musician attacks it exactly on the metronome tick. The chord is played correctly; only its recorded onset timing is wrong. The bug is a detection/alignment failure at the phrase-repeat boundary, not a musician timing error.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First chord of a repeated phrase is timed correctly (Priority: P1)

A musician practises a short left-hand phrase (4 chords, 2 per measure) in Score Practice with the metronome running. They play the phrase twice. The first iteration's 4 chords are each recorded as correct and on-time. When the phrase repeats and the musician plays the 5th chord (the first chord of measure M1 again) on the metronome tick, the system must record it as correct and on-time, exactly as it did for the first occurrence of the same chord.

**Why this priority**: This is the entire reported bug. A repeated passage is a core practice scenario; degrading the timing record of the note that re-opens a phrase makes the report untrustworthy and misrepresents the musician as late despite playing accurately. Fixing this one path delivers the requested value on its own.

**Independent Test**: Set up the Arabesque in Score Practice, restrict to the left-hand phrase of measures M1–M2 (4 chords), enable the metronome, play the phrase twice in tempo. Observe that the 5th chord (first chord of the second phrase iteration) is recorded as correct with an onset deviation within the standard tolerance, not as a >600 ms delay.

**Acceptance Scenarios**:

1. **Given** a Score Practice of a repeated 4-chord phrase with the metronome active, **When** the musician plays the first iteration (4 chords) in tempo, **Then** each chord is detected at its expected tick with an on-time onset deviation.
2. **Given** the same session, **When** the musician plays the 5th chord (first chord of M1, second phrase iteration) exactly on the metronome tick, **Then** it is detected as correct with an on-time onset deviation (within the standard timing tolerance).
3. **Given** the same session, **When** the musician plays the 5th chord exactly on the tick and the report is generated, **Then** the 5th chord's State does not show a large (>600 ms) late deviation.
4. **Given** the same session, **When** the musician intentionally plays a chord ahead of or behind the tick, **Then** the system still reports the actual (correctly measured) early/late deviation for that chord.

---

### User Story 2 - Phrase-repeat detection is correct across tempo values (Priority: P2)

The repeat-boundary detection fix must hold at different practice tempos, not just the tempo used during the initial report.

**Why this priority**: The bug is timing-related, and the delay magnitude (>600 ms) is tempo-independent. Confirming the fix across a normal tempo range prevents a partial fix that only works at one speed.

**Independent Test**: Repeat User Story 1's scenario at a slow tempo (e.g. 60 BPM) and a moderate tempo (e.g. 120 BPM); verify the 5th chord is on-time at both.

**Acceptance Scenarios**:

1. **Given** a repeated 4-chord phrase practice at 60 BPM, **When** the musician plays the 5th chord on the tick, **Then** it is recorded on-time.
2. **Given** the same practice at 120 BPM, **When** the musician plays the 5th chord on the tick, **Then** it is recorded on-time.

---

### Edge Cases

- What happens when the phrase repeats more than twice (e.g. 3+ iterations)? The first chord of *every* subsequent iteration must be detected on-time, not only the first repeat.
- What happens when the musician is slightly early or late on the 5th chord? The recorded deviation must reflect the true small deviation (e.g. tens of ms), never a spurious >600 ms bias.
- What happens when the metronome is used (as reported) vs. unused? The reported bug occurs with the metronome; the fix must not regress correct timing detection when the metronome is off.
- What happens when the phrase contains different note values (not only chords at measure starts)? The alignment at the repeat boundary must generalise to any first note of a repeated region.
- What happens on the boundary between the last chord of a phrase and the first chord of its repeat when they occur back-to-back? The 5th chord's onset must be measured against its own expected tick, not against the end of the previous iteration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a phrase repeats during Score Practice, the first note/chord of each repeated iteration MUST be detected with the same onset-alignment accuracy as every other note — no spurious timing delay solely because it re-opens a phrase.
- **FR-002**: A note/chord played exactly on the metronome tick at a phrase-repeat boundary MUST be recorded as correct with an on-time onset deviation (within the standard tolerance used for non-repeat notes).
- **FR-003**: The onset of repeat-boundary notes MUST be measured against the note's own expected position in the musical timeline, NOT relative to the end of the preceding phrase iteration.
- **FR-004**: The fix MUST apply regardless of how many times the phrase iterates (first chord of each repeat, not just the first repeat).
- **FR-005**: The fix MUST NOT alter correct timing detection when the metronome is inactive.
- **FR-006**: Real early/late deviations on the repeat-boundary note MUST still be reported accurately; the fix removes only the spurious >600 ms bias.

### Key Entities

- **Phrase (Practice Region)**: A repeated musical segment within the score being practised (the M1–M2 left-hand figure in Arabesque), which recurs during a session.
- **Practice Result / Recorded Onset**: The measured attack timing for each note/chord in the session, including its onset deviation in milliseconds and its state (Correct / Out-of-time).
- **Metronome Tick**: The audible beat reference the musician plays against; used to set the expected onset position of each note.
- **Expected Timeline Position**: The musical tick (by score position and tempo) at which each note/chord should be attacked, including for the first note of a repeated phrase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Playing the Arabesque left-hand phrase twice in tempo (metronome on) produces a report where the 5th chord (first chord of the second iteration) is recorded as Correct with an onset deviation within the standard on-time tolerance (≤ ~50 ms), never > 600 ms late.
- **SC-002**: The first chord of every repeated phrase iteration is detected on-time across the tested range of practice tempos (e.g. 60–120 BPM).
- **SC-003**: When the musician intentionally plays the repeat-boundary chord early or late, the report reflects the true small deviation rather than masking or inflating it.
- **SC-004**: All existing Score Practice timing contracts (on-time, early-release, late, wrong-note states and their millisecond deviations) continue to pass, with no regressions to non-repeat notes.

## Known Issues & Regression Tests

### Issue #1: Delayed chord detection at phrase-repeat boundary

**Discovered**: 2026-09-04 during tablet practice with the Arabesque (Score Practice, left-hand M1–M2 phrase, metronome active).

**Symptom**: The first 4 chords of the first phrase iteration are detected with correct timing. The 5th chord — the first chord of measure M1 in the second iteration of the same phrase — is recorded as late by more than 600 ms even when attacked exactly on the metronome tick.

**Root Cause**: For repeated phrases played via the practice **loop-count** mode, the expected onset time of the first chord of each iteration ≥ 2 was anchored to the previous iteration's **wall-clock completion timestamp** (`usePracticeMidi.ts` read `loopStartTimesRef.current[loopK]`). That completion timestamp is recorded when the prior iteration's last chord is *released* (`HOLD_COMPLETE`), i.e. after its hold tail + pickup gap. An accurate player strikes the next downbeat one full musical loop period later, so this early anchor inflated `expectedInterval`, producing a spurious positive (late) `relativeDeltaMs` — commonly > 600 ms. The first iteration was unaffected because `loopIteration = 0` used the plain musical `baseExpectedTimeMs`.

**Affected Components**: Score Practice chord/note onset timing (`frontend/plugins/practice-view-plugin/usePracticeMidi.ts`); timing report deviation derivation (`practiceEngine.ts` mediated purely by `expectedTimeMs`).

**Regression Test**: `frontend/plugins/practice-view-plugin/usePracticeMidi.test.ts` → `T005-F100` asserts that for loop iteration 2 the dispatched `CORRECT_MIDI.expectedTimeMs` equals the musical loop period (1000 ms @120 BPM over 1920 ticks), not the previous iteration's completion timestamp (1250 ms). Pure helper contract covered in `frontend/plugins/practice-view-plugin/computeExpectedTimeMs.test.ts`. Both were written and confirmed RED before the fix (Constitution V/VII).

**Resolution**: Extracted a pure `computeExpectedTimeMs({ tick, bpm, loopRegion, loopIteration })` helper in `usePracticeMidi.ts` and used it at the single timing call site. For iteration `k`, it returns `baseExpectedTimeMs + k × loopPeriodMs`, where `loopPeriodMs` is the musical duration of the loop region — monotonic and on the same session clock as `responseTimeMs`, so an accurate player measures `relativeDeltaMs ≈ 0` on every iteration. Iteration-1/non-loop output is identical to the pre-fix formula (byte-for-byte). The now-unused `loopStartTimesRef` read for timing was removed (the write in `usePracticeLoop.ts` remains for loop bookkeeping).

**Lessons Learned**: Do not anchor an expected *onset position* on an event that occurs *after* the onset (a completion/release timestamp). Expected times for repeated regions must be derived from the musical timeline (loop period), not from wall-clock session bookkeeping; this keeps measurement anchored to the same clock as the input so accurate playing is not mislabelled late.

## Assumptions

- The reported delay is a detection/alignment defect, not a musician tempo error; the same source is expected regardless of the specific score, keyed on phrase repetition.
- "On-time" is judged against the existing standard timing tolerance already used for non-repeat notes in Score Practice (no new tolerance is being introduced, only removing the spurious delay at the repeat boundary).
- The fix should be verified in the context already covered by prior practice-timing work (feature 086 low-tempo detection, 095 ms deviation reporting, 099 chord hold accuracy and metronome arming) to avoid regressions there.