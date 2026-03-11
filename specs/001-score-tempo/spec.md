# Feature Specification: Score-Defined Tempo Configuration

**Feature Branch**: `001-score-tempo`  
**Created**: 2026-03-11  
**Status**: Draft  
**Input**: User description: "Configure tempo using the one defined in the Score. Right now we are using 120BPM as the tempo for all scores. It is time to read the tempo from the Score and configure it as the snap one for this score."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Playback Starts at the Score's Tempo (Priority: P1)

When a user opens a score for playback, the playback engine should automatically use the tempo embedded in that score — not a generic 120 BPM default. If a score is marked at 72 BPM (e.g., a Nocturne) or 160 BPM (e.g., a fast étude), pressing Play should honour that tempo immediately, without any manual adjustment.

**Why this priority**: This is the core correctness issue. Playing every score at 120 BPM misrepresents the composer's intent and makes the app feel broken for any score with a non-standard tempo. All other user stories depend on the score tempo being read correctly.

**Independent Test**: Can be tested by loading any score with a non-120 BPM tempo marking (e.g., Chopin Nocturne Op.9 No.2 at 66 BPM) and verifying that the displayed and audible tempo matches the score, not 120 BPM.

**Acceptance Scenarios**:

1. **Given** a score that contains a tempo marking of 66 BPM at its start, **When** the user opens the score, **Then** the playback tempo indicator shows 66 BPM.
2. **Given** a score with a tempo marking of 66 BPM, **When** the user starts playback, **Then** the audio plays at 66 BPM (not 120 BPM).
3. **Given** a score with no explicit tempo marking, **When** the user opens the score, **Then** the playback tempo defaults to 120 BPM as a safe fallback.

---

### User Story 2 - Snap-to-Score Tempo After Manual Adjustment (Priority: P2)

After a user manually adjusts the playback tempo (e.g., slows it down to 50 BPM to practice a difficult passage), they should be able to instantly reset back to the tempo defined by the score with a single action, without needing to remember what the original tempo was.

**Why this priority**: Users frequently change tempo during practice. Being able to quickly restore the score's intended tempo is an important workflow convenience, but only makes sense once the score's tempo is correctly read (P1).

**Independent Test**: Can be tested independently by: (1) loading a score with a 90 BPM marking, (2) changing the playback tempo to 60 BPM, (3) triggering the "snap to score tempo" action, and (4) verifying the tempo returns to 90 BPM.

**Acceptance Scenarios**:

1. **Given** a score with a 90 BPM marking and a user who has changed playback tempo to 60 BPM, **When** the user triggers the "snap to score tempo" action, **Then** the playback tempo resets to 90 BPM.
2. **Given** a score with no tempo marking (defaulting to 120 BPM) and a user who has changed tempo to 80 BPM, **When** the user triggers the snap action, **Then** the playback tempo returns to 120 BPM.

---

### Edge Cases

- What happens when a score has **no tempo marking**? → Fallback to 120 BPM (standard musical convention).
- What happens when a score's stored tempo is **outside the supported range** (e.g., 5 BPM or 1000 BPM)? → Silently clamp to the nearest boundary (20 or 400 BPM) with no notice shown. Out-of-range tempos in real scores are vanishingly rare.
- What happens when the user has changed the playback tempo and then **loads a different score**? → Playback stops immediately; the new score's tempo overrides any prior manual adjustment, and the system is ready to play from the beginning at the new score's tempo.
- What happens with a score that has **multiple tempo changes** within it (e.g., a slow intro followed by a fast main section)? → Only the tempo at the start of the score (tick 0) is used as the initial playback tempo for this feature; mid-score tempo changes are considered a future enhancement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a score is loaded, the system MUST read the tempo value stored in the score's structural events and use it as the initial playback tempo.
- **FR-002**: The score's tempo MUST be reflected in the playback tempo indicator before the user presses Play.
- **FR-003**: When no tempo is defined in a score, the system MUST use 120 BPM as the default playback tempo.
- **FR-004**: When the score's stored tempo falls outside the valid playback range (20–400 BPM), the system MUST silently clamp it to the nearest boundary with no notice shown to the user.
- **FR-005**: Users MUST be able to trigger a "snap to score tempo" action that immediately restores the playback tempo to the value defined in the currently loaded score AND resets the tempo multiplier to 1.0× — so the user hears exactly the composer's marked tempo.
- **FR-006**: When a different score is loaded, the system MUST stop any active playback immediately, then set the playback tempo to the newly loaded score's tempo (resetting any prior manual adjustments), ready to play from the beginning.

### Key Entities

- **Score Tempo**: The tempo value (in beats per minute) embedded in a score at its starting position. Represents the composer's/arranger's intended playback speed. Valid range: 20–400 BPM. Falls back to 120 BPM when absent.
- **Playback Tempo**: The currently active tempo used by the playback engine. May differ from the Score Tempo if the user has manually adjusted it. Can always be snapped back to the Score Tempo.

## Assumptions

- Only the tempo at the very start of the score (position 0) is considered for this feature. Handling mid-score tempo changes is out of scope.
- The "snap to score tempo" action is triggered through an existing or minimal UI affordance (e.g., a button near the tempo control); the exact visual design is left to implementation.
- Scores created before this feature is implemented may lack stored tempo events; these will correctly fall back to 120 BPM.
- MusicXML files that include `<sound tempo="..."/>` elements already carry a parseable tempo value and will benefit immediately.
- The snap action resets **both** the base BPM and the tempo multiplier to their neutral values (score BPM + 1.0×), so the audible result equals the score's marked tempo exactly.

## Clarifications

### Session 2026-03-11

- Q: When "Snap to Score Tempo" is triggered, what happens to the tempo multiplier? → A: Reset both the base BPM to the score's tempo AND the multiplier to 1.0×, so the user hears exactly the marked tempo.
- Q: When a user is mid-playback and loads a different score, what happens? → A: Stop playback immediately and load the new score from the beginning at its tempo.
- Q: When a score's stored tempo is outside the valid range, should the user be notified? → A: No — silently clamp to the nearest boundary (20 or 400 BPM), no notice shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of loaded scores with an explicit tempo marking play back at that tempo — not at 120 BPM — on first load with no user adjustment.
- **SC-002**: The correct score tempo is displayed in the playback tempo indicator within 500 milliseconds of the score finishing loading.
- **SC-003**: The snap-to-score-tempo action restores the correct tempo in a single interaction with no additional confirmation steps.
- **SC-004**: Scores without explicit tempo markings continue to default to 120 BPM, with no regression in existing behaviour.

