# Tasks: Sessions Plugin

**Input**: Design documents from `/specs/060-sessions-plugin/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/plugin-api-v8.ts, quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Plugin directory creation and project initialization

- [x] T001 Create plugin directory structure per plan.md: `frontend/plugins/sessions-plugin/`
- [x] T002 Create plugin manifest in `frontend/plugins/sessions-plugin/plugin.json` with id `sessions-plugin`, type `core`, view `full-screen`, and appropriate order value
- [x] T003 [P] Define session domain types (`Session`, `SessionActivity`, `SessionIndexEntry`) in `frontend/plugins/sessions-plugin/sessionTypes.ts` per data-model.md entities and contracts/plugin-api-v8.ts
- [x] T004 [P] Define storage constants (`MAX_SESSIONS`, `SESSIONS_INDEX_KEY`, `SESSIONS_STORE`) in `frontend/plugins/sessions-plugin/sessionTypes.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Upgrade IndexedDB schema from v2 to v3: bump `DB_VERSION` to `3` and add `sessions` object store with `createdAt` and `status` indexes (guarded creation pattern) in `frontend/src/services/storage/local-storage.ts`
- [x] T006 Implement session IndexedDB storage functions (`saveSessionToIndexedDB`, `loadSessionFromIndexedDB`, `deleteSessionFromIndexedDB`, `loadAllSessionsFromIndexedDB`) in `frontend/plugins/sessions-plugin/sessionStorage.ts`
- [x] T007 Implement session localStorage index functions (`listSessionsIndex`, `addSessionIndex`, `updateSessionIndex`, `removeSessionIndex`, `getActiveSessionFromIndex`) with eviction logic (max 50, oldest closed first, active never evicted) in `frontend/plugins/sessions-plugin/sessionStorage.ts`
- [x] T008 Implement `computeProtectedPracticeIds()` function that scans all sessions and returns a `ReadonlySet<string>` of all `savedPracticeId` values in `frontend/plugins/sessions-plugin/sessionStorage.ts`
- [x] T009 Add `PracticeSavedEvent` type to `frontend/src/plugin-api/types.ts` per contracts/plugin-api-v8.ts (savedPracticeId, scoreTitle, completionStatus, savedAt fields)
- [x] T010 Add `onPracticeSaved(handler: (event: PracticeSavedEvent) => void): () => void` method to the `PluginContext` interface in `frontend/src/plugin-api/types.ts`
- [x] T011 Re-export `PracticeSavedEvent` from `frontend/src/plugin-api/index.ts`
- [x] T012 Bump `PLUGIN_API_VERSION` from `'7'` to `'8'` in `frontend/src/plugin-api/types.ts`
- [x] T013 Implement practice-saved subscriber list and broadcast logic in `frontend/src/App.tsx`: maintain a `practiceSavedSubscribers` set, inject `onPracticeSaved` into each `PluginContext`, and broadcast `PracticeSavedEvent` after successful practice save (after `savePracticeToIndexedDB` + `addSavedPracticeIndex`)
- [x] T014 Add `protectedPracticeIds?: ReadonlySet<string>` optional prop to `PluginScoreSelectorProps` interface in `frontend/src/plugin-api/types.ts`

**Checkpoint**: Foundation ready — IndexedDB v3 migrated, session storage operational, Plugin API v8 types defined, practice-saved event broadcasting wired, deletion guard prop defined.

---

## Phase 3: User Story 1 — Start a New Practice Session (Priority: P1) 🎯 MVP

**Goal**: Users can start a new session, which becomes "active" and automatically captures saved practices as activities.

**Independent Test**: Start a session → save a practice → verify it appears as an activity in the active session.

### Implementation for User Story 1

