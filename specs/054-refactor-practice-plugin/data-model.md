# Data Model: Refactor Practice Plugin

**Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)

## Overview

This feature is a pure refactor — no new domain entities or database changes. The "data model" consists of TypeScript interfaces defining the input/output contracts of each extracted hook and component.

## Shared Types (move to practiceEngine.types.ts)

### PerformanceRecord

```typescript
/** Snapshot of a completed practice session for results display and replay. */
interface PerformanceRecord {
  noteResults: ReadonlyArray<PracticeNoteResult>;
  wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  durationMs: number;
  bpm: number;
  loopIteration: number;
}
```

**Source**: Currently defined at PracticeViewPlugin.tsx L46-51.  
**Used by**: usePracticeLoop (writes), ResultsOverlay (reads).

### PartialPerformanceRecord

```typescript
/** Snapshot of an incomplete practice session (stopped mid-practice). */
interface PartialPerformanceRecord {
  noteResults: ReadonlyArray<PracticeNoteResult>;
  wrongNoteEvents: ReadonlyArray<WrongNoteEvent>;
  totalNotes: number;
  completedNotes: number;
  durationMs: number;
  bpm: number;
}
```

**Source**: Currently defined at PracticeViewPlugin.tsx L54-61.  
**Used by**: orchestrator (writes in handleStop), ResultsOverlay (reads).

---

## Hook Interfaces

### usePracticeLoop

```typescript
interface UsePracticeLoopParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
  playerState: ScorePlayerState;
  practiceStartTimeRef: React.RefObject<number>;
  context: PluginContext;
  onComplete: (record: PerformanceRecord) => void;
  onResultsShow: () => void;
}

interface UsePracticeLoopReturn {
  // State
  loopStart: PinState | null;
  loopEndPin: PinState | null;
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;

  // Derived
  pinnedNoteIds: ReadonlySet<string>;
  loopRegion: LoopRegion | null;
  loopPracticeRange: LoopRange | null;

  // Refs (read-only to consumers)
  loopRegionRef: React.RefObject<LoopRegion | null>;
  loopPracticeRangeRef: React.RefObject<LoopRange | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  remainingLoopsRef: React.MutableRefObject<number>;

  // Callbacks
  handleNoteLongPress: (noteId: string) => void;
  resetLoopTracking: () => void;
}
```

**Relationships**:
- Reads `practiceState` (mode, notes, noteResults, wrongNoteEvents, currentIndex)
- Reads `playerState` (bpm, status)
- Writes refs: `loopRegionRef`, `loopPracticeRangeRef`, `loopIterationRef`, `loopStartTimesRef`, `remainingLoopsRef`
- Calls `onComplete` and `onResultsShow` when practice completes

---

### usePracticeMidi

```typescript
interface UsePracticeMidiParams {
  context: PluginContext;
  practiceStateRef: React.RefObject<PracticeState>;
  playerStateRef: React.RefObject<ScorePlayerState>;
  dispatchPractice: React.Dispatch<PracticeAction>;
  loopRegionRef: React.RefObject<LoopRegion | null>;
  loopPracticeRangeRef: React.RefObject<LoopRange | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  practiceStartTimeRef: React.RefObject<number>;
  selectedStaffIndex: number;
}

interface UsePracticeMidiReturn {
  // State
  midiPressedNoteIds: ReadonlySet<string>;
  midiEventTick: number;

  // Refs (read-only to consumers)
  heldMidiKeysRef: React.RefObject<Set<number>>;
  chordDetectorRef: React.RefObject<ChordDetector>;
}
```

**Relationships**:
- Reads refs from usePracticeLoop (loopRegionRef, loopPracticeRangeRef, loopIterationRef, loopStartTimesRef)
- Writes refs: `heldMidiKeysRef`, `chordDetectorRef`
- Provides `midiPressedNoteIds` and `midiEventTick` as reactivity triggers for usePracticeHighlights

---

### usePhantomTempo

```typescript
interface UsePhantomTempoParams {
  practiceState: PracticeState;
  practiceStateRef: React.RefObject<PracticeState>;
  playerStateRef: React.RefObject<ScorePlayerState>;
}

interface UsePhantomTempoReturn {
  phantomIndex: number;
}
```

**Relationships**:
- Reads `practiceState.mode`, `practiceState.notes`, `practiceState.currentIndex`
- Reads `practiceStateRef` and `playerStateRef` inside interval timer
- Provides `phantomIndex` to usePracticeHighlights

