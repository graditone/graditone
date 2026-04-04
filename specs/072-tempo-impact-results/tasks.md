# Tasks: Tempo Impact on Practice and Train Results

**Feature**: 072-tempo-impact-results  
**Branch**: `072-tempo-impact-results`  
**Worktree**: `../worktrees/072-tempo-impact-results`  
**Input**: Design documents from `specs/072-tempo-impact-results/`  
**Prerequisites**: plan.md ✅  spec.md ✅  data-model.md ✅  contracts/typescript.md ✅  quickstart.md ✅

**Tests**: Included — TDD required per Principle V (write failing tests before each implementation task)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4)
- All paths relative to worktree root

---

## Phase 1: Setup

_No setup required — modifying existing code in an established TypeScript/React project. No new dependencies, no new project structure. Proceed directly to Foundational._

---

## Phase 2: Foundational (Blocking Type Changes)

**Purpose**: Type definition changes that unblock all user story implementations. Both tasks are in separate plugins with no file conflicts — run in parallel.

**⚠️ CRITICAL**: US1 and US2 require T001 complete; US3 and US4 require T002 complete.

- [X] T001 [P] Add `tempoMultiplier: number` field to both `PerformanceRecord` and `PartialPerformanceRecord` interfaces in `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`
- [X] T002 [P] Add `bpm: number` field to `ExerciseResult` interface in `frontend/plugins/train-view/trainTypes.ts`

**Checkpoint**: Type definitions complete — US1/US2 implementation can start after T001; US3/US4 after T002

---

## Phase 3: User Story 1 — Tempo-Weighted Practice Score (Priority: P1) 🎯 MVP

**Goal**: `computePracticeScore` applies a multiplicative tempo penalty so that identical note accuracy at 0.5× tempo scores 50 and at 1.0× still scores 100; existing callers require no changes (optional param defaults to 1.0).

**Independent Test**: Call `computePracticeScore(allCorrectResults, 0.5)` → verify score = 50. Call with `1.0` → score = 100. Call with no second arg → same score as before. Pure unit test with no UI dependency.

### Tests for User Story 1 (TDD — write FIRST, verify they FAIL before T004)

- [X] T003 [P] [US1] Create `frontend/src/plugin-api/computePracticeScore.test.ts` with unit tests covering: `tempoMultiplier=1.0` all-correct → 100, `tempoMultiplier=0.5` all-correct → 50, `tempoMultiplier=1.5` all-correct → 100 (capped, not 150), `tempoMultiplier=0.5` partial-accuracy → halved raw score, omitted multiplier arg → backward-compatible result unchanged

### Implementation for User Story 1

- [X] T004 [US1] Extend `frontend/src/plugin-api/computePracticeScore.ts`: add optional `tempoMultiplier?: number` second parameter defaulting to 1.0; add `readonly tempoMultiplier: number` to `PracticeScoreBreakdown`; apply formula `score = clamp(round(rawAccuracy × min(1.0, safeMult)), 0, 100)` where `safeMult = (tempoMultiplier != null && tempoMultiplier > 0) ? tempoMultiplier : 1.0` (after T003)
- [X] T005 [US1] Update `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` save/broadcast call (~line 833): pass `tempoMultiplierRef.current` as second argument to `computePracticeScore` so the persisted score reflects tempo weighting (after T001, T004)

**Checkpoint**: All `computePracticeScore.test.ts` tests pass; PracticeViewPlugin writes tempo-weighted scores to storage and broadcast events

---

## Phase 4: User Story 2 — Tempo Displayed in Practice Results (Priority: P1)

**Goal**: `ResultsOverlay` shows a tempo subtitle directly beneath the score badge for every completed and partial session — displaying effective BPM and multiplier percentage (e.g., "90 BPM · 75%").

**Independent Test**: Render `ResultsOverlay` with a `PerformanceRecord` where `bpmAtCompletion=90, tempoMultiplier=0.75` → verify subtitle "90 BPM · 75%" appears beneath the score ring. Render with `bpmAtCompletion=0` → verify "—" or BPM portion omitted.

