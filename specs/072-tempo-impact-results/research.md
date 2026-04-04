# Research: Tempo Impact on Practice and Train Results

**Feature**: 072-tempo-impact-results  
**Phase**: 0 — Pre-Design Research  
**Date**: 2026-04-04

---

## 1. Current Score Computation — Practice

### Decision: `computePracticeScore` is the single canon

**Rationale**: `frontend/src/plugin-api/computePracticeScore.ts` is the single implementation used by all three callers: `ResultsOverlay` (complete and partial paths), `PracticeViewPlugin.tsx` (save + broadcast), and the sessions plugin via `broadcastPracticeSaved`. The spec's FR-003 (optional `tempoMultiplier` param) directly targets this function.

**Current formula** (verified from source):
```
rawScore = round(((correct + (late + earlyRelease) × 0.5) / totalNotes) × 100
           - min(wrongAttempts × 2, 30))
score = clamp(rawScore, 0, 100)
```

**New formula with tempo weighting**:
```
rawAccuracy = round(((correct + (late + earlyRelease) × 0.5) / totalNotes) × 100
              - min(wrongAttempts × 2, 30))
tempoFactor = min(1.0, tempoMultiplier ?? 1.0)   // 0.5× → factor 0.5; 1.0×+ → factor 1.0
score = clamp(round(rawAccuracy × tempoFactor), 0, 100)
```

**Alternatives considered**: Additive penalty (`rawScore - penalty`). Rejected because the penalty magnitude is disconnected from the accuracy score — a 100-point score and a 50-point score both get the same fixed deduction, making the tempo penalty feel disproportionate for poor performances.

---

## 2. Current Score Computation — Train

### Decision: Add log2 BPM factor to `scoreExercise` penalty magnitude

**Rationale**: `frontend/plugins/train-view/exerciseScorer.ts` — `scoreExercise` currently computes:
```
score = round(100 × correctPitchCount / n)            // mic mode
      = round(50 × correctPitchCount/n + 50 × correctTimingCount/n)  // MIDI mode
```
The formula produces a score purely from accuracy. BPM is passed in via `exercise.bpm` but is unused.

**New formula** (log2 normalised against 80 BPM reference):
```
bpmFactor = clamp(1 - log2(bpm / 80), 0.5, 2.0)
penalty = 100 - rawScore
adjustedScore = clamp(round(100 - penalty × bpmFactor), 0, 100)
```

**Worked examples**:
| BPM | bpmFactor | 80% accuracy raw=80 | 100% accuracy raw=100 |
|-----|-----------|---------------------|----------------------|
| 40  | 2.0       | 60 (penalty×2)      | 100 (no penalty)     |
| 80  | 1.0       | 80 (unchanged)      | 100                  |
| 100 | 0.678     | 86 (penalty×0.678)  | 100                  |
| 160 | 0.5       | 90 (penalty×0.5)    | 100                  |

SC-002 requires 100 BPM score ≥ 10 pts above 40 BPM for 80% accuracy: 86 − 60 = 26 ✓

**Alternatives considered**: Linear ratio (`bpm / 80`). Rejected because it grows unboundedly at high BPMs (e.g., 320 BPM → factor 4×, which collapses penalty too aggressively) and does not reflect human tempo perception, which is logarithmic. The log2 formula with the [0.5, 2.0] clamp keeps the effect in a musically intuitive range.

---

## 3. `tempoMultiplier` Propagation — Practice

### Decision: Add `tempoMultiplier` to `PerformanceRecord` and `PartialPerformanceRecord`

**Rationale**: `ResultsOverlay` currently receives `performanceRecord: PerformanceRecord | null`. `PerformanceRecord` has `bpmAtCompletion` but NOT `tempoMultiplier`. The multiplier is held in `PracticeViewPlugin` state. The cleanest propagation strategy is to embed `tempoMultiplier` in the record at creation time (same place `bpmAtCompletion` is set), so the overlay is self-contained and doesn't need an extra prop thread.

