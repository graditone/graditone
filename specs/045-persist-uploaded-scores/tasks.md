# Tasks: Persist Uploaded Scores

**Input**: Design documents from `/specs/045-persist-uploaded-scores/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.
**Tests**: Constitution Principle V (Test-First) requires tests written before implementation. Test tasks marked `[TEST]` must fail before the implementation task they cover is written.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- All paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Create all new files from the plan. No logic yet — just file stubs that prevent import errors in subsequent parallel work.

- [X] T001 Create `frontend/src/services/userScoreIndex.ts` with exported `UserScore` interface and stub function signatures (no implementation)
- [X] T002 [P] Create `frontend/src/hooks/useUserScores.ts` with exported stub hook returning empty arrays
- [X] T003 [P] Create `frontend/src/components/load-score/UserScoreList.tsx` with exported stub component returning `null`

**Checkpoint**: All new module imports resolve without TypeScript errors — run `cd frontend && pnpm tsc --noEmit`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core metadata index service and `UserScore` interface — shared by all three user stories. Must be complete before any user story work begins.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on `userScoreIndex.ts` being complete.

- [X] T004 [TEST] Write unit tests for `userScoreIndex.ts` in `frontend/src/test/services/userScoreIndex.test.ts` covering: `listUserScores()` returns `[]` when localStorage is empty; `addUserScore()` adds and returns an entry; `addUserScore()` deduplicates display name with numeric suffix; `removeUserScore()` removes entry by id; `getUserScore()` returns entry or undefined; index is stored sorted descending by `uploadedAt`
- [X] T005 Implement `frontend/src/services/userScoreIndex.ts` — full CRUD: `listUserScores()`, `addUserScore(id, rawDisplayName)` with deduplication logic, `removeUserScore(id)`, `getUserScore(id)` — all synchronous over `localStorage` key `graditone-user-scores-index`; export `UserScore` interface and `USER_SCORES_INDEX_KEY` constant (satisfies T004 tests)
- [X] T006 [TEST] Write unit tests for `useUserScores.ts` in `frontend/src/test/hooks/useUserScores.test.ts` covering: initial state loads from index; `addUserScore` updates state and index; `removeUserScore` updates state and index; `refreshUserScores` re-reads from index
- [X] T007 Implement `frontend/src/hooks/useUserScores.ts` — React hook wrapping `userScoreIndex` with `useState` for reactive updates; exports `{ userScores, addUserScore, removeUserScore, refreshUserScores }` (satisfies T006 tests)
- [X] T008 Export `UserScore` interface from `frontend/src/data/preloadedScores.ts` (re-export from `userScoreIndex.ts`) so all score-picker components import from a single location

**Checkpoint**: `pnpm test userScoreIndex useUserScores` — all foundational tests pass

---

## Phase 3: User Story 1 — Upload Score Persists Across Sessions (Priority: P1) 🎯 MVP

**Goal**: After a user uploads a score, it is saved to IndexedDB (full score) and the metadata index (localStorage), and survives a full page reload.

**Independent Test**: Upload any MusicXML file → refresh the page → open score picker → "My Scores" section appears with the uploaded score → select it → score renders correctly.

### Tests for User Story 1

> **Write these tests FIRST — verify they FAIL before implementing T011**

- [X] T009 [TEST] [US1] Write unit tests for `ScoreViewer` upload path in `frontend/src/test/components/ScoreViewer.upload.test.ts` covering: `ScoreCache.cache()` is called with the score after a successful import; `addUserScore()` is called with the correct `id` and `displayName`; neither is called when import fails (error path)

### Implementation for User Story 1

- [X] T010 [US1] In `frontend/src/components/ScoreViewer.tsx` `handleMusicXMLImport`: after `setScore(result.score)`, call `await ScoreCache.cache(result.score)` and `addUserScore(result.score.id, rawDisplayName)` where `rawDisplayName` is `result.metadata.work_title ?? result.metadata.file_name` (satisfies T009 tests)
- [X] T011 [US1] Integrate `useUserScores()` hook into `frontend/src/components/ScoreViewer.tsx` — destructure `userScores`, `addUserScore`, `removeUserScore` from the hook; replace direct `userScoreIndex` calls in T010 with the hook's `addUserScore`

**Checkpoint**: User Story 1 independently testable — upload a score, refresh the page, confirm `localStorage` key `graditone-user-scores-index` contains the entry and IndexedDB `scores` store has the full score.

---

## Phase 4: User Story 2 — "My Scores" Section in the Score Picker (Priority: P1)

**Goal**: Uploaded scores appear under a "My Scores" heading in both the main `LoadScoreDialog` and the plugin `ScoreSelectorPlugin`. Selecting a score from "My Scores" loads it correctly.

**Independent Test**: With a persisted score (from US1), open score picker → "My Scores" section visible below built-in scores → click an entry → score renders. Same in plugin overlay.

### Tests for User Story 2

> **Write these tests FIRST — verify they FAIL before implementing T015–T019**

- [X] T012 [TEST] [P] [US2] Write unit tests for `UserScoreList` in `frontend/src/test/components/UserScoreList.test.tsx` covering: renders "My Scores" heading when `scores.length > 0`; renders each score `displayName`; renders nothing when `scores` is empty; calls `onSelect` with correct score object on row click; calls `onDelete` with correct `id` on × button click; active row has `user-score-item--selected` class when `selectedId` matches; buttons are disabled when `disabled` prop is `true`
- [X] T013 [TEST] [P] [US2] Extend `frontend/src/test/components/ScoreViewer.upload.test.ts` with: `handleUserScoreSelect(id)` sets `isFileSourced` to `false` and updates `scoreId`; `LoadScoreDialog` receives `userScores`, `onSelectUserScore`, `onDeleteUserScore` props

### Implementation for User Story 2

- [X] T014 [P] [US2] Implement `frontend/src/components/load-score/UserScoreList.tsx` — presentational component: `<section>` with `<h3>My Scores</h3>`, `<ul role="list">` with one row per entry showing `displayName`, formatted `uploadedAt`, and `<button aria-label="Remove">×</button>`; `user-score-item--selected` class on active row; returns `null` when `scores` is empty (satisfies T012 tests)
- [X] T015 [US2] Add `handleUserScoreSelect(id: string)` to `frontend/src/components/ScoreViewer.tsx`: `setIsFileSourced(false); setSkipNextLoad(false); setScoreId(id); setDialogOpen(false)` (satisfies T013 tests)
- [X] T016 [US2] Update `frontend/src/components/load-score/LoadScoreDialog.tsx` — add `userScores`, `onSelectUserScore`, `onDeleteUserScore` props to `LoadScoreDialogProps`; render `<UserScoreList>` beneath `<PreloadedScoreList>` in the left panel, passing through props
- [X] T017 [US2] Pass `userScores`, `onSelectUserScore={handleUserScoreSelect}`, `onDeleteUserScore={handleUserScoreDelete}` from `ScoreViewer` to `<LoadScoreDialog>` in `frontend/src/components/ScoreViewer.tsx`
- [X] T018 [P] [US2] Update `frontend/src/components/plugins/ScoreSelectorPlugin.tsx` — add optional `userScores`, `onSelectUserScore`, `onDeleteUserScore` to `PluginScoreSelectorProps`; render `<UserScoreList>` after the built-in catalogue list when `userScores` is non-empty
- [X] T019 [US2] Wire `userScores`, `onSelectUserScore`, `onDeleteUserScore` from `ScoreViewer` into the plugin host context so `ScoreSelectorPlugin` receives them (identify the plugin context wiring location in `ScoreViewer.tsx` or plugin host provider)

**Checkpoint**: User Story 2 independently testable — with a persisted score (US1 complete), open score picker, see "My Scores" section, select a score, confirm it renders. Run `pnpm test UserScoreList ScoreViewer`.

---

## Phase 5: User Story 3 — Remove an Uploaded Score (Priority: P2)

**Goal**: Clicking × on a "My Scores" row removes it immediately with an undo toast. After the undo window (5s), the score is permanently deleted from IndexedDB. Undo restores the entry.

**Independent Test**: Upload a score → click × → score disappears from list, undo toast shows → click undo → score reappears → delete again without undo → refresh → score gone.

### Tests for User Story 3

> **Write these tests FIRST — verify they FAIL before implementing T022–T024**

- [X] T020 [TEST] [P] [US3] Write unit tests for `handleUserScoreDelete` in `frontend/src/test/components/ScoreViewer.upload.test.ts` covering: `removeUserScore(id)` is called immediately on delete; undo toast message is set; `deleteScoreFromIndexedDB` is NOT called immediately (deferred); calling undo cancels the deferred delete and restores the metadata entry; after undo window expires without undo, `deleteScoreFromIndexedDB(id)` is called exactly once
- [X] T021 [TEST] [P] [US3] Write E2E test in `frontend/e2e/persist-uploaded-scores.spec.ts` covering: upload a score → refresh → "My Scores" shows uploaded score → select it → score renders; upload same file twice → both appear with deduplicated names; delete a score → undo → score still in list after refresh; delete a score → no undo → score gone after refresh

### Implementation for User Story 3

- [X] T022 [US3] Implement `handleUserScoreDelete(id: string)` in `frontend/src/components/ScoreViewer.tsx`: (1) call `removeUserScore(id)` from `useUserScores` hook; (2) store deleted entry for undo; (3) show undo `successMessage`; (4) start 5s `setTimeout` → call `deleteScoreFromIndexedDB(id)` on expiry; (5) expose `handleUndoDelete` that cancels the timeout, calls `addUserScore` with the stored entry's data, and clears the message (satisfies T020 tests)
- [X] T023 [US3] Add undo button to the `success-message` display in `frontend/src/components/ScoreViewer.tsx` — render `<button onClick={handleUndoDelete}>Undo</button>` alongside the delete notification text; style inline with existing `success-message` CSS class
- [X] T024 [US3] Handle quota-exceeded error in `frontend/src/components/ScoreViewer.tsx` `handleMusicXMLImport`: catch `DOMException` with `name === 'QuotaExceededError'` from `ScoreCache.cache()` and display a user-visible warning ("Score could not be saved — storage is full") without blocking the score from rendering in the current session (FR-007)

**Checkpoint**: User Story 3 independently testable — run `pnpm test ScoreViewer` and `pnpm exec playwright test e2e/persist-uploaded-scores.spec.ts`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish line — accessibility, documentation, and spot-check of all acceptance criteria.

- [X] T025 [P] Verify all new interactive elements meet 44×44px touch target size (PWA tablet requirement) — `UserScoreList` row, × delete button
- [X] T026 [P] Add `aria-label` attributes to × delete buttons in `UserScoreList.tsx` (e.g., `aria-label={Remove ${score.displayName}}`)
- [X] T027 [P] Update `frontend/src/components/load-score/LoadScoreDialog.test.tsx` — add test that preloaded score count is still ≥6 (regression guard) and that `LoadScoreDialog` renders without error when `userScores` is an empty array
- [X] T028 Update `FEATURES.md` to document the "My Scores" persistence behaviour under the score picker section
- [X] T029 Run full test suite and E2E suite — fix any regressions: `cd frontend && pnpm test && pnpm exec playwright test`

---

## Dependencies: User Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational)
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       Phase 3 (US1)         (independent)
              │
              ▼
       Phase 4 (US2)         ← needs US1 for integration tests
              │
              ▼
       Phase 5 (US3)         ← needs US2 (delete × button lives in UserScoreList)
              │
              ▼
       Phase 6 (Polish)
```

