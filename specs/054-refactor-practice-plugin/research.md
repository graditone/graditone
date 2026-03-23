# Research: Refactor Practice Plugin into Modular Architecture

**Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)

## R-001: Hook Extraction Strategy for Monolithic React Components

**Decision**: Incremental extraction — one hook per commit, full test suite run between each.

**Rationale**: The 1895-line PracticeViewPlugin.tsx has deep interconnections between its 6 subsystems. Incremental extraction catches regressions at the point of introduction rather than requiring bisection across a multi-hook batch commit.

**Alternatives considered**:
- Batch extraction (all at once): Rejected — if tests break, harder to isolate which extraction caused the failure.
- Feature flag approach (old + new coexist): Rejected — unnecessary complexity for a pure refactor.

---

## R-002: Shared Ref Ownership Pattern

**Decision**: Writer-owns-ref. The hook that mutates a ref creates it internally with `useRef()` and returns it as `React.RefObject<T>` (read-only). The orchestrator threads the read-only ref to consumer hooks.

**Rationale**: This pattern:
- Prevents ref duplication across hooks (FR-014)
- Makes mutation authority explicit — only one hook can write
- Preserves React hook rules (ref created in same render cycle as the hook)
- Existing codebase pattern: `useNoteHighlight` uses `useRef` internally, returns stable reference

**Alternatives considered**:
- Orchestrator-owns-all-refs: Rejected — would keep most refs in the 800-line orchestrator, defeating the purpose.
- Context-based sharing: Rejected — overkill for same-component hook communication; adds unnecessary re-renders.

**Ref ownership map**:
| Ref | Writer | Readers |
|-----|--------|---------|
| `loopRegionRef` | usePracticeLoop | usePracticeMidi, orchestrator (handleStop, handlePracticeToggle) |
| `loopPracticeRangeRef` | usePracticeLoop | usePracticeMidi |
| `loopIterationRef` | usePracticeLoop | usePracticeMidi |
| `loopStartTimesRef` | usePracticeLoop | usePracticeMidi |
| `remainingLoopsRef` | usePracticeLoop | orchestrator (handlePracticeToggle) |
| `heldMidiKeysRef` | usePracticeMidi | usePracticeHighlights |
| `chordDetectorRef` | usePracticeMidi | (internal only) |
| `prevPracticeIndexRef` | usePracticeMidi | (internal only) |
| `allNotesRef` | usePracticeMidi | (internal only) |
| `practiceStateRef` | orchestrator | usePracticeMidi, usePhantomTempo |
| `playerStateRef` | orchestrator | usePracticeMidi, usePhantomTempo |
| `practiceStartTimeRef` | orchestrator | usePracticeMidi, usePracticeLoop |
| `phantomTimerRef` | usePhantomTempo | (internal only) |
| `rafRef` | useHoldProgress | (internal only) |
| `replayTimersRef` | ResultsOverlay | (internal only) |

---

## R-003: renderHook Smoke Test Pattern

**Decision**: Each extracted hook gets one smoke test verifying return type shape using `renderHook()` from `@testing-library/react`.

**Rationale**: Existing codebase has 15 test files using `renderHook`. The pattern is well-established:
```ts
const { result } = renderHook(() => useHook(args));
expect(result.current.someField).toBeDefined();
```

**Pattern details**:
- Constructor args: mock `PluginContext`, initial `PracticeState`, initial `ScorePlayerState`
- Assertions: verify all expected keys present, correct types (ref vs value vs callback)
- No behavioral assertions — those are covered by existing 1636+ tests
- File naming: `useHookName.test.ts` co-located with hook file

**Alternatives considered**:
- Full behavioral tests per hook: Rejected — existing integration tests already cover behavior; smoke tests catch wiring regressions.
- No new tests: Rejected — FR-015 mandates smoke tests, and they catch export/import mistakes during extraction.

---

## R-004: Extraction Order and Dependency Graph

**Decision**: Extract in order: usePracticeLoop → usePracticeMidi → ResultsOverlay → usePracticeHighlights → usePhantomTempo → useHoldProgress.

**Rationale**: Dependency-driven order minimizes temporary scaffolding:
1. **usePracticeLoop** (no hook dependencies) — produces refs consumed by usePracticeMidi
2. **usePracticeMidi** (depends on usePracticeLoop refs) — produces state consumed by highlights
3. **ResultsOverlay** (depends on orchestrator state only) — large JSX block, independent extraction
4. **usePracticeHighlights** (depends on usePracticeMidi output + usePhantomTempo output) — extracted after its providers
5. **usePhantomTempo** (depends on practiceStateRef only) — small, independent
6. **useHoldProgress** (depends on practiceState only) — smallest, cleanest extraction

