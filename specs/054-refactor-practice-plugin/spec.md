# Feature Specification: Refactor Practice Plugin into Modular Architecture

**Feature Branch**: `054-refactor-practice-plugin`  
**Created**: 2026-03-23  
**Status**: Draft  
**Input**: User description: "Refactor the 1895-line PracticeViewPlugin.tsx monolithic React component into well-separated modules with clear single responsibilities"

## Clarifications

### Session 2026-03-23
- Q: Should extractions be done incrementally (one per commit with test run) or as a batch? → A: Incremental — one extraction per commit, full test suite run between each.
- Q: Who owns shared refs that multiple hooks read (e.g., heldMidiKeysRef)? → A: Writer-hook creates the ref internally and returns it read-only; orchestrator threads it to reader-hooks.
- Q: Should new unit tests be added for extracted hooks, or rely on existing suite only? → A: Add one smoke test per extracted hook (renderHook verifying return type shape) to catch wiring bugs.
- Q: What order should P1 hooks be extracted given usePracticeMidi depends on loop refs? → A: Extract usePracticeLoop first, then usePracticeMidi consumes its returned refs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Focused MIDI Logic Module (Priority: P1)

As a developer, I can understand and modify the MIDI chord detection logic by reading a single focused module (`usePracticeMidi`) instead of scanning 1895 lines of interleaved concerns.

**Why this priority**: MIDI handling is the largest (~250 lines) and most complex subsystem in the file. It touches chord detection, rest-gap enforcement, hold-mode logic, and correct/wrong note dispatch. Changes here have the highest bug risk and the most to gain from isolation.

**Independent Test**: Can be verified by running the existing PracticeViewPlugin test suite after extracting the hook — all MIDI-related test cases must pass without modification to test logic.

**Acceptance Scenarios**:

1. **Given** the `usePracticeMidi` hook is extracted into its own file, **When** I run the full test suite, **Then** all existing tests pass without changes to test assertions or logic (import paths may change).
2. **Given** the `usePracticeMidi` hook file exists, **When** I inspect it, **Then** it contains only MIDI-related state (`chordDetectorRef`, `heldMidiKeysRef`, `prevPracticeIndexRef`, `midiPressedNoteIds`, `midiEventTick`), the chord detector reset/repin useEffect, and the MIDI subscription useEffect.
3. **Given** the extracted hook, **When** I read PracticeViewPlugin.tsx, **Then** MIDI logic is consumed via a single hook call with clearly named inputs and outputs.

---

### User Story 2 - Isolated Loop Region Logic (Priority: P1)

As a developer, I can write unit tests for loop region computation without rendering the full plugin component, and I can modify loop behavior in isolation.

**Why this priority**: Loop region logic (pin state, loop region memos, multi-loop counters) is scattered across the file and tightly coupled with rendering. Isolating it enables targeted testing and safer loop feature changes.

**Independent Test**: After extraction, `usePracticeLoop` can be tested with `renderHook()` in isolation, and all existing loop-related test cases still pass.

**Acceptance Scenarios**:

1. **Given** the `usePracticeLoop` hook is extracted, **When** I run the test suite, **Then** all loop-related tests pass without logic changes.
2. **Given** the hook file, **When** I inspect it, **Then** it owns `loopStart`, `loopEndPin`, `pinnedNoteIds`, `loopRegion`, `loopPracticeRange`, loop count state, and `handleNoteLongPress`.
3. **Given** the hook, **When** I use it in PracticeViewPlugin.tsx, **Then** loop state is consumed via a single hook call returning all loop-related values and callbacks.

---

### User Story 3 - Separated Results Overlay (Priority: P2)

As a developer, I can modify the results overlay UI without risk of breaking MIDI handling or timing logic, and I can review results-related PRs without wading through unrelated code.

**Why this priority**: The results overlay is ~200 lines of JSX plus memos for report computation and replay state. It is self-contained UI with clear boundaries, making extraction straightforward and impactful for readability.

**Independent Test**: The `ResultsOverlay` component can be rendered in isolation with mock props, and all existing results-display tests pass.

**Acceptance Scenarios**:

1. **Given** `ResultsOverlay` is extracted into its own component file, **When** I run the test suite, **Then** all results overlay and replay tests pass.
2. **Given** the component file, **When** I inspect it, **Then** it contains `practiceReport` and `partialReport` memos, full/partial results JSX, and replay state (`performanceRecord`, `isReplaying`, `replayHighlightedNoteIds`, `handleReplay`, `handleReplayStop`).
3. **Given** the extracted component, **When** I read PracticeViewPlugin.tsx, **Then** results display is a single `<ResultsOverlay ... />` usage with explicit props.

