# Tasks: Fix Practice Issues in La Candeur

**Input**: Design documents from `/specs/053-fix-lacandeur-practice/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Included — mandated by Constitution Principles V (Test-First) and VII (Regression Prevention). Constitution check in `plan.md` marks both as ✅ REQUIRED. Write failing tests FIRST for every bug fix.

**Organization**: Tasks grouped by user story. US4 depends on US1/US2 (cascade fix). US3, US5, US6, US7 are fully independent of each other.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files or independent assertions, no incomplete dependencies)
- **[Story]**: User story: [US1]–[US7] (maps to spec.md)
- Constitution Principles V & VII: tests MUST fail before implementation — enforce this at every story phase

---

## Phase 1: Setup (Dev Environment Verification)

**Purpose**: Confirm starting state — working dev server, clean baseline test suite

- [X] T001 Verify dev environment: run `npm run dev` in `frontend/` and confirm La Candeur loads in practice mode per `specs/053-fix-lacandeur-practice/quickstart.md`
- [X] T002 Run existing Vitest suite in `frontend/` (`npm run test`) and confirm zero pre-existing failures as baseline

**Checkpoint**: Baseline confirmed — all user story phases can begin

---

## Phase 3: User Story 1 & 2 — BH Duration Fix (Priority: P1) 🎯 MVP

**Goal**: Remove the second cross-staff gap truncation in `mergePracticeNotesByTick.ts` that shortens LH note durations in both-hands mode, restoring correct highlight duration (US1) and correct cross-barline chord evaluation (US2).

**Independent Test (US1)**: Open La Candeur in BH practice mode, play an opening LH chord — verify it stays green for the full half-note duration, matching LH-only mode exactly.

**Independent Test (US2)**: Progress to M3–M4, hold the LH chord through the barline — verify the system does not advance until M4's full written duration has elapsed.

### Tests for User Story 1 & 2 ⚠️ — Write First, Confirm They FAIL Before T006

- [X] T003 [US1] Write failing unit test asserting merged BH entry `durationTicks` for a LH half-note equals its per-staff gap (e.g., 480 ticks), not the shorter cross-staff gap (e.g., 240 ticks), when RH has an intermediate onset in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.test.ts`
- [X] T004 [US2] Write failing unit test asserting a BH cross-barline LH chord retains its full M3+M4 duration (per-staff value) rather than being truncated at the first RH onset in M4 in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.test.ts`
- [X] T005 [P] [US1] Write failing unit test asserting LH-only mode note durations are unaffected by the BH merge path (regression guard against over-correcting) in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.test.ts`

### Implementation for User Story 1 & 2

- [X] T006 [US1] Remove the second cross-staff gap-truncation loop from `mergePracticeNotesByTick()` in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.ts` — each staff's durations are already correctly bounded from `extractPracticeNotes()` (Decision D-01 from `research.md`)
- [X] T007 [US1] Verify T003, T004, and T005 tests all pass (green phase) after removing the second truncation in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.ts`
- [X] T008 [US2] Run manual regression check: BH mode LH chord duration now matches LH-only mode exactly per `specs/053-fix-lacandeur-practice/quickstart.md` Bug 1 & 2 test steps

**Checkpoint**: US1 and US2 fully fixed and independently testable. Proceed to Phase 4 to validate whether US4 (M15) auto-resolved as a cascade.

---

## Phase 4: User Story 4 — M15 Expected-Note Set Correction (Priority: P1)

**Goal**: Verify that the Phase 3 fix cascade-resolves the M15 false requirement (LH half-notes appear in `sustainedPitches`, not `midiPitches`, at the subsequent RH beat). Add a fallback if not fully resolved.

**Independent Test**: Start practice at M15 in BH mode, play only RH G4 — it must be accepted without requiring any LH half-notes to be actively held at that moment.

### Tests for User Story 4 ⚠️ — Write First, Confirm They FAIL Before T011