### Implementation for User Story 2

- [X] T006 [US2] Update both `computePracticeScore` call sites in `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` (~lines 197 and 221): pass `performanceRecord?.tempoMultiplier ?? 1.0` (complete overlay) and `partialPerformanceRecord?.tempoMultiplier ?? 1.0` (partial overlay) as second argument (after T001, T004)
- [X] T007 [US2] Add tempo subtitle `<div class="practice-results__tempo-subtitle">` beneath the score-ring `<div>` in `ResultsOverlay.tsx` for both complete and partial overlay sections: render `{bpmAtCompletion} BPM · {Math.round(breakdown.tempoMultiplier * 100)}%`; when `bpmAtCompletion === 0` render multiplier % only (omit BPM); source `bpmAtCompletion` from `performanceRecord?.bpmAtCompletion ?? 0` and multiplier from `breakdown.tempoMultiplier` (after T006)

**Checkpoint**: Practice results overlay shows tempo context for every session; `bpmAtCompletion=0` edge case handled gracefully

---

## Phase 5: User Story 3 — Tempo-Weighted Train Score (Priority: P2)

**Goal**: `exerciseScorer` applies a log₂ BPM normalisation factor so that identical pitch accuracy at 100 BPM scores higher than at 40 BPM; perfect accuracy at any BPM always scores 100.

**Independent Test**: Call `scoreCapture` with identical all-correct responses on exercises at 40 BPM and 100 BPM → verify `score(100 BPM) > score(40 BPM)`. Call with 100% accuracy at both → verify score = 100 in each. Pure unit test, no UI dependency.

### Tests for User Story 3 (TDD — write FIRST, verify they FAIL before T009)

- [X] T008 [P] [US3] Create `frontend/plugins/train-view/exerciseScorer.test.ts` with unit tests covering: 80 BPM 80%-accuracy → score=80 (reference BPM, neutral factor), 40 BPM 80%-accuracy → score=60 (penalty doubled), 100 BPM 80%-accuracy → score≈86 (penalty reduced), any BPM 100%-accuracy → score=100, `bpm=0` → raw score unchanged (guard), `result.bpm` equals `exercise.bpm`

### Implementation for User Story 3

- [X] T009 [US3] Extend `frontend/plugins/train-view/exerciseScorer.ts` inside `scoreExercise`: compute `bpmFactor = Math.max(0.5, Math.min(2.0, 1 - Math.log2((exercise.bpm > 0 ? exercise.bpm : 80) / 80)))`, derive `penalty = 100 - rawScore`, apply `adjustedScore = clamp(round(100 - penalty × bpmFactor), 0, 100)`; return `bpm: exercise.bpm` in the `ExerciseResult` object (after T002, T008)

**Checkpoint**: All `exerciseScorer.test.ts` tests pass; Train scores meaningfully differentiate BPM complexity levels for imperfect runs

---

## Phase 6: User Story 4 — Tempo Displayed in Train Results (Priority: P2)

**Goal**: `TrainResultsOverlay` displays the exercise BPM in the score header so musicians immediately see how their tempo choice contributed to the score.

**Independent Test**: Render `TrainResultsOverlay` with `result = { bpm: 80, score: 80, ... }` → verify "80 BPM" is visible. Render with `result.bpm = 0` → verify no BPM line renders (no "0 BPM").

### Implementation for User Story 4

- [X] T010 [US4] Add BPM subtitle in `frontend/plugins/train-view/TrainResultsOverlay.tsx` score header: render `<div className="practice-results__tempo-subtitle">{result.bpm} BPM</div>` (reusing existing CSS class) conditionally on `result.bpm > 0`; reads `result.bpm` directly from `ExerciseResult` — no new props needed (after T009)

**Checkpoint**: Train results overlay shows BPM for all completed exercises; old records with `result.bpm = 0` display without errors

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation across all user stories before the feature is considered complete.

