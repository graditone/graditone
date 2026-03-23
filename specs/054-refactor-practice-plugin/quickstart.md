# Quickstart: 054 Refactor Practice Plugin

## Overview

Decompose `PracticeViewPlugin.tsx` (1895 lines) into 6 focused modules + a ~800-line orchestrator. Pure refactor — zero behavior changes.

## Prerequisites

- Branch: `054-refactor-practice-plugin`
- Node.js, npm installed
- All existing tests passing: `cd frontend && npx vitest run`

## Extraction Sequence

Execute in order. Run **full test suite after each commit**.

### Step 1: usePracticeLoop (P1)

**Create** `frontend/plugins/practice-view-plugin/usePracticeLoop.ts`

Extract from PracticeViewPlugin.tsx:
- State: `loopCount`, `remainingLoopsRef`, `loopIterationRef`, `loopStartTimesRef`, `loopStart`, `loopEndPin` (L207-216, L283-284)
- Memos: `pinnedNoteIds`, `loopRegion`, `loopPracticeRange` (L286-322)
- Refs: `loopRegionRef`, `loopPracticeRangeRef` (L303, L325)
- Effect: loop-restart on complete (L219-243)
- Callback: `handleNoteLongPress` (L1012-1051)
- Add: `resetLoopTracking()` callback for orchestrator

**Replace** extracted code in PracticeViewPlugin.tsx with:
```ts
const { loopRegion, loopRegionRef, loopPracticeRange, loopPracticeRangeRef,
        pinnedNoteIds, loopStart, loopEndPin, loopCount, setLoopCount,
        loopIterationRef, loopStartTimesRef, remainingLoopsRef,
        handleNoteLongPress, resetLoopTracking } = usePracticeLoop({
  practiceState, dispatchPractice, playerState, practiceStartTimeRef,
  context, onComplete: ..., onResultsShow: ...
});
```

**Write smoke test** `usePracticeLoop.test.ts`:
```ts
const { result } = renderHook(() => usePracticeLoop({...mockParams}));
expect(result.current.loopRegion).toBeNull();
expect(result.current.loopRegionRef).toBeDefined();
expect(typeof result.current.handleNoteLongPress).toBe('function');
```

**Verify**: `npx vitest run` → all 1636+ tests pass. Commit.

### Step 2: usePracticeMidi (P1)

**Create** `frontend/plugins/practice-view-plugin/usePracticeMidi.ts`

Extract from PracticeViewPlugin.tsx:
- State: `midiPressedNoteIds`, `midiEventTick` (L568, L571)
- Refs: `chordDetectorRef`, `prevPracticeIndexRef`, `heldMidiKeysRef`, `allNotesRef`, `prevLoadKeyRef` (L478-479, L544-548, L577)
- Effects: chord detector reset (L481-538), all-notes rebuild (L549-565), teardown (L580-591), MIDI subscription (L594-801), staff count reset (L804-808)

Consumes refs from usePracticeLoop: `loopRegionRef`, `loopPracticeRangeRef`, `loopIterationRef`, `loopStartTimesRef`.

**Verify**: `npx vitest run` → all tests pass. Commit.

### Step 3: ResultsOverlay (P2)

**Create** `frontend/plugins/practice-view-plugin/ResultsOverlay.tsx`

Extract from PracticeViewPlugin.tsx:
- Move types: `PerformanceRecord`, `PartialPerformanceRecord` to `practiceEngine.types.ts`
- Move helpers: `midiToLabel`, `formatTimeMs` to ResultsOverlay
- State: `errorNoteIds`, `errorFlashTimerRef` (L194-195)
- Memos: `practiceReport`, `partialReport` (L1286-1365)
- Effect: error flash (L246-263)
- Callbacks: `handleReplayStop`, `handleReplay`, `handleRepractice` (L1070-1159)
- JSX: complete results overlay (L1494-1807), partial results overlay (L1808-1893)

Replay state (`isReplaying`, `replayHighlightedNoteIds`) stays in orchestrator and is passed as props.

**Verify**: `npx vitest run` → all tests pass. Commit.

### Step 4: usePracticeHighlights (P2)

**Create** `frontend/plugins/practice-view-plugin/usePracticeHighlights.ts`

Extract from PracticeViewPlugin.tsx:
- Refs: `prevCompletedEntryRef`, `confirmedIndexRef` (L471-472)
- Derived: `practiceActive`, `practiceWaiting` (L1165-1166)
- Memos: `targetNoteIds`, `confirmedNoteIds`, `pressedPitchLabels`, `expectedPitchLabels` (L1185-1281)
- Derived: `highlightedNoteIds` (L1168-1176)

**Verify**: `npx vitest run` → all tests pass. Commit.

### Step 5: usePhantomTempo (P3)

**Create** `frontend/plugins/practice-view-plugin/usePhantomTempo.ts`

Extract from PracticeViewPlugin.tsx:
- State: `phantomIndex` (L395)
- Refs: `phantomTimerRef`, `phantomStartTimeRef`, `phantomNotesRef`, `phantomBpmRef`, `phantomBaseTickRef` (L396-400)
- Effects: start/stop timer (L404-454), cleanup (L457-464)

**Verify**: `npx vitest run` → all tests pass. Commit.

### Step 6: useHoldProgress (P3)

**Create** `frontend/plugins/practice-view-plugin/useHoldProgress.ts`

Extract from PracticeViewPlugin.tsx:
- State: `holdProgress`, `rafRef` (L131-132)
- Effects: rAF loop (L337-373), cleanup (L376-383)

**Verify**: `npx vitest run` → all tests pass. Commit.

### Step 7: Final Verification

- Line count: `wc -l frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` → ~800-900
- Full test suite: `npx vitest run` → 1636+ pass
- E2E: `npx playwright test` → all pass
- TS build: `npx tsc --noEmit` → clean

## Key Patterns

### Writer-owns-ref
```ts
// Inside usePracticeLoop:
const loopRegionRef = useRef<LoopRegion | null>(null);
// ... update loopRegionRef.current = loopRegion;
return { loopRegionRef }; // returned as React.RefObject (read-only)

// In orchestrator:
const { loopRegionRef } = usePracticeLoop({...});
// Pass read-only to usePracticeMidi:
usePracticeMidi({ loopRegionRef, ... });
```

### Smoke test pattern
```ts
import { renderHook } from '@testing-library/react';
import { useHookName } from './useHookName';

it('returns expected shape', () => {
  const { result } = renderHook(() => useHookName({...mocks}));
  expect(result.current.fieldA).toBeDefined();
  expect(typeof result.current.callbackB).toBe('function');
});
```

## Validation Checklist

- [ ] All 1636+ unit tests pass after each extraction
- [ ] All E2E tests pass after all extractions
- [ ] PracticeViewPlugin.tsx ≤ 900 lines
- [ ] 6 new module files created
- [ ] 6 new smoke test files created
- [ ] No hook imports another hook (acyclic graph)
- [ ] No new dependencies added
- [ ] `tsc --noEmit` clean