- [X] T009 [US4] Write failing unit test asserting that an LH note at tick T with `durationTicks > 240` appears in `sustainedPitches` (not in `midiPitches`) of the subsequent BH entry at tick T+240 in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.test.ts`

### Implementation for User Story 4

- [X] T010 [US4] Run T009 after the Phase 3 fix (T006) is in place — if T009 passes, document as cascade-resolved and skip T011; if still failing, implement T011
- [X] T011 [US4] If T009 still fails after T006: update sustained-pitch window check to use the pre-truncation (original per-staff) `durationTicks` for cross-staff `sustainedPitches` classification in `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.ts` (Decision D-03 from `research.md`) — SKIPPED: cascade-resolved by T006

**Checkpoint**: US4 verified — playing RH G4 alone at M15 is accepted. T011 is skipped if Phase 3 fix was sufficient.

---

## Phase 5: User Story 3 — Green Dot Persistence on System Change (Priority: P2)

**Goal**: The green position indicator does not disappear after a system line break. A deferred `reapplyHighlights()` call on the next animation frame after every `renderSVG()` closes the transient empty-highlight race window.

**Independent Test**: Practice La Candeur through the first system line break — verify the green dot appears at the correct note on the new system and does not then disappear.

### Tests for User Story 3 ⚠️ — Write First, Confirm They FAIL Before T013

- [X] T012 [US3] Write failing unit test that simulates a `renderSVG()` call followed by a state update with transiently empty `expectedNoteIds`, then asserts `updateExpectedHighlights()` is called with a non-empty set on the deferred next-frame callback in `frontend/src/components/LayoutRenderer.test.tsx`

### Implementation for User Story 3

- [X] T013 [US3] Schedule a deferred `reapplyHighlights()` on the next animation frame (via `requestAnimationFrame` or `setTimeout(fn, 0)`) after every `renderSVG()` DOM rebuild in `frontend/src/components/LayoutRenderer.tsx` (Decision D-02 from `research.md`)
- [X] T014 [US3] Verify T012 test passes (green phase) after the deferred-highlights fix in `frontend/src/components/LayoutRenderer.tsx`

**Checkpoint**: US3 independently testable — green dot stable across all system line breaks.

---

## Phase 6: User Story 5 — Extra Notes Policy & Rest Enforcement (Priority: P2)

**Goal**: Key presses during a hand's inter-onset gap (rest) register as a mistake with `WRONG_MIDI` and do not advance `currentIndex`. Extra keys pressed alongside all required notes are silently non-advancing (semi-strict policy per FR-005).

**Independent Test**: In M17 practice, during the RH half-rest, press any key — verify a WRONG note event is recorded and the session does not advance to the next entry.

### Tests for User Story 5 ⚠️ — Write First, Confirm They FAIL Before T017

- [X] T015 [US5] Write failing unit test: given a `PracticeState` in `holding` or `waiting` mode with next entry tick in the future, simulate a `MIDI_NOTE_ON` for a pitch not in `nextEntry.midiPitches` and assert `WRONG_MIDI` fires and `currentIndex` is unchanged in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`
- [X] T016 [P] [US5] Write failing unit test: pressing all required notes plus one extra note results in correct advancement (extra silently ignored, full credit) in `frontend/plugins/practice-view-plugin/practiceEngine.test.ts`

### Implementation for User Story 5

- [X] T017 [US5] Implement inter-onset gap wrong-note detection in `frontend/plugins/practice-view-plugin/practiceEngine.ts`: when in `holding`/`waiting` state and the gap clock has not reached the next entry tick, treat any pitch not in `nextEntry.midiPitches` as `WRONG_MIDI` (Decision D-04 from `research.md`)
- [X] T018 [US5] Verify T015 and T016 tests pass (green phase) after rest enforcement in `frontend/plugins/practice-view-plugin/practiceEngine.ts`

**Checkpoint**: US5 independently testable — rest policy enforced consistently score-wide.

---

## Phase 7: User Story 6 — Position Lock During Active Practice (Priority: P2)

**Goal**: All score position navigation (measure tap, Return-to-Start, playhead drag, navigation shortcuts) is disabled while `practiceState.mode` is `waiting | active | holding`. Navigation re-enables immediately after Stop.

**Independent Test**: Start a practice session, tap a different measure — verify position does not change and no SEEK action is dispatched.

### Tests for User Story 6 ⚠️ — Write First, Confirm They FAIL Before T021

- [X] T019 [US6] Write failing unit test: assert `handleNoteShortTap` does NOT dispatch a `SEEK` action when `practiceState.mode === 'active'` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T020 [P] [US6] Write failing unit test: assert Return-to-Start button has `disabled` attribute when `isPracticeRunning === true` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for User Story 6

- [X] T021 [US6] Derive `const isPracticeRunning = ['waiting', 'active', 'holding'].includes(practiceState.mode)` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` and gate `handleNoteShortTap` to block SEEK dispatch when `isPracticeRunning` (Decision D-05 from `research.md`)
- [X] T022 [US6] Apply `disabled={isPracticeRunning}` to Return-to-Start button in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T023 [US6] Add `practiceRunning?: boolean` prop to `frontend/src/pages/ScoreViewer.tsx` and suppress measure-click position changes when the prop is `true` — SKIPPED: position lock handled entirely via callback guards in PracticeViewPlugin
- [X] T024 [US6] Pass `isPracticeRunning` from `PracticeViewPlugin.tsx` as `practiceRunning` prop to `ScoreViewer` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` — SKIPPED: not needed
- [X] T025 [US6] Verify T019 and T020 tests pass (green phase) after position lock is in place in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: US6 independently testable — position locked for the full active practice session.