---

### User Story 4 - Focused Highlight Computation (Priority: P2)

As a developer, I can review PRs affecting practice highlighting without wading through unrelated MIDI and loop code.

**Why this priority**: Highlight logic computes which notes to visually emphasize based on practice state. It has well-defined inputs (practice state, player state) and outputs (note ID sets, pitch labels), making it a clean extraction target.

**Independent Test**: `usePracticeHighlights` can be tested with `renderHook()` given mock practice/player state, and all existing highlight tests pass.

**Acceptance Scenarios**:

1. **Given** `usePracticeHighlights` is extracted, **When** I run the test suite, **Then** all highlight-related tests pass.
2. **Given** the hook file, **When** I inspect it, **Then** it owns `targetNoteIds`, `confirmedNoteIds`, `prevCompletedEntryRef`, `confirmedIndexRef`, `pressedPitchLabels`, and `expectedPitchLabels`.

---

### User Story 5 - Isolated Phantom Tempo and Hold Progress (Priority: P3)

As a developer, I can understand and modify phantom tempo highlighting and hold-duration tracking by reading small, focused hooks (~60 and ~40 lines respectively).

**Why this priority**: These are the smallest extraction targets. While individually low-impact, they contribute to reducing PracticeViewPlugin.tsx to a clean orchestrator.

**Independent Test**: Each hook can be tested with `renderHook()` in isolation. Existing phantom tempo and hold progress tests pass unchanged.

**Acceptance Scenarios**:

1. **Given** `usePhantomTempo` is extracted, **When** I inspect it, **Then** it owns `phantomIndex` state, timer refs, and the timer start/stop useEffect with cleanup.
2. **Given** `useHoldProgress` is extracted, **When** I inspect it, **Then** it owns `holdProgress` state, `rafRef`, the rAF loop useEffect, and HOLD_COMPLETE dispatch.
3. **Given** both hooks are extracted, **When** I run the full test suite, **Then** all tests pass without logic changes.

---

### User Story 6 - Clean Orchestrator (Priority: P3)

As a developer, PracticeViewPlugin.tsx reads as a clear orchestrator that wires hooks and sub-components together, making the data flow between subsystems obvious.

**Why this priority**: This is the end-state goal; it depends on all other extractions being complete.

**Independent Test**: After all extractions, PracticeViewPlugin.tsx is ~900 lines and consists primarily of hook calls, prop threading, and JSX composition. The full test suite passes.

**Acceptance Scenarios**:

1. **Given** all extractions are complete, **When** I count lines in PracticeViewPlugin.tsx, **Then** it is approximately 900 lines or fewer.
2. **Given** the refactored file, **When** I read it top-to-bottom, **Then** I can see the data flow: hooks provide state → state is threaded to sub-components → callbacks dispatch actions.
3. **Given** the refactored codebase, **When** I run the entire test suite (unit + E2E), **Then** all 1636+ tests pass without any test logic modifications.

---

### Edge Cases