Note: Steps 4-6 order is flexible. usePhantomTempo before usePracticeHighlights avoids a temporary inline `phantomIndex` in the orchestrator — but since the orchestrator already has it, either order works.

**Dependency graph** (acyclic — FR-011):
```
orchestrator
├── usePracticeLoop
│   └── (produces refs) → usePracticeMidi
│                          └── (produces state) → usePracticeHighlights
├── usePhantomTempo
│   └── (produces phantomIndex) → usePracticeHighlights
├── useHoldProgress
└── ResultsOverlay
```

---

## R-005: Orchestrator Interaction Points

**Decision**: `handleStop` and `handlePracticeToggle` remain in the orchestrator. They interact with extracted hooks via:
- **Refs**: Read `loopRegionRef.current` from usePracticeLoop (read-only)
- **Setters**: Call `setLoopCount`, reset `remainingLoopsRef.current` etc. — usePracticeLoop must expose reset functions
- **Dispatch**: Call `dispatchPractice` directly (reducer stays in orchestrator)

**Rationale**: These handlers orchestrate multiple subsystems simultaneously (stop playback + snapshot results + reset loop state + dispatch engine actions). They are cross-cutting concerns that belong in the orchestrator by definition.

**Reset pattern for usePracticeLoop**:
The hook must expose a `resetLoopTracking()` callback that:
- Sets `remainingLoopsRef.current = 0`
- Sets `loopIterationRef.current = 0`
- Sets `loopStartTimesRef.current = [0]`
This callback is called by `handlePracticeToggle` during restart.

---

## R-006: React Hook Ordering Preservation

**Decision**: Extracted hooks are called at the top of the component in the same unconditional order as the original inline logic.

**Rationale**: React requires hooks to be called in the same order on every render. Since the original PracticeViewPlugin calls all useState/useEffect/useMemo unconditionally (no conditional hook calls detected), the extracted hooks can be called in any consistent order. We choose: useHoldProgress → usePracticeLoop → usePhantomTempo → usePracticeMidi → usePracticeHighlights → ResultsOverlay (via JSX).

This roughly follows the declaration order in the original file (L131 holdProgress → L207 loop → L395 phantom → L478 midi → L1165 highlights → L1494 results JSX).

**Alternatives considered**:
- Calling hooks conditionally (e.g., only when practice is active): Rejected — violates React hook rules.

---

## R-007: Type Export Strategy

**Decision**: Each hook exports its own interface types from the same file. Types shared across hooks (e.g., `PerformanceRecord`, `PartialPerformanceRecord`) move to `practiceEngine.types.ts`.

**Rationale**: 
- `PerformanceRecord` (L46-51) and `PartialPerformanceRecord` (L54-61) are used by both the loop complete effect and ResultsOverlay — they are domain types, not hook-specific.
- `midiToLabel` (L68-72) and `formatTimeMs` (L74-78) are utilities used by ResultsOverlay JSX — they move to ResultsOverlay or a shared utils file.
- Each hook's input/output interface (FR-010) is exported from the hook file itself.

---

## R-008: MIDI Connectivity Hook Decision

**Decision**: The MIDI connectivity logic (`midiConnected` state + subscription effect at L158-179) stays in orchestrator rather than being folded into `usePracticeMidi`.

**Rationale**: MIDI connectivity is a separate concern from MIDI note handling. The connectivity state feeds the toolbar (showing connected/disconnected indicator), not the practice note logic. Keeping it in the orchestrator maintains its independence and avoids coupling toolbar UI state to the practice MIDI hook.

---

## R-009: Error Flash Logic Placement

**Decision**: Error flash state (`errorNoteIds`, `errorFlashTimerRef`) and the auto-advance effect (L246-263) move to `ResultsOverlay` since error flashing is a visual feedback concern tied to wrong-note display.

**Rationale**: Error flash happens when the practice engine auto-advances past a wrong note (after MAX_CONSECUTIVE_WRONG). The flash applies `errorNoteIds` to the score renderer for 600ms. This is visual feedback — it belongs with the results/feedback module rather than the MIDI module.

**Alternative**: Keep in orchestrator since it affects ScoreRenderer props. Acceptable but adds to orchestrator size without clear benefit.