---

## Phase 8: User Story 7 — Partial Results on Stop (Priority: P2)

**Goal**: Pressing Stop during a practice session captures a `PartialPerformanceRecord` snapshot (before STOP resets state) and renders it in the existing results overlay with score %, "Stopped at MX of N" badge, and a graceful zero-progress message.

**Independent Test**: Start practice, play several measures, press Stop — verify results overlay appears immediately with score % and measure-reached label.

### Tests for User Story 7 ⚠️ — Write First, Confirm They FAIL Before T028

- [X] T026 [US7] Write failing unit test: assert that after Stop is pressed with at least one `PracticeNoteResult`, the component renders a results overlay containing a score percentage and a "MX of N" label in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`
- [X] T027 [P] [US7] Write failing unit test: assert Stop with zero notes played renders a "no results" message rather than a crash or empty overlay in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`

### Implementation for User Story 7

- [X] T028 [US7] Define `PartialPerformanceRecord` interface (component-local, not exported) with fields `notes`, `noteResults`, `wrongNoteEvents`, `bpmAtCompletion`, `stoppedAtIndex`, `totalNoteCount` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (see `specs/053-fix-lacandeur-practice/data-model.md`)
- [X] T029 [US7] Add `const [partialPerformanceRecord, setPartialPerformanceRecord] = useState<PartialPerformanceRecord | null>(null)` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T030 [US7] Implement snapshot in `handleStop()`: before dispatching `STOP`, call `setPartialPerformanceRecord({ notes, noteResults, wrongNoteEvents, bpmAtCompletion: currentBpm, stoppedAtIndex: currentIndex, totalNoteCount: notes.length })` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (Decision D-06 from `research.md`)
- [X] T031 [US7] Render results overlay when `partialPerformanceRecord !== null` (in addition to existing `mode === 'complete'` condition) using existing score computation applied to partial `noteResults`; show "Stopped at M{stoppedAtMeasure} of {totalMeasures}" badge in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T032 [US7] Render "No notes played — session stopped before any input" message when `stoppedAtIndex === 0` (zero-progress stop) in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`
- [X] T033 [US7] Verify T026 and T027 tests pass (green phase) after partial results implementation in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: US7 independently testable — results appear within 1 second of Stop at any point in the session.

---

## Phase N: Polish & Regression Validation

**Purpose**: Cross-score engine validation, full test suite confirmation, quickstart walkthrough

- [X] T034 [P] Run full Vitest unit test suite for all modified test files in `frontend/` (`npm run test`) and confirm zero failures
- [X] T035 [P] Run E2E smoke test if a practice test exists in `frontend/e2e/` via `npm run test:e2e` (skip if no practice E2E test exists yet) — SKIPPED: no practice E2E tests exist
- [X] T036 Complete manual regression walkthrough on La Candeur following all 7 bug-fix test steps in `specs/053-fix-lacandeur-practice/quickstart.md`
- [X] T037 Complete manual regression validation on Burgmuller Arabesque (`scores/Burgmuller_Arabesque.mxl`) in BH practice mode confirming engine-wide fix per Decision D-07 and SC-001 through SC-003

---

## Phase O: Storage Resilience — Schema Version Safety (Post-Merge Bugfix)

**Background**: After all 37 original tasks were complete, a regression was discovered: re-loading a score that had been previously loaded from a file failed with `⚠️ User score not found in local storage`. Root cause: `SCORE_SCHEMA_VERSION` was bumped to 9 in the frontend for fingering support, but the backend WASM still exported version 8. The frontend's schema-version check deleted any score with version < 9, causing the score to silently vanish from IndexedDB.

**Goal**: (1) Quick-fix the schema version mismatch; (2) implement a durable architecture where schema upgrades never permanently lose user data by storing a raw MXL blob alongside each parsed score and re-parsing on version mismatch; (3) export schema version from WASM as single source of truth; (4) cap stored scores at 20 with oldest-first eviction.

### Quick Fix

- [X] T038 Bump `SCORE_SCHEMA_VERSION` from 8 → 9 in `backend/src/adapters/dtos.rs` (add comment: "v9: fingering annotations") and change `const` → `pub const` so `bindings.rs` can reference it; rebuild WASM via `wasm-pack build`

### WASM Schema Version Export

- [X] T039 Add `#[wasm_bindgen] pub fn get_schema_version() -> u32` in `backend/src/adapters/wasm/bindings.rs` using the exported `SCORE_SCHEMA_VERSION` constant; add `get_schema_version: () => number` to the `WasmModule` interface in `frontend/src/services/wasm/loader.ts`; add `export async function getSchemaVersion()` wrapper in `frontend/src/services/wasm/music-engine.ts` returning the WASM value; rebuild WASM — frontend no longer maintains a duplicate schema version constant