**Construction sites in `PracticeViewPlugin.tsx`**:
- Line 545: `{ ..., bpmAtCompletion: playerState.bpm }` — live complete record
- Line 598: `{ ..., bpmAtCompletion: playerState.bpm }` — live partial record  
- Lines 305/313: loaded-from-storage records (use `saved.performanceData.bpmAtCompletion`)

For loaded records, `SavedPractice.tempoMultiplier` is already stored (Feature 056) and must be passed when constructing the in-memory `PerformanceRecord`.

**Alternatives considered**: Pass `tempoMultiplier` as separate prop to `ResultsOverlay`. Rejected because `ResultsOverlay` already has 15+ props; adding another unrelated to the overlay's existing interface increases coupling unnecessarily. Co-locating with `PerformanceRecord` is more cohesive.

---

## 4. Train BPM Propagation — `ExerciseResult`

### Decision: Add `bpm: number` field to `ExerciseResult`

**Rationale**: `TrainResultsOverlay` receives `result: ExerciseResult | null`. BPM is currently accessible as `exercise.bpm` inside `scoreExercise` / `scoreCapture` but is not carried through to the result object. Adding `bpm` to `ExerciseResult` keeps the overlay self-contained — no need for `TrainPlugin` to pass `bpm` as a separate overlay prop, matching how `SavedTrain.bpm` is already stored.

**Alternatives considered**: Pass `bpm` as a separate prop to `TrainResultsOverlay`. Rejected — same argument as Practice: keeps `ExerciseResult` as the complete result contract. Also, `SavedTrain` already includes `bpm` alongside `result`, so carrying it in the result itself makes the result object fully round-trip without referencing the surrounding context.

---

## 5. Callers of `computePracticeScore` — Impact Audit

| Caller | File | Needs update? |
|--------|------|---------------|
| `ResultsOverlay.practiceReport` (live) | `ResultsOverlay.tsx:197` | Yes — pass `performanceRecord.tempoMultiplier` |
| `ResultsOverlay.partialReport` (live) | `ResultsOverlay.tsx:221` | Yes — pass `partialPerformanceRecord.tempoMultiplier` |
| `PracticeViewPlugin.handleSave` (broadcast) | `PracticeViewPlugin.tsx:833` | Yes — pass `tempoMultiplierRef.current` (already in scope) |

All three callers are in the `practice-view-plugin` package and can import `computePracticeScore` from `src/plugin-api`. The train-view plugin does NOT use `computePracticeScore` (it uses its own `exerciseScorer`).

---

## 6. Test Coverage Gap

### Decision: Create `computePracticeScore.test.ts` and `exerciseScorer.test.ts`

**Rationale**: No dedicated test file exists for `computePracticeScore.ts` (confirmed by file search). `exerciseScorer.ts` also has no dedicated test file. The only tests exercising these paths are integration-level tests inside `PracticeViewPlugin.test.tsx` and `ResultsOverlay.test.tsx`. Principle V (Test-First) requires dedicated unit tests for the formula changes before implementation.

**Minimum required** (SC-006):
- `computePracticeScore.test.ts`: 3 tests — below-1.0×, exactly-1.0×, above-1.0×
- `exerciseScorer.test.ts`: 2 tests — below-reference BPM (40), above-reference BPM (100)

---

## 7. Plugin ESLint Boundary

**Rationale**: `frontend/plugins/train-view/` enforces a no-src-imports ESLint boundary (documented in plugin code headers). All train-view changes are self-contained: `trainTypes.ts`, `exerciseScorer.ts`, `TrainResultsOverlay.tsx`. No imports from `src/` needed.

`frontend/plugins/practice-view-plugin/` is allowed to import from `src/plugin-api/`. The existing import of `computePracticeScore` at `ResultsOverlay.tsx:11` and `PracticeViewPlugin.tsx:45` confirms this.

---

## Resolved Unknowns

All NEEDS CLARIFICATION items from the spec were resolved in the clarification session (see `spec.md` Clarifications section). No open research questions remain.