---

### useHoldProgress

```typescript
interface UseHoldProgressParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
}

interface UseHoldProgressReturn {
  holdProgress: number;
}
```

**Relationships**:
- Reads `practiceState.mode`, `practiceState.holdStartTimeMs`, `practiceState.requiredHoldMs`
- Dispatches `HOLD_COMPLETE` when progress reaches 90%

---

### usePracticeHighlights

```typescript
interface UsePracticeHighlightsParams {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  midiPressedNoteIds: ReadonlySet<string>;
  midiEventTick: number;
  heldMidiKeysRef: React.RefObject<Set<number>>;
  phantomIndex: number;
  isReplaying: boolean;
  replayHighlightedNoteIds: ReadonlySet<string>;
}

interface UsePracticeHighlightsReturn {
  targetNoteIds: ReadonlySet<string>;
  confirmedNoteIds: ReadonlySet<string>;
  pressedPitchLabels: string[];
  expectedPitchLabels: string[];
  highlightedNoteIds: ReadonlySet<string>;
  practiceActive: boolean;
  practiceWaiting: boolean;
}
```

**Relationships**:
- Reads from usePracticeMidi: `midiPressedNoteIds`, `midiEventTick`, `heldMidiKeysRef`
- Reads from usePhantomTempo: `phantomIndex`
- Reads from ResultsOverlay: `isReplaying`, `replayHighlightedNoteIds`
- Reads from orchestrator: `practiceState`, `playerState`

---

### ResultsOverlay

```typescript
interface ResultsOverlayProps {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  performanceRecord: PerformanceRecord | null;
  partialPerformanceRecord: PartialPerformanceRecord | null;
  resultsOverlayVisible: boolean;
  loopRegion: LoopRegion | null;
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  context: PluginContext;
  onRepractice: () => void;
  onDismiss: () => void;
  onReplayStart: (noteIds: ReadonlySet<string>) => void;
  onReplayStop: () => void;
}

// Internal state managed by ResultsOverlay:
// - isReplaying, replayHighlightedNoteIds, replayTimersRef
// - practiceReport memo, partialReport memo
// - handleReplay, handleReplayStop, handleRepractice callbacks
// - errorNoteIds, errorFlashTimerRef (error flash effect)
```

**Relationships**:
- Receives data from orchestrator via props
- Calls back to orchestrator via `onRepractice`, `onDismiss`, `onReplayStart`, `onReplayStop`
- Internally manages replay state (isReplaying, replayHighlightedNoteIds)

---

## Dependency Graph (Acyclic — FR-011)

```
Orchestrator (PracticeViewPlugin.tsx)
│
├─ useHoldProgress(practiceState, dispatchPractice)
│  └→ holdProgress
│
├─ usePracticeLoop(practiceState, playerState, context, ...)
│  └→ loopRegion, loopRegionRef, loopPracticeRangeRef,
│     loopIterationRef, loopStartTimesRef, pinnedNoteIds, ...
│
├─ usePhantomTempo(practiceState, practiceStateRef, playerStateRef)
│  └→ phantomIndex
│
├─ usePracticeMidi(context, practiceStateRef, playerStateRef,
│                  loopRegionRef, loopPracticeRangeRef, ...)
│  └→ midiPressedNoteIds, midiEventTick, heldMidiKeysRef
│
├─ usePracticeHighlights(practiceState, playerState,
│                        midiPressedNoteIds, midiEventTick,
│                        heldMidiKeysRef, phantomIndex,
│                        isReplaying, replayHighlightedNoteIds)
│  └→ targetNoteIds, confirmedNoteIds, highlightedNoteIds,
│     pressedPitchLabels, expectedPitchLabels
│
└─ <ResultsOverlay ... />  (JSX child component)
   └→ isReplaying, replayHighlightedNoteIds (via callbacks to orchestrator)
```

All arrows flow downward. No hook imports another hook. Only the orchestrator imports all hooks.

---

## State Transitions

No new state machines. The existing `PracticeState` FSM (inactive → waiting → active → holding → complete) is preserved unchanged in `practiceEngine.ts`. The refactoring only moves the _consumers_ of this state machine into separate files.

---

## Validation Rules

No new validation rules. All existing validation (chord detection thresholds, rest-gap intervals, hold duration checks) remains in the respective extracted hooks without modification.
