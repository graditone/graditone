# Feature Specification: Bug Fix — Train View Note Overlap

**Feature Branch**: `079-fix-train-note-overlap`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "Bug fixing permanent context. The first one is in the train view: when notes are detected and show in the staff they are overlapped until the expected note is detected, generating a noisy view. What must happen is that each wrong note is removed when a new one is received."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Wrong Notes Do Not Stack on the Response Staff (Priority: P1)

A user in step mode plays the wrong note. The response staff shows that wrong note for the current slot. When the user plays another (still wrong) note, the previous wrong note is removed and only the newly played note is visible in its place. When the correct note is eventually played, the slot advances cleanly with no leftover note heads from prior attempts.

**Why this priority**: This is the primary user-facing defect. Multiple stacked note heads at the same staff position are visually noisy and confusing, making it impossible to see which note was last played and what is expected.

**Independent Test**: Can be fully tested by opening the Train plugin in step mode, playing two different wrong notes for the same slot in succession, and confirming that only one note head (the latest) appears on the response staff at any time.

**Acceptance Scenarios**:

1. **Given** the Train plugin is in step mode and the exercise is playing, **When** the user plays a wrong note for the current slot, **Then** the response staff shows exactly one note head for that slot.
2. **Given** the response staff already shows a wrong note for the current slot, **When** the user plays a different wrong note, **Then** the previously displayed note is replaced — only the new wrong note is visible.
3. **Given** the response staff shows a wrong note for the current slot, **When** the user plays the correct note, **Then** the slot advances and the response staff no longer shows any note head for the completed slot's position.
4. **Given** the user plays multiple wrong notes in sequence for the same slot, **Then** at no point are two or more note heads stacked or overlapping at the same horizontal position on the response staff.

---

### User Story 2 — Stable Display Across Many Wrong Attempts (Priority: P2)

A user who makes many mistakes before finding the correct note sees a response staff that always shows at most one note at a time — the most recent attempt. The staff does not become more cluttered with each wrong input.

**Why this priority**: Without this behaviour, a prolonged wrong-note sequence degrades the visual quality to the point where the staff is unreadable.

**Independent Test**: Can be fully tested by making five sequential wrong inputs for a single slot and verifying the note count on the response staff remains exactly one.

**Acceptance Scenarios**:

1. **Given** the user plays five sequential wrong notes for the same slot, **Then** the response staff contains exactly one note head (the fifth), not five.
2. **Given** the exercise advances to a new slot, **When** the user plays an input for the new slot, **Then** the response staff reflects only the current slot's latest input with no residue from the previous slot.

---

### Edge Cases

- What happens if two notes arrive in very rapid succession — only the latest one should remain on the response staff.
- How does the system handle notes received during the debounce window — they are already discarded by the input handler and must not appear on the staff.
- In flow mode (non-step), notes accumulate for the full timeline; this fix must not affect flow mode behaviour.
- Replay mode uses its own highlight mechanism and must remain unaffected by changes to step-mode note accumulation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In step mode, the response staff MUST display at most one note head per active exercise slot at any given moment.
- **FR-002**: When a new note input is received for the current step slot, the previous note event recorded for that slot MUST be replaced, not appended.
- **FR-003**: The replacement behaviour MUST apply only to step training mode; flow mode note accumulation MUST remain unchanged.
- **FR-004**: After a slot advances to the next exercise note (correct note detected), no note heads from that completed slot MUST remain visible on the response staff.
- **FR-005**: The fix MUST NOT alter the wrong-note penalty tracking — a slot attempted incorrectly N times before being answered correctly MUST still count as exactly one penalised slot.
- **FR-006**: Replay mode staff rendering MUST be unaffected.

### Key Entities

- **responseNoteEvents**: The ordered collection of note events passed to the response staff viewer. In step mode this MUST hold at most one entry per slot at any time.
- **ExerciseSlot**: A single expected note in the exercise sequence, identified by its onset timestamp. Wrong notes for the same slot share this timestamp and must not co-exist in `responseNoteEvents`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At no point during a step-mode exercise does the response staff display more than one note head simultaneously.
- **SC-002**: Repeated wrong-note inputs on the same slot do not increase the number of rendered note elements on the response staff above one.
- **SC-003**: Flow-mode sessions are unaffected — note accumulation over the full exercise timeline continues to work as before.
- **SC-004**: The final wrong-note penalty count remains accurate — a slot played incorrectly multiple times before being answered correctly is still counted as one penalised slot in the exercise result.

## Known Issues & Regression Tests *(if applicable)*

### Issue #1: Wrong Notes Accumulate and Overlap on the Response Staff in Step Mode

**Discovered**: 2026-04-12 during user session with the Train plugin (step mode).

**Symptom**: Each wrong note input appends a new note event to the response staff's note collection at the same timestamp (the current slot's expected onset). Because all entries share the same horizontal position in the staff layout, their note heads render on top of each other, producing a visually cluttered, stacked display. The clutter grows with every wrong attempt and persists until the correct note is played.

**Root Cause**: The step input handler unconditionally spreads all previous events when recording a new one (`setResponseNoteEvents(prev => [...prev, newEvent])`). There is no logic to discard or replace an existing entry for the current slot when a new input arrives for that same slot.

**Affected Components**:
- `frontend/plugins/train-view/TrainPlugin.tsx` — `handleStepInput` callback, specifically the `setResponseNoteEvents` call within it.

**Regression Test**: A unit test should verify that after N wrong inputs on the same slot, `responseNoteEvents` contains exactly one entry for that slot's onset timestamp, not N entries.