- [x] T015 Create `GraditonePlugin` entry point in `frontend/plugins/sessions-plugin/index.tsx`: default export with `init()` (stores context, subscribes to `onPracticeSaved`), `dispose()` (unsubscribes), and `Component` (renders `SessionsPlugin`)
- [x] T016 Implement `useSessionManager` React hook in `frontend/plugins/sessions-plugin/useSessionManager.ts`: manages sessions state, provides `startSession()`, `closeSession()`, `renameSession()`, `addActivity()`, loads sessions from storage on mount
- [x] T017 Implement `startSession()` in `useSessionManager.ts`: creates new `Session` with UUID, default name (`Session YYYY-MM-DD HH:mm`), status `active`, empty activities; enforces at-most-one-active invariant (blocks if active session exists); persists to IndexedDB + localStorage index; handles eviction if at 50-session cap
- [x] T018 Implement `onPracticeSaved` handler in `useSessionManager.ts`: on receiving `PracticeSavedEvent`, checks if an active session exists; if yes, creates a `SessionActivity` with snapshotted metadata (scoreTitle, completionStatus) and savedPracticeId; appends to active session's activities; persists updated session to IndexedDB and updates localStorage index activityCount
- [x] T019 Create main orchestrator component in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: renders "Start Session" button (disabled when active session exists), wires to `useSessionManager.startSession()`, shows empty state (FR-006) when no sessions
- [x] T020 Create styles in `frontend/plugins/sessions-plugin/SessionsPlugin.css`: base layout, start-session button, empty state message styling

**Checkpoint**: User Story 1 functional — user can start a session, and saved practices are automatically linked as activities.

---

## Phase 4: User Story 2 — View Sessions List (Priority: P2)

**Goal**: Users see a chronologically ordered list of all sessions showing name, date, status, and activity count.

**Independent Test**: Create multiple sessions → verify list shows correct metadata, order, and visual distinction for active session.

### Implementation for User Story 2

- [x] T021 [US2] Implement session list rendering in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: map `SessionIndexEntry[]` to list items showing name, formatted date, status badge, and activity count; sort by most recent first
- [x] T022 [US2] Implement active session visual distinction in `frontend/plugins/sessions-plugin/SessionsPlugin.css`: use a colored indicator or badge to differentiate active from closed sessions (FR-013)
- [x] T023 [US2] Implement inline session rename in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: tap on session name displays an editable input field; on blur/enter, calls `useSessionManager.renameSession(id, newName)` which persists to IndexedDB + updates localStorage index
- [x] T024 [US2] Implement `renameSession(id, newName)` in `useSessionManager.ts`: loads session from IndexedDB, updates name, saves back, updates localStorage index entry name

**Checkpoint**: User Story 2 functional — session list displays with correct metadata, sorting, active distinction, and rename capability.

---

## Phase 5: User Story 3 — Browse Session Activities (Priority: P3)

**Goal**: Users expand a session to see its activities and can open an activity to load the associated practice.

**Independent Test**: Select a session with activities → verify collapsible list shows activity details → tap activity to load practice.

### Implementation for User Story 3

- [x] T025 [US3] Implement collapsible activity list in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: tap session row to expand/collapse; track expanded session IDs in component state; render `SessionActivity[]` within expanded section showing scoreTitle, formatted createdAt, and completionStatus
- [x] T026 [US3] Add expand/collapse styles and activity item styles in `frontend/plugins/sessions-plugin/SessionsPlugin.css`: collapsible animation, activity row layout, completion status indicator
- [x] T027 [US3] Implement "open activity" action in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: on activity tap, call `loadPracticeFromIndexedDB(activity.savedPracticeId)` to fetch full practice, then use `context.scorePlayer.loadScore()` to load the referenced score (same flow as existing load dialog in practice plugin)
- [x] T028 [US3] Handle empty activities state in expanded session: display "No activities recorded yet" message when `session.activities.length === 0`

**Checkpoint**: User Story 3 functional — collapsible activity lists work, activity details shown, opening an activity loads the practice.

---

## Phase 6: User Story 4 — Close a Session (Priority: P4)

**Goal**: Users close the active session so no more activities are added. Session remains in list.

**Independent Test**: Start session → add activities → close session → save another practice → verify new practice is not linked.

### Implementation for User Story 4

