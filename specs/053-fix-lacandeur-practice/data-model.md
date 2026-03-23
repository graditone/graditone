# Data Model: Fix Practice Issues in La Candeur

**Feature**: 053-fix-lacandeur-practice  
**Date**: 2026-03-23  
**Status**: Complete

No backend changes. All changes are confined to the frontend practice plugin and score player context.

---

## Existing Entities Affected

### `PracticeState` (modified)

**Location**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

No new fields are added to `PracticeState` proper (the reducer stays minimal). The only state-shape addition is captured in the **component** level (see `PartialPerformanceRecord` below).

**Existing fields used by fixes:**

| Field | Type | Role in fixes |
|-------|------|---------------|
| `mode` | `'inactive' \| 'waiting' \| 'active' \| 'holding' \| 'complete'` | Bug 6: position lock guards against `'waiting' \| 'active' \| 'holding'` |
| `notes` | `ReadonlyArray<PracticeNoteEntry>` | Bug 7: snapshot before STOP |
| `currentIndex` | `number` | Bug 7: snapshot — tracks progress up to stop point |
| `noteResults` | `ReadonlyArray<PracticeNoteResult>` | Bug 7: snapshot — captures partial results |
| `wrongNoteEvents` | `ReadonlyArray<WrongNoteEvent>` | Bug 7: snapshot — captures error events |

---

### `PluginPracticeNoteEntry` (unchanged schema, fixed computation)

**Location**: `frontend/src/plugin-api/types.ts`  
**Computed in**: `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.ts`

No field additions. The fix changes **how** `durationTicks` is computed: the second cross-hand gap truncation is removed so each entry retains its correct per-staff duration.

| Field | Type | Change |
|-------|------|--------|
| `durationTicks` | `number` | Now preserves the first per-staff truncation; no second merged-list truncation |
| `sustainedPitches` | `number[]` | May expand (correctly) as a side effect of the duration fix — longer-lived LH notes now correctly appear as sustained at subsequent RH beats |

**Validation rule**: `durationTicks >= 0`. Zero is legal (staccato — immediate advance).

---

### `PartialPerformanceRecord` (new type in component)

**Location**: `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (component-local type, not exported)

Introduced as a new `useState` local to `PracticeViewPlugin`. Shares the same shape as the existing `PerformanceRecord` with one additional field:

```typescript
interface PartialPerformanceRecord {
  notes: ReadonlyArray<PracticeNoteEntry>;
  noteResults: ReadonlyArray<PracticeNoteResult>;
  wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  bpmAtCompletion: number;
  // New field — only set on partial records:
  stoppedAtIndex: number;    // currentIndex value at stop time
  totalNoteCount: number;    // notes.length at stop time (for "MX of N" display)
}
```

**State transitions:**

```
practiceActive=true, mode=running
    |
    | user presses Stop
    v
handleStop():
  1. snapshot → setPartialPerformanceRecord({ ...current state, stoppedAtIndex, totalNoteCount })
  2. dispatch(STOP)  ← clears practiceState
    |
    v
Results overlay:
  if partialPerformanceRecord → show with "Stopped early" badge + "MX of N" label
  if performanceRecord (natural end) → show full results as today
```

**Validation rules**:
- `stoppedAtIndex >= 0` (can be 0 if stopped before any note played)
- `stoppedAtIndex <= totalNoteCount` always

---

### `isPracticeRunning` derived boolean (new prop threading)

Not a new entity — derived from `mode`:

```typescript
const isPracticeRunning = ['waiting', 'active', 'holding'].includes(practiceState.mode);
```

**Consumer points:**
- `PracticeViewPlugin.tsx`: gates `handleNoteShortTap` (blocks SEEK during practice)
- `PracticeViewPlugin.tsx`: controls disabled state of Return-to-Start button
- `ScoreViewer.tsx`: receives as prop `practiceRunning?: boolean`; when true, suppresses measure-click position changes

**No new props on public plugin API** — all gating is internal to the plugin boundary.

---

## Entity Relationships

```
PracticeState (reducer)
  ├── notes[]: PluginPracticeNoteEntry[]     ← now correctly computed (no double gap truncation)
  │     ├── midiPitches: number[]
  │     ├── noteIds: string[]
  │     ├── durationTicks: number             ← fixed: per-staff gap only
  │     └── sustainedPitches: number[]        ← beneficially widened by duration fix
  ├── currentIndex: number
  ├── noteResults[]: PracticeNoteResult[]
  └── mode: PracticeMode

PracticeViewPlugin (component state)
  ├── practiceState: PracticeState           ← reducer output
  ├── performanceRecord (natural end)        ← existing
  └── partialPerformanceRecord (early stop)  ← NEW
```

---

## State Transitions for Partial Results

```
[running] → [STOP dispatched]
  Before dispatch: capture snapshot
    partialPerformanceRecord = {
      notes: practiceState.notes,
      noteResults: practiceState.noteResults,
      wrongNoteEvents: practiceState.wrongNoteEvents,
      bpmAtCompletion: playerState.bpm,
      stoppedAtIndex: practiceState.currentIndex,
      totalNoteCount: practiceState.notes.length,
    }

[STOP] → PracticeState resets to INITIAL_PRACTICE_STATE

UI: partialPerformanceRecord !== null → show results overlay
  - Score: computed same as practiceReport (but over partial noteResults)
  - Label: "Stopped at M{measure} of {totalMeasures}" (derived from note tick → measure)
```

---

## No New API Contracts

All changes are intra-frontend. No REST endpoints, no WASM API surface, no backend schema changes. The existing TypeScript interfaces between plugin and score renderer are unchanged.
