# Feature Specification: Save and Load Practices

**Feature Branch**: `056-save-load-practices`  
**Created**: 2025-03-25  
**Status**: Draft  
**Input**: User description: "When the user ends a practice, in the results overlay a new button next to Replay must be added to save the practice. The name of the saved practice must be: score_name-RH/LH/BH-all/region-datetime. The saved practices must appear as a new collapsed section in the load score dialog. From this section, practices can be loaded to reproduce them. They can also be removed. The practices must be ordered by date."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Completed Practice (Priority: P1)

A user finishes practicing a piece (or a region of a piece) and wants to save the practice session so they can review it later. After the practice ends and the results overlay appears, the user clicks a "Save" button located next to the existing Replay button. The practice is saved with an automatically generated name following the convention `score_name-RH/LH/BH-all/region-datetime` and the user sees confirmation that the practice was saved.

**Why this priority**: This is the foundational action—without the ability to save practices, there is nothing to load or manage. It is the core value of the feature.

**Independent Test**: Can be fully tested by completing a practice session and clicking Save. Delivers immediate value by persisting the practice for future reference.

**Acceptance Scenarios**:

1. **Given** the user has completed a full practice of "Fur Elise" with Right Hand selected and no loop region, **When** the user clicks "Save" in the results overlay, **Then** the practice is saved with the name `Fur_Elise-RH-all-20250325T143022` and the button text changes to "✓ Saved" (disabled).
2. **Given** the user has completed a practice of "Arabesque" with Both Hands on a specific region (measures 5–12), **When** the user clicks "Save", **Then** the practice is saved with the name `Arabesque-BH-region-20250325T150500`.
3. **Given** the user has stopped a practice mid-session (partial results), **When** the results overlay appears, **Then** the "Save" button is available and the partial practice can be saved.
4. **Given** the user has already saved a practice, **When** viewing the results overlay, **Then** the Save button shows "✓ Saved" in a disabled state and cannot be clicked again.

---

### User Story 2 - Load a Saved Practice (Priority: P2)

A user wants to revisit a past practice session. They open the load score dialog and see a new collapsed section titled "Saved Practices". Upon expanding it, they see a list of previously saved practices ordered by date (most recent first). The user selects a saved practice to load it and replay the performance.

**Why this priority**: Loading is the primary reason users save practices—to review past performances. Without this, saving has no purpose.

**Independent Test**: Can be tested by first saving a practice, then opening the load dialog, expanding "Saved Practices", and selecting a saved practice. The practice is loaded and the user can replay it.

**Acceptance Scenarios**:

1. **Given** the user has previously saved at least one practice, **When** the user opens the load score dialog, **Then** a collapsed "Saved Practices" section is visible in the left panel.
2. **Given** the "Saved Practices" section is collapsed, **When** the user clicks to expand it, **Then** a list of saved practices is shown ordered by date (most recent first), each displaying the practice name.
3. **Given** the list of saved practices is visible, **When** the user selects a saved practice, **Then** the corresponding score is loaded with the same hand selection and region, and the results overlay appears immediately displaying the saved performance stats with the Replay button ready.
4. **Given** no practices have been saved yet, **When** the user opens the load score dialog, **Then** the "Saved Practices" section is either hidden or shows an empty state message such as "No saved practices yet".

---

### User Story 3 - Delete a Saved Practice (Priority: P3)

A user wants to remove an old or unwanted saved practice from their list. In the "Saved Practices" section of the load score dialog, each practice entry has a delete action. The user deletes a practice and it is removed from the list and from storage.

**Why this priority**: Management of saved practices is important to prevent clutter, but it is secondary to the core save/load functionality.

**Independent Test**: Can be tested by saving a practice, opening the load dialog, and deleting it. The practice should disappear from the list.

**Acceptance Scenarios**:

1. **Given** the user has expanded the "Saved Practices" section, **When** they click the delete action on a saved practice, **Then** the practice is removed from the list and from persistent storage.
2. **Given** the user deletes the last remaining saved practice, **When** the deletion completes, **Then** the section shows an empty state or hides.
3. **Given** the user accidentally deletes a practice, **Then** the deletion is immediate (no confirmation dialog is required for this initial version).

---

### Edge Cases

