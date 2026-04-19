# Tasks: User Profile Support

**Input**: Design documents from `/specs/080-user-profile-support/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Phase 10 covers 79 unit tests across 6 test files for all profile services and components.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the profile services module and core data types

- [x] T001 Create Profile type and validation helpers in `frontend/src/services/profiles/types.ts`
- [x] T002 Create ScopedStorage helper (profile-prefixed localStorage read/write) in `frontend/src/services/profiles/profileStorage.ts`
- [x] T003 Create ProfileManager service (CRUD, active profile, migration, cross-tab sync) in `frontend/src/services/profiles/profileManager.ts`
- [x] T004 Create ProfileContext React context and provider in `frontend/src/services/profiles/ProfileContext.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Upgrade IndexedDB schema and migrate existing state — MUST complete before user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Upgrade IndexedDB `graditone-db` from v4 to v5 in `frontend/src/services/storage/local-storage.ts` — add `profileId` field and index to all stores (scores, practices, sessions, goals) per `contracts/indexeddb-schema-v5.md`
- [x] T006 Implement one-time migration logic in `frontend/src/services/profiles/profileManager.ts` — create default profile, prefix existing localStorage keys, backfill `profileId` on IndexedDB records, set `graditone-profiles-migrated` flag
- [x] T007 Integrate ProfileContext provider and `migrateIfNeeded()` call at app startup in `frontend/src/App.tsx`
- [x] T008 [P] Update `frontend/src/services/userScoreIndex.ts` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `graditone-user-scores-index` key
- [x] T009 [P] Update `frontend/src/services/savedPracticeIndex.ts` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `graditone-saved-practices-index` key
- [x] T010 [P] Update `frontend/src/services/playback/ToneAdapter.ts` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `graditone:volume:master` key
- [x] T011 [P] Update `frontend/src/plugins/train-view/TrainPlugin.tsx` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `train-complexity-level-v1` key
- [x] T012 [P] Update `frontend/src/plugins/train-view/savedTrainIndex.ts` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `graditone-saved-trains-index` key
- [x] T013 [P] Update `frontend/src/components/IOSInstallModal.tsx` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `ios-install-dismissed` key
- [x] T014 [P] Update `frontend/src/components/AndroidInstallBanner.tsx` — replace direct `localStorage.getItem/setItem` calls with ScopedStorage for the `android-install-banner-dismissed` key
- [x] T015 Update all IndexedDB query functions in `frontend/src/services/storage/local-storage.ts` — filter by `profileId` using the new index (saveScoreToIndexedDB, loadScoreFromIndexedDB, listScoreIdsFromIndexedDB, and equivalent practice/session/goal functions)

**Checkpoint**: Foundation ready — all storage is profile-scoped, migration works, app starts with ProfileContext. User story implementation can now begin.

---

## Phase 3: User Story 3 — First-Time User Gets a Default Profile (Priority: P2) 🎯 MVP

**Goal**: On first launch (or upgrade), a default profile is created automatically. Existing data is migrated. The user experience is identical to pre-profile behavior.

**Independent Test**: Clear all app data, open Graditone, verify default profile created silently and demo score works. Also: existing user data is preserved in the default profile after upgrade.

> Note: This story is implemented first (before US1/US2/US4) because the migration and default profile logic from Phase 2 already delivers it. This phase validates it end-to-end.

- [x] T016 [US3] Verify app startup flow: default profile creation, migration of pre-existing localStorage keys, and IndexedDB record backfill — validate in `frontend/src/App.tsx` that ProfileContext initializes correctly
- [x] T017 [US3] Verify backward compatibility: ensure all features (score loading, playback, practice, volume, train plugin) function identically under the default profile in `frontend/src/App.tsx`

**Checkpoint**: First-time and upgrading users get a seamless default profile experience.

---

## Phase 4: User Story 4 — Profile Icon Always Visible (Priority: P1)

**Goal**: A profile icon appears at the rightmost position on every page (landing, score viewer, plugins), showing the active profile name. Tapping opens the profile panel.

**Independent Test**: Navigate to landing page, load a score, open a plugin — verify profile icon visible in rightmost position on each page.

- [x] T018 [P] [US4] Create ProfileIcon component (icon button + active profile name indicator) in `frontend/src/components/ProfileIcon.tsx`
- [x] T019 [P] [US4] Create ProfilePanel component (dropdown listing profiles, highlight active, "Create new profile" button, close-on-outside-click) in `frontend/src/components/ProfilePanel.tsx`
- [x] T020 [US4] Add ProfileIcon to the landing page at top-right position in `frontend/src/components/LandingScreen.tsx`
- [x] T021 [US4] Add ProfileIcon to the score toolbar (after existing buttons in `toolbar-right`) in `frontend/src/components/ScoreViewer.tsx`
- [x] T022 [US4] Add ProfileIcon to plugin views via the PluginView wrapper in `frontend/src/App.tsx`
- [x] T023 [US4] Add CSS styles for ProfileIcon and ProfilePanel (44×44px touch target, responsive, rightmost positioning) in `frontend/src/components/ProfileIcon.css` and `frontend/src/components/ProfilePanel.css`

