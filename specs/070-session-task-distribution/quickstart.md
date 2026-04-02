# Quickstart: Session Task Distribution

**Feature**: 070-session-task-distribution
**Date**: 2026-04-01

## Prerequisites

- Rust toolchain (latest stable) + wasm-pack
- Node.js 18+ with npm
- Working WASM build: `cd frontend && npm run build:wasm`

## Build & Test Commands

### Backend (Rust)
```bash
cd backend
cargo test                              # Run all Rust tests
cargo test difficulty                   # Run difficulty-related tests only
cargo test region_difficulty            # Run new per-region difficulty tests
```

### Frontend + Plugin
```bash
cd frontend
npm run build:wasm                      # Rebuild WASM module after Rust changes
npm test                                # Run all Vitest tests
npm test -- --filter goalEngine         # Run goal engine tests
npm test -- --filter durationEstimation # Run duration estimation tests
npm test -- --filter sessionDistribution # Run distribution algorithm tests
```

## Implementation Order

### Step 1: Rust — Per-Region Difficulty (backend)

**Files**: `backend/src/domain/difficulty/density.rs`, `backend/src/adapters/wasm/bindings.rs`

1. In `density.rs`, refactor `compute_instrument_difficulty()` to accept an optional measure range
2. Add `compute_region_difficulty(score, start, end, staff_index)` public function
3. Add WASM binding in `bindings.rs`
4. Write tests in `backend/tests/` for region difficulty computation

**Verify**: `cargo test region_difficulty`

### Step 2: Plugin API — getRegionDifficulty (frontend)

**Files**: `frontend/src/plugin-api/types.ts`, `frontend/src/plugin-api/scorePlayerContext.ts`

1. Add `getRegionDifficulty()` to `PluginScorePlayerContext` interface
2. Implement in `scorePlayerContext.ts` — delegates to WASM `compute_region_difficulty`
3. Add contract tests in `frontend/src/plugin-api/scorePlayerContext.test.ts`

**Verify**: `npm test -- --filter scorePlayerContext`

### Step 3: Duration Estimation Module (plugin)

**Files**: `plugins-external/sessions-plugin/durationEstimation.ts`, `durationEstimation.test.ts`

1. Create `estimateTaskDuration(numMeasures, loopCount, difficulty, minResult): number`
2. Constants: `BASE_SECS_PER_MEASURE = 210`, difficulty multipliers, loop/result formulas
3. Write unit tests covering easy/medium/hard, various loopCounts and minResults

**Verify**: `npm test -- --filter durationEstimation`

### Step 4: Session Distribution Module (plugin)

**Files**: `plugins-external/sessions-plugin/sessionDistribution.ts`, `sessionDistribution.test.ts`

1. Create `PhraseGroup` type: `{ phraseIndex, tasks, totalDuration }`
2. Create `distributeTasks(phraseGroups, availableTime): DistributedSession[]`
3. Create `findFreeDays(numDays, occupiedDates): string[]`
4. Write unit tests: single session, overflow, phrase-group integrity, free-day gaps

**Verify**: `npm test -- --filter sessionDistribution`

### Step 5: Expand Goal Engine (plugin)

**Files**: `plugins-external/sessions-plugin/goalEngine.ts`, `goalEngine.test.ts`

1. Replace `selectFirstPhrase()` with iteration over ALL phrases for instrument 0
2. Generate 3 tasks per phrase (RH, LH, BH) for multi-staff, 1 (BH) for single-staff
3. Each task gets `difficulty` and `estimatedDurationSecs` from Steps 2-3
4. Return phrase groups instead of flat task list
5. Update `CreateGoalResult` to return multiple sessions with target dates

**Verify**: `npm test -- --filter goalEngine`

### Step 6: Update Types (plugin + frontend)

**Files**: `sessionTypes.ts`, `goalTypes.ts`

1. Add `difficulty?` and `estimatedDurationSecs?` to `SessionTask`
2. Add `availableTime?` to `Session`
3. Replace `sessionId` with `sessionIds` in `Goal`
4. Add `totalEstimatedDurationSecs?` to `SessionIndexEntry`
5. Add lazy migration in goal storage read path

**Verify**: TypeScript compilation passes; existing tests still pass

### Step 7: Integrate in GoalsView (plugin)

**Files**: `GoalsView.tsx`, `GoalsView.test.tsx`, `sessionStorage.ts`

1. Update `processScoreSelection()` to:
   - Call `getRegionDifficulty()` for each phrase × staff
   - Call `estimateTaskDuration()` for each task
   - Call `distributeTasks()` to get session groups
   - Call `findFreeDays()` for scheduling
   - Check eviction warning (FR-016)
   - Create and persist multiple sessions
2. Update `checkGoalCompletion()` to work with `sessionIds`
3. Add `getOccupiedDates()` helper to `sessionStorage.ts`

**Verify**: `npm test -- --filter GoalsView`

### Step 8: UI Display Updates (plugin)

**Files**: `SessionsPlugin.tsx`, `CalendarView.tsx`

1. Display `estimatedDurationSecs` total on session cards
2. Display `availableTime` remaining on session cards
3. Display task difficulty badge (Easy/Medium/Hard) on task items

**Verify**: Manual testing + existing component tests pass

## Smoke Test

1. `cd frontend && npm run build:wasm && npm run build && npm run dev`
2. Open the app, navigate to Sessions plugin → Goals tab
3. Create a goal for "Burgmuller Arabesque" (a multi-phrase piano score)
4. Verify: multiple tasks generated (3 per phrase), each with difficulty and duration
5. Verify: multiple sessions created, each within ~1 hour time budget
6. Verify: sessions scheduled on consecutive free days
7. Verify: existing sessions on calendar are not double-booked
