# Data Model: Tempo Impact on Practice and Train Results

**Feature**: 072-tempo-impact-results  
**Phase**: 1 — Design  
**Date**: 2026-04-04

---

## Modified Entities

### 1. `PracticeScoreBreakdown` (extended)

**Location**: `frontend/src/plugin-api/computePracticeScore.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `totalNotes` | `number` | existing | Total notes attempted |
| `correctCount` | `number` | existing | Notes played correctly on first attempt |
| `lateCount` | `number` | existing | Notes marked correct-late |
| `earlyReleaseCount` | `number` | existing | Notes with early release |
| `totalWrongAttempts` | `number` | existing | Sum of wrong attempts across all notes |
| `score` | `number` | existing | Final 0–100 clamped score (now reflects tempo) |
| `tempoMultiplier` | `number` | **NEW** | The multiplier that was applied (stored for display callers); 1.0 if not supplied |

**Formula change**: `score = clamp(round(rawAccuracy × min(1.0, tempoMultiplier)), 0, 100)`

---

### 2. `PerformanceRecord` (extended)

**Location**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `notes` | `PluginPracticeNoteEntry[]` | existing | Practice note entries |
| `noteResults` | `PracticeNoteResult[]` | existing | Per-note outcomes |
| `wrongNoteEvents` | `WrongNoteEvent[]` | existing | Wrong key presses |
| `bpmAtCompletion` | `number` | existing | Effective BPM at completion (for display and replay timing) |
| `tempoMultiplier` | `number` | **NEW** | Tempo multiplier applied during this session (for score formula input) |

**Construction sites**: `PracticeViewPlugin.tsx` lines ~545 (live complete), ~598 (live partial), ~305 and ~313 (loaded from storage via `SavedPractice.tempoMultiplier`).

---

### 3. `PartialPerformanceRecord` (extended)

**Location**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

Same extension as `PerformanceRecord` — add `tempoMultiplier: number`.

---

### 4. `ExerciseResult` (extended)

**Location**: `frontend/plugins/train-view/trainTypes.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `comparisons` | `NoteComparison[]` | existing | Per-slot comparisons |
| `extraneousNotes` | `ResponseNote[]` | existing | Unmatched responses |
| `score` | `number` | existing + formula change | Final 0–100 score (now includes log2 BPM factor) |
| `correctPitchCount` | `number` | existing | Slots with correct pitch |
| `correctTimingCount` | `number` | existing | Slots with correct timing |
| `bpm` | `number` | **NEW** | BPM of the exercise used to produce this result (for overlay display and storage) |

**Formula change** (in `exerciseScorer.scoreExercise`):
```
bpmFactor = clamp(1 - log2(bpm / 80), 0.5, 2.0)
penalty   = 100 - rawScore
score     = clamp(round(100 - penalty × bpmFactor), 0, 100)
```

---

## No Schema Migrations Required

- `SavedPractice.tempoMultiplier` (IndexedDB): already stored since Feature 056 — no migration.
- `SavedPerformanceData.bpmAtCompletion` (IndexedDB): already stored since Feature 056 — no migration.
- `SavedTrain.bpm` and `SavedTrain.result` (IndexedDB): `bpm` already stored since Feature 071. Adding `bpm` to `ExerciseResult` means new saves will include it in `result.bpm`; old saves without it will get `result.bpm = undefined`. `TrainResultsOverlay` must handle `result.bpm ?? 0` gracefully (display "—" when 0).
- The `score` field in stored `SavedTrain.result` and `SavedPractice.performanceData` reflects the formula at time of save and is NEVER recomputed on load (FR-008).

---

## Relationships

```
PracticeViewPlugin
  │  (builds at save time)
  ▼
PerformanceRecord { notes, noteResults, wrongNoteEvents, bpmAtCompletion, tempoMultiplier }
  │  (passed to)
  ▼
ResultsOverlay
  │  (calls)
  ▼
computePracticeScore(noteResults, tempoMultiplier?)
  │  (returns)
  ▼
PracticeScoreBreakdown { score, tempoMultiplier, ... }
  │  (displayed in score header)
  ▼
"Score: 75 / 100
 90 BPM · 75%"


TrainExercise { notes, bpm }
  │  (scored by)
  ▼
scoreExercise(exercise, responses, extraneous, options)
  │  applies log2(bpm/80) penalty factor
  │  (returns)
  ▼
ExerciseResult { comparisons, score, bpm, ... }
  │  (displayed by)
  ▼
TrainResultsOverlay
  "Score: 86 / 100
   100 BPM"
```