- US1 (T009–T011): Can be delivered as MVP — score persists, survives reload
- US2 (T012–T019): Requires US1 complete; delivers the "My Scores" UI
- US3 (T020–T024): Requires US2 complete (× button is in `UserScoreList`)

---

## Parallel Execution Opportunities

Within each phase, tasks marked `[P]` operate on different files and can be run in parallel:

**Phase 2**: T004 and T006 (both write tests for different files — run concurrently)

**Phase 4**: T012 (UserScoreList unit tests) + T013 (ScoreViewer tests) can be written in parallel; T014 (UserScoreList impl) + T018 (ScoreSelectorPlugin) can be implemented in parallel after tests pass

**Phase 5**: T020 (unit tests) + T021 (E2E test) can be written in parallel

**Phase 6**: T025, T026, T027 can all run in parallel

---

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3** (T001–T011)

After just US1, the score is already persisted — a developer can verify via browser DevTools that IndexedDB and localStorage contain the entry after upload. The UI does not yet show "My Scores" but the persistence backbone is complete.

**Full delivery = all phases in order**

Each phase produces a vertically independent, testable increment. No phase is blocked on future phases. The E2E test in T021 covers the complete end-to-end flow.

---

## Format Validation

All tasks follow the required checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

| Check | Status |
|---|---|
| All tasks start with `- [ ]` | ✅ |
| All tasks have sequential IDs (T001–T029) | ✅ |
| `[P]` only on tasks that operate on different files with no blocking deps | ✅ |
| `[Story]` label on all Phase 3–5 tasks; absent in Phase 1, 2, 6 | ✅ |
| All tasks include explicit file paths | ✅ |
| Total tasks: 29 | ✅ |

**Task count by story:**
- Setup: 3 (T001–T003)
- Foundational: 5 (T004–T008)
- US1: 3 (T009–T011)
- US2: 8 (T012–T019)
- US3: 5 (T020–T024)
- Polish: 5 (T025–T029)

**Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (T001–T011) — 11 tasks, delivers core persistence with no UI changes required.