**Checkpoint**: Profile icon visible on all pages. Tapping opens the panel with profile list. No profile operations yet (just viewing).

---

## Phase 5: User Story 1 — Switch Between Profiles (Priority: P1)

**Goal**: Users can switch profiles from the panel. All app state (scores, practices, volume, plugin settings) reflects the selected profile. Playback stops on switch. Cross-tab sync works.

**Independent Test**: Create two profiles, add a score to one, switch to the other, verify the score is not visible. Switch in one tab and verify the other tab updates.

- [x] T024 [US1] Wire switchProfile action in ProfilePanel — call `profileManager.switchProfile()`, stop playback, navigate to landing in `frontend/src/components/ProfilePanel.tsx`
- [x] T025 [US1] Implement cross-tab sync listener (window `storage` event) in ProfileContext — on `graditone-active-profile` change, reload profile state and navigate to landing in `frontend/src/services/profiles/ProfileContext.tsx`
- [x] T026 [US1] Ensure score viewer reloads "My Scores" for the new profile after switch — verify `useUserScores` hook reads from scoped storage in `frontend/src/hooks/useUserScores.ts`
- [x] T027 [US1] Ensure ToneAdapter reloads persisted volume for the new profile after switch in `frontend/src/services/playback/ToneAdapter.ts`

**Checkpoint**: Profile switching works end-to-end. State is isolated. Cross-tab sync operational.

---

## Phase 6: User Story 2 — Create a New Profile (Priority: P1)

**Goal**: Users can create a new profile with a display name from the profile panel. The new profile starts with clean state and becomes active immediately.

**Independent Test**: Tap profile icon → "Create new profile" → enter name → confirm → verify clean state (no scores, default volume, demo score available).

- [x] T028 [US2] Add "Create new profile" flow to ProfilePanel — name input field, confirm/cancel buttons, validation feedback in `frontend/src/components/ProfilePanel.tsx`
- [x] T029 [US2] Wire create action to `profileManager.createProfile()` — validate name, create profile, switch to it in `frontend/src/components/ProfilePanel.tsx`
- [x] T030 [US2] Verify new profile starts with clean state — no scoped localStorage keys, no IndexedDB records for new profileId, demo score loads in `frontend/src/App.tsx`

**Checkpoint**: New profiles can be created. Each starts fresh with demo score.

---

## Phase 7: User Story 5 — Delete a Profile (Priority: P3)

**Goal**: Users can delete a profile and all its data. Cannot delete the last profile. If active profile is deleted, switch to another.

**Independent Test**: Create a second profile, add data, delete it, verify data removed and profile gone from list.

- [x] T031 [US5] Add delete action (trash icon per profile row, disabled for last profile) to ProfilePanel in `frontend/src/components/ProfilePanel.tsx`
- [x] T032 [US5] Add confirmation dialog before delete in `frontend/src/components/ProfilePanel.tsx`
- [x] T033 [US5] Implement data cleanup in `profileManager.deleteProfile()` — remove all scoped localStorage keys for the profile and delete all IndexedDB records with matching profileId in `frontend/src/services/profiles/profileManager.ts`
- [x] T034 [US5] If deleted profile was active, switch to next available profile in `frontend/src/services/profiles/profileManager.ts`

**Checkpoint**: Profile deletion works with full data cleanup. Cannot delete last profile.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Profile renaming (FR-012), edge case handling, and final integration

- [x] T035 [P] Add rename action to ProfilePanel — inline edit of profile name with validation in `frontend/src/components/ProfilePanel.tsx`
- [x] T036 [P] Wire rename to `profileManager.renameProfile()` in `frontend/src/services/profiles/profileManager.ts`
- [x] T037 [P] Handle storage corruption edge case — if `graditone-profiles` is corrupt/empty on load, fall back to creating a new default profile with a warning in `frontend/src/services/profiles/profileManager.ts`
- [x] T038 Handle storage quota exceeded on profile creation — catch QuotaExceededError and show user-friendly error message in `frontend/src/components/ProfilePanel.tsx`
- [x] T039 Ensure profile icon z-index and positioning don't conflict with existing UI overlays (score picker dialog, plugin modals) in `frontend/src/components/ProfileIcon.css`

