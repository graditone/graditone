# Feature Specification: Persist Uploaded Scores

**Feature Branch**: `045-persist-uploaded-scores`  
**Created**: 2026-03-11  
**Status**: Draft  
**Input**: User description: "When you upload a score persist it and make it available with the preloaded scores at the end of the list"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload Score Persists Across Sessions (Priority: P1)

A user uploads a MusicXML or MXL score file from their device. After uploading, the score is saved locally on the device so that when the user returns to the app — even after closing the browser tab or refreshing the page — their uploaded score is still available in the score picker list, appearing after the built-in preloaded scores.

**Why this priority**: This is the core value of the feature. Without cross-session persistence, all other stories are moot. The user's primary frustration is losing their uploaded score on refresh.

**Independent Test**: Can be fully tested by uploading any MusicXML file, refreshing the page, opening the score picker, and verifying the uploaded score appears and can be reopened.

**Acceptance Scenarios**:

1. **Given** a user has no previously uploaded scores, **When** they upload a MusicXML/MXL file via the score picker, **Then** the score is immediately saved to local device storage and remains available after a page refresh.
2. **Given** a user previously uploaded a score in a past session, **When** they open the app in a new session, **Then** the score picker list includes their uploaded score(s) after the built-in preloaded scores.
3. **Given** a user uploads a score, **When** they reload the page and select that score from the list, **Then** the score renders exactly as it did when first uploaded.

---

### User Story 2 - Uploaded Scores Appear at the End of the Preloaded List (Priority: P1)

After uploading one or more scores, the score picker (in both the main app dialog and the plugin overlay) shows user-uploaded scores in a section labelled **"My Scores"** beneath the built-in preloaded catalogue. The user can select any uploaded score just like a built-in one.

**Why this priority**: This is the UX requirement stated directly in the feature description. Users need discoverability of their saved scores without hunting elsewhere.

**Independent Test**: Can be fully tested by uploading two scores, then opening the score picker and verifying: built-in scores appear first, uploaded scores appear last, both are selectable.

**Acceptance Scenarios**:

1. **Given** a user has uploaded one or more scores, **When** they open the score picker, **Then** the uploaded scores appear under a "My Scores" heading below the built-in preloaded scores.
2. **Given** the score picker is open, **When** the user clicks an uploaded score, **Then** the score loads and displays exactly as expected.
3. **Given** a user has uploaded scores, **When** they open the plugin score selector overlay, **Then** the uploaded scores appear under a "My Scores" heading at the end of the list, with a delete icon (×) per row and undo toast on deletion, identical to the main dialog.

---

### User Story 3 - Remove an Uploaded Score (Priority: P2)

A user can delete an uploaded score from their saved list. Once deleted, the score no longer appears in the score picker in any subsequent session.

**Why this priority**: Users accumulate scores over time; without deletion, storage fills up and the list becomes cluttered. This is quality-of-life but not blocking the core feature.

**Independent Test**: Can be fully tested by uploading a score, clicking the × icon on its row in the score picker, refreshing the page, and confirming it no longer appears.

**Acceptance Scenarios**:

1. **Given** a user has an uploaded score in the list, **When** they click the × icon on that score's row, **Then** the score is removed from the score picker immediately with no confirmation dialog, an undo toast is briefly shown, and the score does not reappear after a page refresh.
2. **Given** the user deletes an uploaded score, **When** they have that score currently open, **Then** the score remains visible in the current session but is removed from the saved list.
3. **Given** an undo toast is visible after deletion, **When** the user clicks undo, **Then** the score is restored to the list and to local storage.

---

### Edge Cases

- What happens when the user uploads a file that is too large to store locally? The system should warn the user that the score could not be saved due to storage limits, while still loading it for the current session.
- What happens when two uploaded scores have the same filename? Both are stored independently. The display name of the later upload is suffixed with a numeric counter (e.g., `MySong.mxl` then `MySong (2).mxl`) to ensure each entry in "My Scores" has a distinct, readable label.
- What happens when the user uploads a corrupt or invalid MusicXML file? Existing import validation handles the parse error; no save to persistent storage should occur for invalid files.
- What happens when local storage is full (quota exceeded)? The upload should be allowed for the current session, but the user is informed the score could not be saved for future sessions.
- What happens when a user clears browser data? All uploaded scores are removed. This is expected browser behavior; no special handling needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST save a successfully imported user score to local device storage immediately after a successful upload and parse.
- **FR-002**: System MUST load all previously saved user scores from local device storage on app startup and make them available in the score picker.
- **FR-003**: System MUST display user-uploaded scores in the score picker after all built-in preloaded scores, under a section heading labelled "My Scores", sorted by upload date with the most recently uploaded score first.
- **FR-004**: System MUST display uploaded scores in both the main score picker dialog and the plugin score selector overlay with full parity: "My Scores" section heading, delete icon (×) per row, and undo toast on deletion.
- **FR-005**: System MUST allow users to remove an uploaded score via a delete icon (×) on each uploaded score row; removal is immediate with no confirmation dialog and a brief undo toast is displayed.
- **FR-006**: System MUST NOT save a score to local storage if the import or parse step failed.
- **FR-007**: System MUST inform the user if a score cannot be saved due to storage limits, while still allowing use in the current session.
- **FR-008**: System MUST preserve the original filename as the display name for uploaded scores. If a score with the same filename already exists, the system MUST append a numeric counter to the display name (e.g., `MySong (2).mxl`) to ensure every entry in "My Scores" has a distinct label.

### Assumptions

- The existing local storage infrastructure (IndexedDB) is used as the persistence mechanism; no new backend API is required.
- Score content is stored as raw binary/text alongside metadata (name, upload date, unique identifier).
- There is no sync across devices; persistence is device-local only.
- No limit is enforced by the app on the number of stored scores; the browser's own storage quota applies.

### Key Entities

- **Uploaded Score**: A user-provided score file that has been successfully imported. Has: unique identifier, display name (original filename), upload timestamp, raw score content (binary/text). Ordered by upload timestamp descending (most recent first).
- **Score Catalogue Entry**: A unified representation used by the score picker to represent either a built-in preloaded score or a user-uploaded score. Distinguishes its source (built-in vs. user-uploaded).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An uploaded score survives a full page reload and is accessible from the score picker without re-uploading — verified in 100% of test cases.
- **SC-002**: Uploaded scores appear at the bottom of the score picker list in every view that shows built-in scores (main dialog and plugin overlay).
- **SC-003**: A user can go from "no uploaded scores" to "score persisted and selectable" in under 10 seconds from the time they select their file.
- **SC-004**: All previously uploaded scores are available in the score picker within 2 seconds of the app loading, regardless of how many scores are stored.
- **SC-005**: A user can successfully remove an uploaded score, and it does not reappear after the page is refreshed.

## Known Issues & Regression Tests *(if applicable)*

*None yet — to be populated during implementation.*

## Clarifications

### Session 2026-03-11

- Q: How should the delete affordance appear in the score picker for uploaded scores? → A: Delete icon (×) per row, no confirmation — immediate removal with a brief undo toast
- Q: What label/heading should appear above the uploaded scores group in the score picker? → A: "My Scores"
- Q: When a user uploads multiple scores, in what order should they appear under "My Scores"? → A: Most recently uploaded first (newest at top)
- Q: When two uploaded scores have the same filename, how should they be distinguished in the list? → A: Append a numeric counter (e.g., `MySong.mxl`, `MySong (2).mxl`, `MySong (3).mxl`)
- Q: Should "My Scores" + delete + undo toast appear in the plugin overlay as well as the main dialog? → A: Both surfaces — full parity between main dialog and plugin overlay