- [X] T011 [P] Run `npx tsc --noEmit` from `frontend/` to confirm no TypeScript errors introduced by T001–T010 (all four modified interfaces and all call sites type-check)
- [X] T012 [P] Run `npm run test` from `frontend/` to confirm all new tempo formula tests (T003, T008) pass and no pre-existing tests regress (SC-005 and SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately; T001 ‖ T002
- **User Story 1 (Phase 3)**: T003 can start immediately (parallel with Phase 2); T004 after T003; T005 after T001 + T004
- **User Story 2 (Phase 4)**: T006/T007 after T001 + T004 (need both type change and scoring function extended)
- **User Story 3 (Phase 5)**: T008 can start immediately (parallel with Phase 2 and Phase 3); T009 after T002 + T008
- **User Story 4 (Phase 6)**: T010 after T009
- **Polish (Phase 7)**: T011/T012 after all implementation tasks complete

### User Story Dependencies

| Story | Depends On | Independent From |
|-------|-----------|-----------------|
| US1 (P1) | T003 must exist before T004 | US2, US3, US4 |
| US2 (P1) | T001 (types) + T004 (scorer extended) | US3, US4 |
| US3 (P2) | T008 must exist before T009 | US1, US2 |
| US4 (P2) | T009 (scorer + ExerciseResult.bpm populated) | US1, US2 |

### Within Each User Story

- Test files (T003, T008) MUST be written so they **fail** before the implementation tasks (T004, T009) are started — this is the TDD gate per Principle V
- T001 and T002 (type changes) must be committed before any code that constructs or accesses the new fields
- Within US2: T006 (update call sites) before T007 (add display subtitle) — same file, sequential

### Parallel Opportunities

- T001 ‖ T002 (different plugins, `practice-view-plugin/` vs `train-view/`)
- T003 ‖ T001, T002 (new test file in `plugin-api/` — no conflicts)
- T008 ‖ T001, T002, T003, T004, T005 (new test file in `train-view/` — no conflicts)
- T011 ‖ T012 (read-only validation commands)

---

## Parallel Example: US1 + US3 simultaneous start

```bash
# Terminal 1 — Foundational types (Phase 2)
# T001: edit frontend/plugins/practice-view-plugin/practiceEngine.types.ts
# T002: edit frontend/plugins/train-view/trainTypes.ts

# Terminal 2 — Practice TDD (can start before Phase 2 completes)
# T003: create frontend/src/plugin-api/computePracticeScore.test.ts
# run: npm run test -- computePracticeScore  → verify tests FAIL

# Terminal 3 — Train TDD (can start before Phase 2 completes)
# T008: create frontend/plugins/train-view/exerciseScorer.test.ts
# run: npm run test -- exerciseScorer  → verify tests FAIL
```

After Phase 2 and test files ready:
```bash
# Terminal 2 (continued — after T001 + T003)
# T004: edit frontend/src/plugin-api/computePracticeScore.ts
# run: npm run test -- computePracticeScore  → tests PASS now
# T005: edit frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx
# T006/T007: edit frontend/plugins/practice-view-plugin/ResultsOverlay.tsx

# Terminal 3 (continued — after T002 + T008)
# T009: edit frontend/plugins/train-view/exerciseScorer.ts
# run: npm run test -- exerciseScorer  → tests PASS now
# T010: edit frontend/plugins/train-view/TrainResultsOverlay.tsx
```

Final validation:
```bash
cd frontend
npx tsc --noEmit   # T011
npm run test       # T012
```

---

## Implementation Strategy

**MVP Scope**: User Stories 1 + 2 (P1 only) — practice tempo weighting + display. Delivers the most impactful user-visible change and fully validates the core formula approach.

**Incremental Delivery**:
1. Deliver US1 + US2 → validates multiplicative formula in production with real practice data
2. Deliver US3 + US4 → completes Train mode; shares no code with Practice changes

**Confidence Level**: High — all formula decisions resolved in clarification session; all type contracts documented in `contracts/typescript.md`; all construction sites and call sites identified by line number in `quickstart.md`.