- [x] T029 [US4] Implement "Close Session" button in `frontend/plugins/sessions-plugin/SessionsPlugin.tsx`: visible only on the active session row, calls `useSessionManager.closeSession()`
- [x] T030 [US4] Implement `closeSession()` in `useSessionManager.ts`: changes active session status to `closed`, persists to IndexedDB, updates localStorage index status; after close, `onPracticeSaved` handler will find no active session and skip activity creation
- [x] T031 [US4] Add close button styles and closed-session styling in `frontend/plugins/sessions-plugin/SessionsPlugin.css`: close button placement within active session row, visual transition from active to closed state

**Checkpoint**: User Story 4 functional — active sessions can be closed, no activities added after close, closed sessions remain visible.

---

## Phase 7: Deletion Guard & Eviction (Cross-Cutting)

**Purpose**: Protect session-linked practices from deletion and enforce 50-session cap with link release.

- [x] T032 [P] Pass `protectedPracticeIds` prop through `ScoreSelectorPlugin` to `SavedPracticeList` in `frontend/src/components/plugins/ScoreSelectorPlugin.tsx`: add prop to component signature, forward to `SavedPracticeList`
- [x] T033 Implement delete button guard in `frontend/src/components/load-score/SavedPracticeList.tsx`: when `protectedPracticeIds` set contains the practice ID, disable the delete button and show a tooltip or visual indicator explaining the practice is linked to a session
- [x] T034 Wire `protectedPracticeIds` from sessions storage into the practice plugin's `ScoreSelector` usage: compute the set via `computeProtectedPracticeIds()` and pass it as a prop when rendering `ScoreSelector` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [x] T035 Implement eviction with link release in session storage: when creating a session at the 50-cap, evict the oldest closed session from IndexedDB + localStorage index; `protectedPracticeIds` is naturally recomputed from remaining sessions, releasing evicted practices in `frontend/plugins/sessions-plugin/sessionStorage.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final quality improvements and validation

- [x] T036 [P] Verify plugin auto-discovery: confirm sessions-plugin appears in landing screen with correct icon and order
- [x] T037 [P] Handle force-close edge case: verify that active session persists across app restarts and can be resumed or closed on next open
- [x] T038 [P] Handle "start session when active exists" edge case: verify error/block message is shown per FR-016
- [x] T039 Run quickstart.md validation: verify full workflow (start session → practice → activity appears → view list → expand → load activity → close session → verify no more linking)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — foundation must be complete
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs sessions to exist for list rendering)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs activities in sessions to browse)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (needs an active session to close)
- **Deletion Guard & Eviction (Phase 7)**: Depends on Phase 2 (protectedPracticeIds) + Phase 3 (sessions with activities)
- **Polish (Phase 8)**: Depends on all previous phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories. **This is the MVP.**
- **US2 (P2)**: Depends on US1 (sessions must exist to list). Can start session list UI in parallel once types are defined, but full functionality needs US1 sessions.
- **US3 (P3)**: Depends on US1 (activities must exist within sessions to browse)
- **US4 (P4)**: Depends on US1 (active session must exist to close)

### Within Each User Story

- State logic (`useSessionManager`) before UI components
- Core implementation before edge case handling
- Styles alongside or after component implementation

### Parallel Opportunities

**Phase 1** (all parallelizable):
- T003 (types) and T004 (constants) can run in parallel

**Phase 2** (sequential dependencies):
- T005 (IndexedDB) → T006 (storage functions) → T007 (index functions) → T008 (protected IDs)
- T009, T010, T011, T012 (Plugin API types) can run in parallel with T005–T008
- T013 (App.tsx broadcast) depends on T009–T012
- T014 (ScoreSelector prop) can run in parallel with T013

**Phase 7** (after Phase 3):
- T032 (ScoreSelectorPlugin) and T033 (SavedPracticeList) can run in parallel
- T034 depends on T032 + T033
- T035 (eviction) can run in parallel with T032–T034

---

## Parallel Example: Phase 2 Foundation

```
# Batch 1 — can run in parallel:
T005: Upgrade IndexedDB v2 → v3 in local-storage.ts
T009: Add PracticeSavedEvent type to types.ts
T010: Add onPracticeSaved to PluginContext in types.ts
T014: Add protectedPracticeIds prop to PluginScoreSelectorProps in types.ts

# Batch 2 — depends on T005:
T006: Session IndexedDB CRUD functions
T011: Re-export PracticeSavedEvent from index.ts
T012: Bump PLUGIN_API_VERSION to '8'

# Batch 3 — depends on T006:
T007: Session localStorage index functions
T008: computeProtectedPracticeIds()

# Batch 4 — depends on T009–T012:
T013: Practice-saved broadcast in App.tsx
```