- What happens if a hook depends on a ref that another hook also reads? Shared refs must be created in the orchestrator and passed down, never duplicated.
- What happens if circular dependencies arise between extracted modules? Module dependency graph must be acyclic; the orchestrator is the only module that imports all hooks.
- What happens if TypeScript type narrowing breaks after extraction? All extracted hooks must have explicit input/output type signatures to preserve type safety.
- What happens if React rendering order changes due to hook extraction? Hooks must be called in the same unconditional order as in the original monolith to preserve React hook rules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `usePracticeMidi` hook MUST be extracted into its own file containing all MIDI subscription logic, chord detector management, and MIDI state (`chordDetectorRef`, `heldMidiKeysRef`, `prevPracticeIndexRef`, `midiPressedNoteIds`, `midiEventTick`).
- **FR-002**: The `usePracticeLoop` hook MUST be extracted into its own file containing loop pin state, loop region memos, multi-loop counters, and `handleNoteLongPress`.
- **FR-003**: The `usePhantomTempo` hook MUST be extracted into its own file containing phantom index state, timer refs, and timer lifecycle effects.
- **FR-004**: The `useHoldProgress` hook MUST be extracted into its own file containing hold progress state, rAF ref, the animation frame loop effect, and HOLD_COMPLETE dispatch.
- **FR-005**: The `ResultsOverlay` component MUST be extracted into its own file containing practice report memos, results JSX, and replay state/callbacks.
- **FR-006**: The `usePracticeHighlights` hook MUST be extracted into its own file containing target/confirmed note ID computation, confirmed index tracking, and pitch label memos.
- **FR-007**: After all extractions, PracticeViewPlugin.tsx MUST remain the single default export conforming to the `GraditonePlugin` interface.
- **FR-008**: After all extractions, PracticeViewPlugin.tsx MUST be approximately 900 lines or fewer, functioning as a thin orchestrator.
- **FR-009**: All 1636+ existing unit tests and E2E tests MUST pass without modification to test logic (import path changes are permitted).
- **FR-010**: Each extracted module MUST have an explicit TypeScript interface for its inputs and outputs.
- **FR-011**: The module dependency graph MUST be acyclic — extracted hooks/components MUST NOT import each other; only the orchestrator imports them.
- **FR-012**: Constitution Principle VI MUST be maintained — no coordinate or layout data may appear in practice logic modules.
- **FR-013**: All new files MUST reside under `frontend/plugins/practice-view-plugin/`.
- **FR-014**: Shared refs MUST follow writer-owns-ref: the hook that writes a ref creates it internally and exposes it as `React.RefObject<T>` (read-only) in its return type. The orchestrator threads the read-only ref to other hooks that consume it. No ref may be duplicated across hooks.
- **FR-015**: Each extracted hook MUST have one smoke test using `renderHook()` that verifies the return type shape (all expected keys present with correct types). These tests go in a co-located `*.test.ts` file alongside the hook.

### Key Entities

- **PracticeViewPlugin (Orchestrator)**: The main component that wires together all hooks and sub-components. Creates shared state/refs and threads them to child modules.
- **usePracticeMidi**: Custom hook owning MIDI device subscription, chord detection, note press/release handling, and rest-gap enforcement.
- **usePracticeLoop**: Custom hook owning loop region computation, pin state, multi-loop iteration tracking, and long-press callbacks.
- **usePhantomTempo**: Custom hook owning phantom tempo beat highlighting with timer-based animation.
- **useHoldProgress**: Custom hook owning hold-duration progress tracking with requestAnimationFrame.
- **usePracticeHighlights**: Custom hook owning note highlight computation (target, confirmed, pressed, expected pitch labels).
- **ResultsOverlay**: React component owning practice results display, report computation, and replay functionality.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 1636+ existing unit tests pass after refactoring with zero test logic modifications.
- **SC-002**: All existing E2E tests pass after refactoring with zero test logic modifications.
- **SC-003**: PracticeViewPlugin.tsx line count is reduced from ~1895 to ~900 or fewer lines.
- **SC-004**: Six new modules are created (4 hooks, 1 component, 1 hook), each with a single clearly defined responsibility.
- **SC-005**: No user-facing behavior changes — the practice view looks and functions identically before and after refactoring.
- **SC-006**: A developer new to the codebase can identify which file to modify for a given concern (MIDI, looping, results, highlighting, tempo, hold progress) without reading more than one module.
- **SC-007**: Each extracted hook can be tested independently using `renderHook()` without mounting the full plugin component.

## Assumptions

- The existing test suite (1636+ tests) provides sufficient coverage to detect any behavioral regressions introduced by the refactoring.
- React hook ordering constraints can be preserved by calling extracted hooks in the same order as the original inline logic.
- All shared state between hooks can be mediated through the orchestrator via parameters and return values (no need for additional React context).
- The existing project conventions (as seen in `practiceEngine.ts`, `mergePracticeNotesByTick.ts`) provide adequate patterns for the new module structure.
- Import path changes in test files (e.g., importing types from a new hook file) do not constitute "test logic modifications."

## Constraints

- Pure refactor: zero behavior changes, zero new features, zero API changes.
- No new dependencies may be added.
- The plugin must remain a single default export conforming to the `GraditonePlugin` interface.
- New files go under `frontend/plugins/practice-view-plugin/` only.
- Constitution Principle VI must be maintained throughout: no coordinate/layout data in practice logic.
- **Incremental extraction strategy**: Each module is extracted in its own commit with a full test suite run between extractions to catch regressions early. Order follows P1 → P2 → P3 priority.
- **Extraction order within P1**: `usePracticeLoop` first (produces `loopRegionRef`, `loopPracticeRangeRef`), then `usePracticeMidi` (consumes those refs). This avoids temporary scaffolding.

