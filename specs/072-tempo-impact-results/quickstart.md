# Quickstart: Tempo Impact on Practice and Train Results

**Feature**: 072-tempo-impact-results  
**Date**: 2026-04-04

---

## Development Setup

```bash
# From the worktree root
cd /Users/alvaro.delcastillo/devel/worktrees/072-tempo-impact-results/frontend

# Install dependencies (if not already done)
npm install

# Run all unit tests
npm run test

# Run tests in watch mode (for TDD)
npm run test -- --watch

# Run only the new scorer tests
npm run test -- computePracticeScore exerciseScorer

# Type-check
npx tsc --noEmit
```

---

## Implementation Order (Test-First per Principle V)

### Step 1 — `computePracticeScore` (Practice formula)

**Write tests first** in `frontend/src/plugin-api/computePracticeScore.test.ts`:
```typescript
// Test: tempoMultiplier = 1.0, all correct → score = 100
// Test: tempoMultiplier = 0.5, all correct → score = 50
// Test: tempoMultiplier = 1.5, all correct → score = 100 (capped, not 150)
// Test: tempoMultiplier = 0.5, 80% accuracy → rawScore≈80, adjusted≈40
// Test: no tempoMultiplier argument → existing behaviour unchanged (backward compat)
```

**Then implement** in `computePracticeScore.ts`:
- Add `tempoMultiplier?: number` second parameter
- Add `tempoMultiplier` to `PracticeScoreBreakdown`
- Apply `score = clamp(round(rawAccuracy × min(1.0, safeMult)), 0, 100)` where `safeMult = (tempoMultiplier != null && tempoMultiplier > 0) ? tempoMultiplier : 1.0`

---

### Step 2 — `exerciseScorer` (Train BPM formula)

**Write tests first** in `frontend/plugins/train-view/exerciseScorer.test.ts`:
```typescript
// Test: 80 BPM, 80% accuracy → score = 80 (reference BPM, no change)
// Test: 40 BPM, 80% accuracy → score = 60 (penalty doubled)
// Test: 100 BPM, 80% accuracy → score ≈ 86 (penalty reduced)
// Test: any BPM, 100% accuracy → score = 100
// Test: bpm = 0 → no BPM factor applied, score = rawScore
// Test: result.bpm equals exercise.bpm
```

**Then implement** in `exerciseScorer.ts` and extend `trainTypes.ts`:
- Add `bpm: number` to `ExerciseResult`
- Apply log2 BPM factor in `scoreExercise` (see contracts/typescript.md §4)
- Return `bpm: exercise.bpm` in result object

---

### Step 3 — `PerformanceRecord` / `PartialPerformanceRecord`

**Extend types** in `practiceEngine.types.ts`:
- Add `tempoMultiplier: number` to both interfaces

**Update construction sites** in `PracticeViewPlugin.tsx`:
- Live complete record (`~line 545`): add `tempoMultiplier: tempoMultiplierRef.current`
- Live partial record (`~line 598`): add `tempoMultiplier: tempoMultiplierRef.current`
- Loaded from storage (`~lines 305, 313`): add `tempoMultiplier: saved.tempoMultiplier ?? 1.0`

---

### Step 4 — `ResultsOverlay` (Practice display + score call sites)

**Update `computePracticeScore` calls**:
```typescript
// Complete: practiceReport useMemo (~line 197)
const breakdown = computePracticeScore(results, performanceRecord?.tempoMultiplier ?? 1.0);

// Partial: partialReport useMemo (~line 221)
const breakdown = computePracticeScore(noteResults, partialPerformanceRecord?.tempoMultiplier ?? 1.0);
```

**Add tempo subtitle** in the score header block (complete and partial overlays):
```tsx
// After the score-ring div (~line 280)
{bpmAtCompletion > 0 && (
  <div className="practice-results__tempo-subtitle">
    {bpmAtCompletion} BPM · {Math.round((tempoMultiplier) * 100)}%
  </div>
)}
```
Where `bpmAtCompletion = performanceRecord?.bpmAtCompletion ?? 0` and `tempoMultiplier = breakdown.tempoMultiplier`.

---

### Step 5 — `PracticeViewPlugin` save/broadcast

**Update broadcast call** (~line 833):
```typescript
const breakdown = computePracticeScore(
  performanceData.noteResults,
  tempoMultiplierRef.current,  // ← add this
);
```

---

### Step 6 — `TrainResultsOverlay` (BPM display)

**Add BPM subtitle** in the score header:
```tsx
// After the score-ring display
{result.bpm > 0 && (
  <div className="practice-results__tempo-subtitle">
    {result.bpm} BPM
  </div>
)}
```

No prop change needed — `result.bpm` is now part of `ExerciseResult`.

---

## Running Tests After Each Step

```bash
# After Step 1
npm run test -- computePracticeScore

# After Step 2
npm run test -- exerciseScorer

# After Steps 3–6 (full regression check)
npm run test
```

Expected: all existing tests pass + new tempo formula tests pass.

---

## Key File Locations

| What | Where |
|------|-------|
| Practice score formula | `frontend/src/plugin-api/computePracticeScore.ts` |
| Practice score tests (new) | `frontend/src/plugin-api/computePracticeScore.test.ts` |
| Train scorer | `frontend/plugins/train-view/exerciseScorer.ts` |
| Train scorer tests (new) | `frontend/plugins/train-view/exerciseScorer.test.ts` |
| Train types | `frontend/plugins/train-view/trainTypes.ts` |
| Practice engine types | `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` |
| Practice results overlay | `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx` |
| Practice plugin (save/broadcast) | `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` |
| Train results overlay | `frontend/plugins/train-view/TrainResultsOverlay.tsx` |