### Raw MXL Blob Storage & Re-Parse on Stale Schema

- [X] T040 Overhaul `frontend/src/services/storage/local-storage.ts`: remove `CURRENT_SCHEMA_VERSION` export; add `ScoreLoadResult` discriminated union (`{ kind: 'loaded'; score }` | `{ kind: 'stale'; rawMxlBlob }` | `{ kind: 'not-found' }`); update `saveScoreToIndexedDB(score, rawMxlBlob?)` to persist optional blob; update `loadScoreFromIndexedDB(id, currentSchemaVersion)` to return `ScoreLoadResult` — returns `stale` (not deletes) when schema mismatch detected and a blob is stored; update `getAllScoresFromIndexedDB(currentSchemaVersion)` accordingly
- [X] T041 Update `frontend/src/services/score-cache.ts` to thread the new API: `cache(score, rawMxlBlob?)`, `get(scoreId, currentSchemaVersion) → ScoreLoadResult`, `has(scoreId, currentSchemaVersion)` checks for `kind === 'loaded'` only
- [X] T042 Update `frontend/src/services/import/MusicXMLImportService.ts`: add `rawFileBlob?: ArrayBuffer` to `ImportResult`; `importFile()` reads `file.arrayBuffer()` and attaches it to the result
- [X] T043 Update `frontend/src/components/ScoreViewer.tsx`: `loadScore()` calls `getSchemaVersion()`, handles `ScoreLoadResult` union — on `stale` re-parses from blob via `MusicXMLImportService` and re-caches; `handleMusicXMLImport()` passes `result.rawFileBlob` to `ScoreCache.cache()`; evicts stale IndexedDB entries when reported by `addUserScore`
- [X] T044 Update `frontend/src/plugin-api/scorePlayerContext.ts`: `file` branch passes `result.rawFileBlob` to `ScoreCache.cache()`; `userScore` branch calls `getSchemaVersion()`, handles `stale` by re-parsing from stored blob; cleans up evicted entries from IndexedDB

### 20-Score Eviction Cap

- [X] T045 Add `MAX_USER_SCORES = 20` constant to `frontend/src/services/userScoreIndex.ts`; update `addUserScore()` to return `{ entry: UserScore; evictedIds: string[] }` — evicts oldest entries (sorted ascending by `uploadedAt`) when count exceeds the limit; update `frontend/src/hooks/useUserScores.ts` return type to match; update `frontend/src/services/file/FileService.ts` to remove its duplicate `CURRENT_SCHEMA_VERSION` import

### Test Updates