- What happens when the score name contains special characters (accents, apostrophes, long names)? The name should be sanitized to replace non-alphanumeric characters with underscores, and truncated if excessively long.
- What happens when browser storage is full? The save operation should fail gracefully with a user-visible message explaining that storage is full.
- What happens when a saved practice references a score that has since been deleted from "My Scores"? The practice entry should still appear in the list. On load, the system matches by score type + unique ID (filename for preloaded, IndexedDB ID for user-uploaded). Preloaded scores always resolve successfully. If a user-uploaded score's ID no longer exists in IndexedDB, display a message indicating the original score is no longer available.
- What happens when the user has many saved practices (e.g., 50+)? The list should remain scrollable and performant. An upper limit of 100 saved practices is applied, with the oldest being evicted when the limit is exceeded.
- What happens if the user saves after a partial practice (stopped mid-session)? The partial performance record is saved and marked as partial so it is distinguishable from completed sessions.
- What happens with the datetime component across time zones? The datetime is captured in the user's local time zone at the moment of saving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Save" button in the results overlay, positioned in the same row as the existing Repractice and Replay buttons.
- **FR-002**: System MUST generate the saved practice name using the format `{score_name}-{hand}-{scope}-{datetime}` where:
  - `{score_name}` is the title of the practiced score with spaces replaced by underscores and special characters sanitized
  - `{hand}` is one of `RH` (right hand, staff index 0), `LH` (left hand, staff index 1), or `BH` (both hands, staff index -1)
  - `{scope}` is `all` when no loop region is active, or `region` when a loop region is active
  - `{datetime}` is the local date and time in ISO-like compact format (e.g., `20250325T143022`)
- **FR-003**: System MUST persist saved practices in the browser's local storage, surviving page refreshes and browser restarts.
- **FR-004**: System MUST store the full performance data (note results, wrong note events, BPM, and timing information) for each saved practice so it can be replayed.
- **FR-005**: System MUST store the practice context alongside each saved practice, including: score type (preloaded or user-uploaded), score unique identifier (filename for preloaded scores, IndexedDB ID for user-uploaded scores), score title, hand selection, loop region boundaries (if any), tempo multiplier, and loop count.
- **FR-006**: System MUST display a "Saved Practices" section in the load score dialog as a collapsible section (collapsed by default) in the left panel.
- **FR-007**: System MUST list saved practices ordered by date of saving, most recent first.
- **FR-008**: System MUST allow users to select a saved practice from the list to load the associated score with the same hand and region configuration, and immediately display the results overlay with the saved performance stats and Replay button ready.
- **FR-009**: System MUST allow users to delete individual saved practices from the list.
- **FR-010**: System MUST prevent duplicate saves of the same practice session. After a successful save, the button text changes to "✓ Saved" and the button remains in a disabled state for the rest of the session.
- **FR-011**: System MUST enforce a maximum of 100 saved practices, automatically removing the oldest entry when the limit is exceeded.
- **FR-012**: System MUST support saving both complete and partial (stopped mid-session) practice results.
- **FR-013**: System MUST visually distinguish partial practices from completed practices in the saved practices list (e.g., with a label or icon).
- **FR-014**: The "Save" button MUST also be available in the partial results overlay (when a user stops practice mid-session).

### Key Entities

- **Saved Practice**: A persisted record of a completed or partially-completed practice session. Attributes: unique identifier, generated name, save date, score type (preloaded or user-uploaded), score unique reference (filename for preloaded, IndexedDB ID for user-uploaded), score title, hand selection, loop region (optional), performance data (notes, note results, wrong note events, BPM), tempo multiplier, loop count, completion status (complete or partial), and for partial practices the stopped-at index and total note count.
- **Saved Practices Index**: A lightweight list of saved practice metadata (identifier, name, date, completion status) used for fast listing in the load score dialog without loading full performance data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can save a completed practice in under 2 seconds (from clicking Save to seeing confirmation).
- **SC-002**: Users can find and load a previously saved practice within 10 seconds of opening the load score dialog.
- **SC-003**: The saved practices list displays correctly with up to 100 entries without noticeable delay or scroll lag.
- **SC-004**: 100% of saved practices can be successfully loaded and replayed with the correct hand selection, region, and performance data.
- **SC-005**: Deleting a saved practice removes it immediately from the list and frees the associated storage.
- **SC-006**: Saved practices persist across page refreshes, browser restarts, and tab closures.

## Assumptions

- The practice name format (`score_name-RH/LH/BH-all/region-datetime`) is auto-generated and not user-editable. If user-editable names are desired in the future, that is a separate enhancement.
- The "Saved Practices" section is placed below the existing sections (Preloaded Scores, Score Groups, My Scores) in the load score dialog's left panel.
- No server-side persistence is required; all data is stored locally in the browser, consistent with the existing storage architecture.
- The 100-practice limit with oldest-first eviction provides a reasonable balance between storage usage and user utility without requiring manual cleanup.
- When loading a saved practice, the system loads the original score, restores the hand and region settings, and immediately shows the results overlay with the saved stats and Replay button. It does not automatically start replaying.
- The datetime in the practice name uses the user's local time zone without explicit zone indicator, since it is for display/identification purposes only.

## Clarifications

### Session 2026-03-25

- Q: When a user selects a saved practice from the list, what state should the app enter? → A: Show the results overlay immediately (score, stats, Replay button) after loading the score.
- Q: How should the system identify and reference the original score when loading a saved practice? → A: Store score type (preloaded/user-uploaded) + unique ID (filename for preloaded, IndexedDB ID for user-uploaded) for precise matching on load.
- Q: What kind of visual feedback should the user see after clicking Save? → A: Inline button state change — button text becomes "✓ Saved" and stays disabled (no toast or popup).

