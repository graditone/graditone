# Tasks: Save and Load Practices

**Input**: Design documents from `/specs/056-save-load-practices/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan.md specifies TDD workflow per Constitution Principle V (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (frontend-only feature)**: `frontend/src/`, `frontend/tests/`, `frontend/plugins/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared type definitions used by all subsequent phases

- [x] T001 Create shared TypeScript interfaces (ScoreRef, SavedPerformanceData, SavedPractice, SavedPracticeIndexEntry) in `frontend/src/services/savedPractice.types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Storage layer and utility functions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Bump IndexedDB version from 1 to 2 and add `practices` object store in `frontend/src/services/storage/local-storage.ts`
- [x] T003 [P] Implement `listSavedPractices()`, `addSavedPracticeIndex()`, and `removeSavedPracticeIndex()` in `frontend/src/services/savedPracticeIndex.ts`
- [x] T004 [P] Implement `savePracticeToIndexedDB()`, `loadPracticeFromIndexedDB()`, `deletePracticeFromIndexedDB()`, and `generatePracticeName()` in `frontend/src/services/savedPracticeStorage.ts`
- [x] T005 [P] Write unit tests for savedPracticeIndex (list, add, remove, eviction at 100 limit, date ordering) in `frontend/tests/services/savedPracticeIndex.test.ts`
- [x] T006 [P] Write unit tests for savedPracticeStorage (save, load, delete, generatePracticeName sanitization/formatting) in `frontend/tests/services/savedPracticeStorage.test.ts`

**Checkpoint**: Storage layer ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Save a Completed Practice (Priority: P1) 🎯 MVP

**Goal**: User completes a practice and clicks "Save" in the results overlay. Practice is persisted with auto-generated name. Button shows "✓ Saved" (disabled).

**Independent Test**: Complete a practice session → results overlay appears → click Save → button changes to "✓ Saved" (disabled). Refresh page → practice persists in storage.

### Implementation for User Story 1

- [x] T007 [P] [US1] Add `onSave` and `isSaved` props to ResultsOverlay, render "Save" button (💾 Save / ✓ Saved) in `.practice-results__replay-row` in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`
- [x] T008 [P] [US1] Add Save button styles (44×44px touch target, disabled state) in `frontend/plugins/practice-view-plugin/ResultsOverlay.css`
- [x] T009 [US1] Wire save callback in PracticeViewPlugin: build SavedPractice object from current practice state, call storage services, manage `isSaved` flag (reset on new practice) in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: User Story 1 fully functional — save a practice from the results overlay and verify it persists in IndexedDB + localStorage index

---

## Phase 4: User Story 2 — Load a Saved Practice (Priority: P2)

**Goal**: User opens the load score dialog, expands the "Saved Practices" section, and selects a practice to load the score with restored settings and results overlay displayed immediately.

**Independent Test**: Save a practice → open load score dialog → expand "Saved Practices" → select saved practice → score loads with same hand/region → results overlay appears with saved stats and Replay button.

### Tests for User Story 2

- [x] T010 [P] [US2] Write component tests for SavedPracticeList (render list ordered by date, select fires callback, delete fires callback, empty state returns null, partial badge renders) in `frontend/tests/components/SavedPracticeList.test.tsx`

### Implementation for User Story 2

- [x] T011 [P] [US2] Create SavedPracticeList component with collapsible `<details>/<summary>` section, `<ul role="list">` sorted by date descending, select button per item, partial practice badge, returns null when empty in `frontend/src/components/load-score/SavedPracticeList.tsx`
- [x] T012 [P] [US2] Create SavedPracticeList styles (collapsible section, list items, 44×44px touch targets, partial badge) in `frontend/src/components/load-score/SavedPracticeList.css`
- [x] T013 [US2] Add `savedPractices`, `onSelectSavedPractice`, and `onDeleteSavedPractice` props to LoadScoreDialog and render SavedPracticeList section below existing sections in `frontend/src/components/load-score/LoadScoreDialog.tsx`
- [x] T014 [US2] Wire load flow in PracticeViewPlugin: on saved practice selection → load referenced score (preloaded or user) → restore staffIndex, loopRegion, tempoMultiplier, loopCount → set performanceRecord from saved data → show resultsOverlay in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: User Stories 1 AND 2 both work — save a practice, then load it from the dialog and see results overlay with saved stats