---

## Phase 9: External Plugin Profile Integration (FR-013, FR-014, FR-015)

**Purpose**: Extend the Plugin API with profile storage helpers and update external plugins (Sessions Plugin) to scope their data per profile. Ensure external plugins import only from the Plugin API barrel.

**Independent Test**: Create two profiles, open Sessions in profile A, create a session. Switch to profile B, verify no sessions visible. Switch back to A, verify sessions are present.

- [x] T040 [P] Export `scopedGetItem`, `scopedSetItem`, `scopedRemoveItem`, and `getActiveProfileId` from `frontend/src/plugin-api/index.ts` (FR-013)
- [x] T041 [P] Export `ProfileIcon` component from `frontend/src/plugin-api/index.ts` so external plugins can render it in their toolbars (FR-013)
- [x] T042 Add `profileId` field to `Session` and `SessionIndexEntry` types in `plugins-external/sessions-plugin/sessionTypes.ts` (FR-014)
- [x] T043 Add `profileId` field to `Goal` and `GoalIndexEntry` types in `plugins-external/sessions-plugin/goalTypes.ts` (FR-014)
- [x] T044 Update `sessionStorage.ts` — replace `localStorage.getItem/setItem` with `scopedGetItem/scopedSetItem` for the sessions index key, tag saved sessions with `profileId`, filter `loadAllSessionsFromIndexedDB` by `profileId` index (FR-014)
- [x] T045 Update `goalStorage.ts` — replace `localStorage.getItem/setItem` with `scopedGetItem/scopedSetItem` for the goals index key, tag saved goals with `profileId`, filter `loadAllGoalsFromIndexedDB` by `profileId` index (FR-014)
- [x] T046 Add `ProfileIcon` to all three toolbar variants in `plugins-external/sessions-plugin/SessionsPlugin.tsx` — import via Plugin API barrel only (FR-013)
- [x] T047 Add `flex: 1` to `.sessions-plugin__toolbar-title` CSS so the profile icon aligns to the right of the toolbar in `plugins-external/sessions-plugin/SessionsPlugin.css`
- [x] T048 Add Vite `resolve.alias` in `frontend/vite.config.ts` to map `../../frontend/src/plugin-api` to the local worktree `src/plugin-api`, ensuring symlinked external plugins resolve correctly in production builds (FR-015)

**Checkpoint**: Sessions Plugin fully profile-aware — sessions and goals are scoped per profile, profile icon visible in all session views, builds succeed with symlinked plugins.

---

## Phase 10: Profile Tests (Constitution V — Test-First Development)

**Purpose**: Unit tests for all profile services and components. Addresses missing test coverage to comply with Constitution Principle V.

- [x] T049 [P] Unit tests for `validateProfileName` and `generateProfileId` in `frontend/src/services/profiles/types.test.ts` (8 tests)
- [x] T050 [P] Unit tests for scoped storage helpers (`scopedGetItem`, `scopedSetItem`, `scopedRemoveItem`, `migrateKeyToProfile`, `removeAllScopedKeys`) in `frontend/src/services/profiles/profileStorage.test.ts` (16 tests)
- [x] T051 [P] Unit tests for `profileManager` (listProfiles, getActiveProfile, createProfile, switchProfile, renameProfile, deleteProfile, migrateIfNeeded, onProfileChange) in `frontend/src/services/profiles/profileManager.test.ts` (26 tests)
- [x] T052 [P] Unit tests for `ProfileContext` (ProfileProvider, useProfile hook, migration on mount, CRUD operations) in `frontend/src/services/profiles/ProfileContext.test.tsx` (6 tests)
- [x] T053 [P] Component tests for `ProfileIcon` (rendering, abbreviation, open/close panel, click outside) in `frontend/src/components/ProfileIcon.test.tsx` (6 tests)
- [x] T054 [P] Component tests for `ProfilePanel` (list, create, switch, rename, delete, validation, QuotaExceededError) in `frontend/src/components/ProfilePanel.test.tsx` (17 tests)

**Checkpoint**: 79 unit tests covering all profile services and UI components. All passing.

---

## Dependencies

### User Story Completion Order

```
Phase 2 (Foundation) → Phase 3 (US3: Default Profile) → Phase 4 (US4: Icon) ──┐
                                                                                ├→ Phase 8 (Polish) → Phase 9 (External Plugins)
Phase 4 (US4: Icon) → Phase 5 (US1: Switch) ──────────────────────────────────┤
Phase 4 (US4: Icon) → Phase 6 (US2: Create) ──────────────────────────────────┤
Phase 4 (US4: Icon) → Phase 7 (US5: Delete) ──────────────────────────────────┘
Phase 9 (External Plugins) → Phase 10 (Tests)
```