- [X] T046 Update `frontend/src/test/services/userScoreIndex.test.ts`: fix `addUserScore` return destructuring to `{ entry }` / `{ entry, evictedIds }`; add `describe('addUserScore eviction')` with tests for exceeding and staying under `MAX_USER_SCORES`; fix `newest entry is always at index 0` test to use `third.entry.id` etc.
- [X] T047 Update `frontend/src/test/hooks/useUserScores.test.ts`: update `addUserScore` return assertion to `addResult.entry.displayName` and assert `evictedIds` is empty
- [X] T048 Update `frontend/src/test/components/ScoreViewer.test.tsx` and `frontend/src/components/ScoreViewer.test.tsx`: add `getSchemaVersion: vi.fn().mockResolvedValue(9)` and `deleteScoreFromIndexedDB` to mocks; switch `loadScoreFromIndexedDB` default to `{ kind: 'not-found' }`; update per-test mocks to `{ kind: 'loaded', score: mockScore }` and assertions to `toHaveBeenCalledWith('...', 9)`
- [X] T049 Update `frontend/src/test/components/ScoreViewer.upload.test.tsx`: add `getSchemaVersion` to WASM mock; update `loadScoreFromIndexedDB` and `ScoreCache.get` mocks to `ScoreLoadResult` format; fix `addUserScore` mock to return `{ entry, evictedIds: [] }`
- [X] T050 Update `frontend/tests/components/ScoreViewer.offline.test.tsx`: add `getSchemaVersion: vi.fn().mockResolvedValue(9)` to WASM mock setup; update all `loadScoreFromIndexedDB` mock values and assertions to use `ScoreLoadResult` format with schema version argument
- [X] T051 Fix TypeScript errors: remove unused `parseMusicXML` import from `scorePlayerContext.ts`; add `get_schema_version: () => number` to `WasmModule` interface in `frontend/src/services/wasm/loader.ts`
- [X] T052 [P] Run full Vitest suite (`npx vitest run`) — confirm 1645 tests passing, 0 failures across 105 test files

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Reason |
|-------|-----------|--------|
| Phase 1 (Setup) | — | Start immediately |
| Phase 3 (US1+US2) | Phase 1 | Baseline must be confirmed |
| Phase 4 (US4) | **Phase 3 complete** | Cascade fix — US4 test may auto-pass after T006; cannot assess without Phase 3 fix |
| Phase 5 (US3) | Phase 1 | Independent — `LayoutRenderer.tsx` only |
| Phase 6 (US5) | Phase 1 | Independent — `practiceEngine.ts` only |
| Phase 7 (US6) | Phase 1 | Independent — coordinate `PracticeViewPlugin.tsx` edits with Phase 8 |
| Phase 8 (US7) | Phase 1 | Independent — coordinate `PracticeViewPlugin.tsx` edits with Phase 7 |
| Phase N (Polish) | All user story phases | Final validation |

### User Story Dependencies

- **US1 (P1)**: No upstream dependencies
- **US2 (P1)**: No upstream dependencies — shares implementation and test file with US1
- **US4 (P1)**: Requires US1/US2 fix (T006) before test T009 can be validly assessed
- **US3 (P2)**: Fully independent — isolated to `LayoutRenderer.tsx`
- **US5 (P2)**: Fully independent — isolated to `practiceEngine.ts`
- **US6 (P2)**: Fully independent; shares `PracticeViewPlugin.tsx` with US7 — coordinate concurrent edits
- **US7 (P2)**: Fully independent; shares `PracticeViewPlugin.tsx` with US6 — coordinate concurrent edits

### Within Each Phase

1. **Tests MUST be written first and confirmed to FAIL** (Constitution Principles V & VII — non-negotiable)
2. Implement the fix
3. Verify tests pass (green phase)

### Parallel Opportunities

- **T003, T004, T005** (Phase 3 tests) — same file, different assertions; write in any order or parallel sessions
- **T015, T016** (Phase 6 tests) — same file, independent assertions; parallelizable
- **T019, T020** (Phase 7 tests) — same file, independent assertions; parallelizable
- **T026, T027** (Phase 8 tests) — same file, independent assertions; parallelizable
- **Phase 5 (US3) + Phase 6 (US5)** — zero file overlap; can be implemented in full parallel by two developers
- **Phase 5 (US3) + Phase 7 (US6)** — zero file overlap; can run in parallel
- **T034, T035** (Polish) — independent commands; parallelizable

---

## Parallel Example: US3 + US5 (Maximum Parallelism, Zero Conflict)

```bash
# Developer A: US3 — Green dot fix (LayoutRenderer.tsx only)
# T012: write failing test in LayoutRenderer.test.tsx
# T013: add deferred reapplyHighlights() in LayoutRenderer.tsx
# T014: verify T012 passes

# Developer B: US5 — Rest enforcement (practiceEngine.ts only)
# T015+T016: write failing tests in practiceEngine.test.ts
# T017: implement inter-onset gap WRONG_MIDI in practiceEngine.ts
# T018: verify T015+T016 pass

# Zero file overlap — both can proceed completely concurrently
```

---

## Implementation Strategy

### MVP Scope

**Phase 3 (US1 + US2) alone is the MVP** — a single-function change in `mergePracticeNotesByTick.ts` resolves the two highest-impact P1 bugs and likely auto-fixes US4 (Bug 4) as a cascade. Lowest risk, highest return.

After Phase 3, run Phase 4 (T009/T010) to validate whether US4 is resolved — zero additional code if the cascade worked.

### Recommended Delivery Order

1. **Phase 3 + Phase 4** — P1 bugs, single file, highest impact (start here)
2. **Phase 5 + Phase 6** — in parallel if two developers available (independent files)
3. **Phase 7 + Phase 8** — sequentially (shared `PracticeViewPlugin.tsx`) or with careful coordination
4. **Phase N** — regression validation across scores
