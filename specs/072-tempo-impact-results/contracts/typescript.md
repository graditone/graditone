# TypeScript Contracts: Tempo Impact on Practice and Train Results

**Feature**: 072-tempo-impact-results  
**Date**: 2026-04-04

All changes are additive (optional fields or additional parameters with defaults). No breaking changes to existing consumers.

---

## 1. `computePracticeScore` — extended signature

**File**: `frontend/src/plugin-api/computePracticeScore.ts`

```typescript
// BEFORE
export function computePracticeScore(
  noteResults: ReadonlyArray<ScorableNoteResult>,
): PracticeScoreBreakdown | null

// AFTER
export function computePracticeScore(
  noteResults: ReadonlyArray<ScorableNoteResult>,
  tempoMultiplier?: number,   // optional — defaults to 1.0; no change for existing callers
): PracticeScoreBreakdown | null
```

```typescript
// BEFORE
export interface PracticeScoreBreakdown {
  readonly totalNotes: number;
  readonly correctCount: number;
  readonly lateCount: number;
  readonly earlyReleaseCount: number;
  readonly totalWrongAttempts: number;
  readonly score: number;
}

// AFTER
export interface PracticeScoreBreakdown {
  readonly totalNotes: number;
  readonly correctCount: number;
  readonly lateCount: number;
  readonly earlyReleaseCount: number;
  readonly totalWrongAttempts: number;
  readonly score: number;
  /** The tempoMultiplier applied to produce `score`. Always in [0, 1] after clamping. */
  readonly tempoMultiplier: number;
}
```

**Formula contract**:
- `score = clamp(round(rawAccuracy × min(1.0, tempoMultiplier ?? 1.0)), 0, 100)`
- `rawAccuracy` is the pre-existing formula result (accuracy ratio × 100 − wrong-attempt penalty)
- `tempoMultiplier = 0` or `tempoMultiplier <= 0`: treated as `1.0` (guard against edge-case legacy data)
- `tempoMultiplier >= 1.0`: `min(1.0, multiplier) = 1.0` → no reduction

---

## 2. `PerformanceRecord` — extended type

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

```typescript
// BEFORE
export interface PerformanceRecord {
  notes: PluginPracticeNoteEntry[];
  noteResults: PracticeNoteResult[];
  wrongNoteEvents: WrongNoteEvent[];
  bpmAtCompletion: number;
}

// AFTER
export interface PerformanceRecord {
  notes: PluginPracticeNoteEntry[];
  noteResults: PracticeNoteResult[];
  wrongNoteEvents: WrongNoteEvent[];
  bpmAtCompletion: number;
  /** Tempo multiplier active at completion — input to computePracticeScore. */
  tempoMultiplier: number;
}

// BEFORE
export interface PartialPerformanceRecord {
  notes: ReadonlyArray<PluginPracticeNoteEntry>;
  noteResults: ReadonlyArray<PracticeNoteResult>;
  wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  bpmAtCompletion: number;
  stoppedAtIndex: number;
  totalNoteCount: number;
}

// AFTER
export interface PartialPerformanceRecord {
  notes: ReadonlyArray<PluginPracticeNoteEntry>;
  noteResults: ReadonlyArray<PracticeNoteResult>;
  wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  bpmAtCompletion: number;
  /** Tempo multiplier active at stop time — input to computePracticeScore. */
  tempoMultiplier: number;
  stoppedAtIndex: number;
  totalNoteCount: number;
}
```

---

## 3. `ExerciseResult` — extended type

**File**: `frontend/plugins/train-view/trainTypes.ts`

```typescript
// BEFORE
export interface ExerciseResult {
  comparisons: NoteComparison[];
  extraneousNotes: ResponseNote[];
  score: number;
  correctPitchCount: number;
  correctTimingCount: number;
}

// AFTER
export interface ExerciseResult {
  comparisons: NoteComparison[];
  extraneousNotes: ResponseNote[];
  /** Final 0–100 score, adjusted for BPM difficulty via log2 normalisation. */
  score: number;
  correctPitchCount: number;
  correctTimingCount: number;
  /** BPM of the exercise. Used for display in TrainResultsOverlay. */
  bpm: number;
}
```

---

## 4. `scoreExercise` — BPM factor formula contract

**File**: `frontend/plugins/train-view/exerciseScorer.ts`

```typescript
// Formula (inline in scoreExercise):
const referenceBpm = 80;
const bpmFactor = Math.max(0.5, Math.min(2.0,
  1 - Math.log2((exercise.bpm > 0 ? exercise.bpm : referenceBpm) / referenceBpm)
));
const penalty = 100 - rawScore;
const adjustedScore = Math.max(0, Math.min(100, Math.round(100 - penalty * bpmFactor)));

return {
  comparisons,
  extraneousNotes,
  score: adjustedScore,
  correctPitchCount,
  correctTimingCount,
  bpm: exercise.bpm,   // NEW
};
```

**Guard**: `exercise.bpm <= 0` → fall through to `referenceBpm` (neutral factor 1.0), satisfying the "skip tempo weighting for bpm=0" edge case from the spec.

---

## 5. `TrainResultsOverlayProps` — no interface change needed

`TrainResultsOverlay` already receives `result: ExerciseResult | null`. Since `bpm` is now part of `ExerciseResult`, no new prop is required. The overlay reads `result.bpm` directly:

```typescript
// Display in score header (implementation guidance, not a contract change):
const bpmLabel = result.bpm > 0 ? `${result.bpm} BPM` : null;
```

---

## 6. Practice `ResultsOverlay` — call-site changes (no prop change)

`ResultsOverlay` already receives `performanceRecord: PerformanceRecord | null`. Since `tempoMultiplier` is now part of `PerformanceRecord`, no new prop is required. The overlay passes it to `computePracticeScore`:

```typescript
// Complete results (practiceReport useMemo):
const breakdown = computePracticeScore(results, performanceRecord?.tempoMultiplier ?? 1.0);

// Partial results (partialReport useMemo):
const breakdown = computePracticeScore(noteResults, partialPerformanceRecord?.tempoMultiplier ?? 1.0);

// Subtitle display in score header:
const bpmLabel = bpmAtCompletion > 0 ? `${bpmAtCompletion} BPM` : null;
const multiplierLabel = `${Math.round((tempoMultiplier ?? 1.0) * 100)}%`;
// Render: "{bpmLabel} · {multiplierLabel}" or just "{multiplierLabel}" if bpmAtCompletion=0
```