---

## Phase 5: User Story 3 — Delete a Saved Practice (Priority: P3)

**Goal**: User removes unwanted practices from the "Saved Practices" list. Deletion removes from both localStorage index and IndexedDB.

**Independent Test**: Save a practice → open load dialog → expand "Saved Practices" → click delete on a practice → practice disappears from list and is removed from storage. Delete last practice → section shows empty state or hides.

### Implementation for User Story 3

- [x] T015 [US3] Wire delete handler through PracticeViewPlugin → LoadScoreDialog → SavedPracticeList: call `removeSavedPracticeIndex()` + `deletePracticeFromIndexedDB()`, refresh list state in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [x] T016 [US3] Verify empty state after deleting last practice (section hides) in `frontend/src/components/load-score/SavedPracticeList.tsx`

**Checkpoint**: All three user stories functional — save, load, and delete practices

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling and final validation

- [x] T017 [P] Handle edge case: saved practice references a deleted user-uploaded score — show "score unavailable" message on load attempt in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [x] T018 [P] Handle edge case: IndexedDB storage-full error on save — catch error, show user message, re-enable Save button in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [x] T019 Run quickstart.md validation: verify full save → load → replay → delete flow end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types from T001) — BLOCKS all user stories
- **US1 Save (Phase 3)**: Depends on Phase 2 completion (storage services)
- **US2 Load (Phase 4)**: Depends on Phase 2 completion (storage services). Independent of US1 code, but logically needs saved data to test
- **US3 Delete (Phase 5)**: Depends on Phase 4 (SavedPracticeList component exists with delete button)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Save)**: Can start after Phase 2. No code dependencies on other stories
- **US2 (Load)**: Can start after Phase 2. Independent of US1 code (different files). Test requires saved practices from US1 flow
- **US3 (Delete)**: Depends on US2 (uses SavedPracticeList component). Wires delete handler that US2 renders but doesn't implement

### Within Each User Story

- Tests written and failing before implementation (Constitution Principle V)
- Services/utilities before UI components
- UI components before integration wiring
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2** (after T002):
- T003, T004, T005, T006 can all run in parallel (different files, independent services)

**Phase 3** (US1):
- T007 + T008 in parallel (ResultsOverlay.tsx + ResultsOverlay.css)
- T009 after T007 (needs new props defined)

**Phase 4** (US2):
- T010 + T011 + T012 in parallel (test file + component + CSS)
- T013 after T011 (needs SavedPracticeList component)
- T014 after T013 (needs LoadScoreDialog wired)

**Phase 6**:
- T017 + T018 in parallel (independent edge cases)

---

## Parallel Example: User Story 1

```text
# Can run in parallel (different files):
T007: Add Save button + props to ResultsOverlay.tsx
T008: Add Save button styles to ResultsOverlay.css

# Then sequentially:
T009: Wire save callback in PracticeViewPlugin.tsx (depends on T007)
```

## Parallel Example: User Story 2

```text
# Can run in parallel (different files):
T010: Write SavedPracticeList tests
T011: Create SavedPracticeList component
T012: Create SavedPracticeList styles

# Then sequentially:
T013: Integrate into LoadScoreDialog (depends on T011)
T014: Wire load flow in PracticeViewPlugin (depends on T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T006)
3. Complete Phase 3: User Story 1 — Save (T007–T009)
4. **STOP and VALIDATE**: Save a practice from the results overlay, verify persistence
5. Delivers core value: practices are being saved

### Incremental Delivery

1. Setup + Foundational → Storage ready
2. Add US1 (Save) → Test independently → **MVP delivered!**
3. Add US2 (Load) → Test independently → Full save+load cycle works
4. Add US3 (Delete) → Test independently → Complete practice management
5. Polish → Edge cases handled, validation complete
6. Each story adds value without breaking previous stories