---

## Bug Fixes and Post-Implementation Work

### BUG-001: Stale activeSessionId ref in useSessionManager

- [x] T040 [BUG] `closeSession()` immediately after `startSession()` silently did nothing; likewise `startSession()` after `closeSession()` was blocked by a stale ref.
  - **Symptom**: Closing a freshly-created session had no effect; starting a new session after closing one failed.
  - **Root Cause**: `startSession()` and `closeSession()` updated React state (`setActiveSessionId`) but never synced `activeSessionIdRef.current`, which is what the guard conditions (`if (activeSessionIdRef.current)`) read.
  - **Fix**: Added `activeSessionIdRef.current = id` in `startSession()` and `activeSessionIdRef.current = null` in `closeSession()`.
  - **Tests**: Two regression cases added to `sessions-plugin.test.tsx` — "startSession works again after closeSession" and "closeSession works immediately after startSession".

---

### Post-Implementation Improvements

- [x] T041 Migrate sessions-plugin from `frontend/plugins/` (internal) to `plugins-external/sessions-plugin/` (external plugin with own build pipeline), matching the pattern of `virtual-keyboard-pro`. Added symlink `frontend/plugins/sessions-plugin → ../../plugins-external/sessions-plugin` for local dev. Updated `frontend/plugins/.gitignore` and `plugins-external/README.md`.

- [x] T042 Replace `protectedPracticeIds` guard (disabled 🔒 button) with a session link (📋 button) that navigates to the Sessions plugin via `context.openPlugin('sessions-plugin')`.
  - Added `computeProtectedPracticeMap()` to `sessionStorage.ts` returning `Map<practiceId, sessionName>`.
  - Added `protectedPracticeMap?: ReadonlyMap<string, string>` and `onViewSessions?: () => void` to `PluginScoreSelectorProps`.
  - Updated `SavedPracticeList`, `ScoreSelectorPlugin`, and `PracticeViewPlugin` accordingly.

- [x] T043 Add `openPlugin(pluginId, data?)` and `getNavigationData()` to `PluginContext` for cross-plugin navigation; wired in `App.tsx` via `pluginNavDataRef`.

- [x] T044 Write unit test suite for sessions-plugin (`sessions-plugin.test.tsx`): 25 tests covering localStorage index CRUD, MAX_SESSIONS eviction, `addActivityToActiveSession`, `computeProtectedPracticeIds/Map`, and full `useSessionManager` hook lifecycle including stale-ref regression cases.

- [x] T045 Fix CI pipeline issues:
  - Added `plugins/sessions-plugin/**` to `tsconfig.app.json` exclude list (host tsc was following symlink and failing on `../../frontend/src/...` paths).
  - Added `plugins/sessions-plugin/**` to `vitest.config.ts` exclude list (host vitest was picking up the external plugin's test file through the symlink).
  - Added `/* @vite-ignore */` to dynamic `import()` calls in `PracticeViewPlugin.tsx` (Vite's import analysis failed at transform time in CI where the symlink is absent).
  - Added `@testing-library/dom` to sessions-plugin `devDependencies`.

- [x] T046 Fix offline banner false positive: replaced `navigator.onLine` initialization in `useOfflineDetection.ts` with an optimistic-start + fetch-probe approach. The banner now only shows after a `HEAD /favicon.ico` probe confirms real connectivity loss, avoiding false positives on VPNs, proxied networks, and certain WiFi setups.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T014)
3. Complete Phase 3: User Story 1 (T015–T020)
4. **STOP and VALIDATE**: Start a session → save a practice → verify activity appears
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate independently → **MVP!**
3. Add User Story 2 → Session list with metadata + rename
4. Add User Story 3 → Activity browsing + practice loading
5. Add User Story 4 → Session lifecycle complete
6. Add Deletion Guard & Eviction → Data integrity enforced
7. Polish → Full validation
