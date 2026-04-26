# Feature Specification: Fix Metronome Issues

**Feature Branch**: `085-fix-metronome-issues`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "Fix metronome issues: ultraslow tempo sync, loop playback stops metronome, visual blink ignores subdivision setting"

## Clarifications

### Session 2026-04-26

- Q: What is the scope of changes allowed for the metronome fix? → A: Scheduling logic is in scope; only the sound synthesis (oscillator/audio output) is off-limits.
- Q: Does the ≤50ms deviation threshold apply at all tempos? → A: Universal: ≤50ms at ALL supported tempos (10–300 BPM), one universal bar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Metronome Stays In Sync at Ultraslow Tempos (Priority: P1)

A musician practicing a difficult passage sets the tempo to an extremely slow value (e.g., 10 BPM) to drill note accuracy. The metronome should tick precisely on every beat, perfectly aligned with playback, so the musician can reliably use it as a timing reference even at very low tempos.

**Why this priority**: Tempo accuracy is the fundamental contract of a metronome. A desync at any tempo renders the feature unusable for its core purpose and directly undermines practice quality.

**Independent Test**: Set tempo to 10 BPM, start playback with metronome enabled, and verify that metronome ticks land exactly on each beat of the score for at least 8 measures.

**Acceptance Scenarios**:

1. **Given** playback is stopped, **When** the user sets tempo to 10 BPM and starts playback with the metronome enabled, **Then** each metronome tick coincides with the corresponding beat in the score without drifting or leading.
2. **Given** playback is running at 10 BPM with metronome active, **When** 4 or more measures have elapsed, **Then** no accumulated drift is observable between metronome ticks and score beat positions.
3. **Given** a metronome is running at 10 BPM, **When** compared to one running at 120 BPM, **Then** both maintain the same tick-to-beat accuracy relative to playback position.

---

### User Story 2 - Metronome Continues Running Through All Loop Repetitions (Priority: P2)

A musician enables loop playback to repeat a section for practice. The metronome should tick continuously throughout every loop iteration without interruption — it must not stop, freeze, or restart between loops. Only an explicit user action (Stop, Pause, or disabling the metronome) should interrupt it.

**Why this priority**: Loop practice is a core use-case for music learning. A metronome that silently stops after the second loop forces the musician to divert attention from the instrument to restart it, breaking the practice flow.

**Independent Test**: Enable loop mode on a section of 2+ measures, start playback, and verify metronome ticks continue uninterrupted through at least 5 consecutive loop repetitions.

**Acceptance Scenarios**:

1. **Given** loop mode is active and playback is running, **When** the playback position wraps from the loop end back to the loop start, **Then** the metronome tick stream continues without any gap or silence.
2. **Given** the metronome is ticking through repeated loops, **When** 3 or more loops have completed, **Then** ticks remain in sync with the playback position at the beginning of each new loop iteration.
3. **Given** loop playback is running with metronome active, **When** the user presses Stop, **Then** the metronome stops cleanly and does not restart on its own.
4. **Given** loop playback has been stopped (metronome also stopped), **When** the user presses Play again (without loop), **Then** the metronome starts fresh and behaves normally.

---

### User Story 3 - Visual Blink Respects the Configured Subdivision (Priority: P3)

A musician configures the metronome to blink at eighth-note (1/8) subdivisions to develop finer rhythmic awareness. The visual indicator must blink on every eighth note, not just on quarter-note beats. The blink frequency must match the selected subdivision setting.

**Why this priority**: Subdivisions are the second most visible feature of the metronome UI. If the blink ignores the setting, users cannot trust any metronome configuration and may incorrectly believe the feature is broken.

**Independent Test**: Set metronome subdivision to 1/8, start playback at a moderate tempo (e.g., 60 BPM), and count that 2 blinks occur per beat (one on each eighth note).

**Acceptance Scenarios**:

1. **Given** the metronome subdivision is set to 1/4, **When** playback is running, **Then** the visual indicator blinks once per quarter-note beat.
2. **Given** the metronome subdivision is set to 1/8, **When** playback is running, **Then** the visual indicator blinks twice per quarter-note beat (i.e., on each eighth note).
3. **Given** the metronome subdivision is changed from 1/4 to 1/8 while playback is running, **When** the change is applied, **Then** the blink rate immediately doubles to match the new subdivision without requiring a restart.
4. **Given** the metronome subdivision is set to 1/8, **When** playback is at a very slow tempo (e.g., 20 BPM), **Then** the blink still fires on each eighth-note interval, not only on quarter-note beats.

---

### Edge Cases