### Parallel Execution Opportunities

**Within Phase 1**: T001–T004 are sequential (each builds on the previous)
**Within Phase 2**: T008–T014 can all run in parallel (independent localStorage key updates in different files)
**Within Phase 4**: T018 + T019 in parallel, then T020–T022 in parallel (after components exist)
**Across Phases 5–7**: US1, US2, US5 can run in parallel after Phase 4 completes (each touches different behavior in ProfilePanel)
**Within Phase 8**: T035–T037 can run in parallel
**Within Phase 10**: T049–T054 can all run in parallel (independent test files)

## Implementation Strategy

### MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6**

This delivers:
- Default profile for existing/new users (US3)
- Profile icon visible everywhere (US4)
- Profile switching with state isolation (US1)
- New profile creation (US2)
- Cross-tab synchronization

### Incremental Delivery

1. **First increment**: Phases 1–3 — Profile infrastructure + migration (invisible to user, backward compatible)
2. **Second increment**: Phase 4 — Profile icon visible (entry point, but no actions yet beyond viewing)
3. **Third increment**: Phases 5–6 — Switch + create (full multi-profile workflow)
4. **Fourth increment**: Phases 7–8 — Delete + rename + polish
5. **Fifth increment**: Phase 9 — External plugin profile integration (Sessions Plugin scoped per profile)
6. **Sixth increment**: Phase 10 — Unit tests for all profile services and components (Constitution V compliance)

### File Change Summary

| File | Action | Phases |
|------|--------|--------|
| `frontend/src/services/profiles/types.ts` | NEW | 1 |
| `frontend/src/services/profiles/profileStorage.ts` | NEW | 1 |
| `frontend/src/services/profiles/profileManager.ts` | NEW | 1, 2, 7, 8 |
| `frontend/src/services/profiles/ProfileContext.tsx` | NEW | 1, 5 |
| `frontend/src/components/ProfileIcon.tsx` | NEW | 4 |
| `frontend/src/components/ProfileIcon.css` | NEW | 4, 8 |
| `frontend/src/components/ProfilePanel.tsx` | NEW | 4, 5, 6, 7, 8 |
| `frontend/src/components/ProfilePanel.css` | NEW | 4 |
| `frontend/src/services/storage/local-storage.ts` | MODIFY | 2 |
| `frontend/src/services/userScoreIndex.ts` | MODIFY | 2 |
| `frontend/src/services/savedPracticeIndex.ts` | MODIFY | 2 |
| `frontend/src/services/playback/ToneAdapter.ts` | MODIFY | 2, 5 |
| `frontend/src/plugins/train-view/TrainPlugin.tsx` | MODIFY | 2 |
| `frontend/src/plugins/train-view/savedTrainIndex.ts` | MODIFY | 2 |
| `frontend/src/components/IOSInstallModal.tsx` | MODIFY | 2 |
| `frontend/src/components/AndroidInstallBanner.tsx` | MODIFY | 2 |
| `frontend/src/components/LandingScreen.tsx` | MODIFY | 4 |
| `frontend/src/components/ScoreViewer.tsx` | MODIFY | 4 |
| `frontend/src/App.tsx` | MODIFY | 2, 4 |
| `frontend/src/hooks/useUserScores.ts` | MODIFY | 5 |
| `frontend/src/plugin-api/index.ts` | MODIFY | 9 |
| `frontend/vite.config.ts` | MODIFY | 9 |
| `plugins-external/sessions-plugin/sessionTypes.ts` | MODIFY | 9 |
| `plugins-external/sessions-plugin/goalTypes.ts` | MODIFY | 9 |
| `plugins-external/sessions-plugin/sessionStorage.ts` | MODIFY | 9 |
| `plugins-external/sessions-plugin/goalStorage.ts` | MODIFY | 9 |
| `plugins-external/sessions-plugin/SessionsPlugin.tsx` | MODIFY | 9 |
| `plugins-external/sessions-plugin/SessionsPlugin.css` | MODIFY | 9 |
| `frontend/src/services/profiles/types.test.ts` | NEW | 10 |
| `frontend/src/services/profiles/profileStorage.test.ts` | NEW | 10 |
| `frontend/src/services/profiles/profileManager.test.ts` | NEW | 10 |
| `frontend/src/services/profiles/ProfileContext.test.tsx` | NEW | 10 |
| `frontend/src/components/ProfileIcon.test.tsx` | NEW | 10 |
| `frontend/src/components/ProfilePanel.test.tsx` | NEW | 10 |