- What happens when tempo is set below the minimum supported value (e.g., < 1 BPM)? The metronome should not crash or produce erratic ticks; it should clamp to a minimum or disable gracefully.
- What happens when the loop region is shorter than one beat at ultraslow tempos? The metronome should still emit ticks correctly based on absolute playback time, not loop cycle count.
- What happens when the user changes the subdivision while the metronome is already mid-tick cycle? The change should take effect at the next tick boundary without skipping or doubling a tick.
- What happens when loop mode is toggled on/off while playback is running with the metronome active? The metronome should not restart or lose its phase.
- What happens when playback is paused and resumed mid-loop? The metronome should resume in sync from the paused position, not restart the loop's tick counter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The metronome tick scheduler MUST use playback-position-based timing so that tick intervals remain accurate at any tempo in the supported range (10–300 BPM).
- **FR-002**: The metronome MUST NOT use wall-clock interval timers as the sole source of tick timing, as these drift from playback position at extreme tempos.
- **FR-003**: When loop playback is active, the metronome tick stream MUST continue uninterrupted across every loop boundary for the entire duration of playback.
- **FR-004**: The metronome MUST NOT stop or reset its internal state when the playback position wraps from loop end to loop start.
- **FR-005**: When playback is stopped by the user, the metronome MUST stop and MUST NOT auto-restart without a new explicit playback start action.
- **FR-006**: The visual blink indicator MUST fire on every note event determined by the configured subdivision value (1/4, 1/8, etc.).
- **FR-007**: The blink interval MUST be derived from the active subdivision setting, not hardcoded to quarter-note intervals.
- **FR-008**: Changing the subdivision setting MUST immediately update the blink interval for subsequent ticks without requiring a playback restart.
- **FR-009**: The metronome MUST remain in sync with the score playback position across all supported tempos (10–300 BPM), with tick deviation ≤ 50 ms at any tempo in that range.

### Assumptions

- The metronome already has subdivision settings exposed in the UI (at minimum 1/4 and 1/8 options).
- "In sync" means each metronome tick lands within ≤ 50 ms of the corresponding beat/subdivision position in the score at any tempo in the supported range (10–300 BPM).
- Loop mode is an existing feature; this fix targets only metronome behavior within the existing loop framework.
- No changes to the metronome's sound synthesis layer (oscillator/audio output generation) are required. The tick scheduling logic — timing calculations, tick intervals, and when ticks fire — IS in scope for changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At all supported tempos (10–300 BPM), the metronome tick deviation from the score's beat position is ≤ 50 ms for at least 8 consecutive beats; this universal threshold must hold at the extreme low end (10 BPM) as well as at representative typical values (e.g., 120 BPM), eliminating the perceived desync.
- **SC-002**: During loop playback, the metronome tick stream is uninterrupted across at least 10 consecutive loop iterations with no gaps, stops, or spurious restarts.
- **SC-003**: When the subdivision is set to 1/8, exactly 2 blink events occur per quarter-note beat period, matching the expected eighth-note subdivision rate.
- **SC-004**: All three metronome behaviors (tempo sync, loop continuity, subdivision blink) pass their acceptance scenarios without any manual workaround required by the user.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Metronome Runs Faster Than Playback at 10 BPM

**Discovered**: 2026-04-26 during user testing

**Symptom**: When tempo is set to 10 BPM (ultraslow), the metronome ticks at a rate noticeably faster than the actual playback position advances through the score.

**Root Cause**: To be determined during implementation — likely a timer-based scheduling approach that does not compensate for tempo scaling, causing tick intervals computed from a default tempo to be too short at very low BPM values.

**Affected Components**: Metronome scheduler / tick engine (frontend).

**Regression Test**: To be created during implementation — unit test that asserts tick timestamps align with beat positions at 10 BPM over an 8-beat window.

---

### Issue #2: Metronome Stops After Second Loop Iteration

**Discovered**: 2026-04-26 during user testing

**Symptom**: When loop playback is active, the metronome ticks correctly during the first loop and into the second, but ceases ticking after the second loop completes. Manually stopping loop playback causes the metronome to restart unexpectedly.

**Root Cause**: To be determined — likely the metronome's internal state (tick counter or scheduler reference) is not reset properly when the playback position wraps, causing the scheduler to halt.

**Affected Components**: Loop playback coordinator and metronome lifecycle management (frontend).

**Regression Test**: To be created — integration test that simulates 5 loop iterations and asserts continuous tick events throughout.

---

### Issue #3: Visual Blink Ignores Subdivision Setting

**Discovered**: 2026-04-26 during user testing

**Symptom**: Regardless of the configured subdivision (e.g., 1/8), the visual blink indicator only fires on quarter-note (1/4) beats.

**Root Cause**: To be determined — likely the blink interval is computed from a hardcoded quarter-note reference rather than reading the active subdivision setting.

**Affected Components**: Metronome visual indicator / blink renderer (frontend).

**Regression Test**: To be created — unit test that verifies blink event count matches the expected subdivision multiplier (e.g., ×2 events per beat for 1/8 vs 1/4).

