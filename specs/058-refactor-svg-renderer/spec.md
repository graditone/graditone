# Feature Specification: Refactor SVG Renderer

**Feature Branch**: `058-refactor-svg-renderer`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Refactor SVG Renderer from engine layout output. This critical piece of code has huge files with lots of responsibilities inside. It is time to do a first refactor of it"

## Clarifications

### Session 2026-03-26

- Q: Should extracted modules (HighlightManager, InteractionHandler, etc.) be stateful classes, stateless pure functions, or a hybrid? → A: Plain classes with encapsulated state (e.g., HighlightManager holds its own Sets and frame monitor)
- Q: Should SMuFL glyph codepoint mappings be co-located with SVG element factories or separated? → A: Separate dedicated SMuFL module for codepoint mappings and glyph metadata
- Q: How should the refactor handle test files that import internals from the old file paths? → A: Update import paths only (no changes to test logic, assertions, or structure)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain identical score rendering after refactor (Priority: P1)

As a user viewing any music score in Graditone, when the SVG renderer code is refactored into smaller, focused modules, the rendered output must be pixel-identical to the current rendering. No visual regressions should occur — every note, staff line, barline, ledger line, and annotation must appear in the exact same position with the same styling.

**Why this priority**: If the refactored renderer produces different visual output, it breaks the core product experience. Visual correctness is the non-negotiable foundation for any internal refactoring.

**Independent Test**: Load each preloaded score (Bach Invention No. 1, Beethoven Fur Elise, Burgmuller Arabesque, Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D) and verify that the rendered SVG output matches the baseline. All existing rendering tests must pass without modification.

**Acceptance Scenarios**:

1. **Given** the refactored renderer is deployed, **When** a user loads any previously renderable score, **Then** the visual output is identical to the pre-refactor rendering
2. **Given** the refactored renderer is deployed, **When** a user scrolls through a long score, **Then** viewport virtualization continues to show/hide systems correctly with no rendering glitches
3. **Given** the refactored renderer is deployed, **When** a user resizes the browser window, **Then** the score re-renders correctly at the new viewport size

---

### User Story 2 - Maintain playback highlight responsiveness after refactor (Priority: P1)

As a user practicing a piece with MIDI playback, when notes are highlighted during playback, the highlight animations must remain just as responsive and smooth as before the refactor. The two-tier highlight model (structural re-renders vs. incremental highlight updates) must continue functioning correctly.

**Why this priority**: Playback highlighting is a core interactive feature. If the refactor degrades highlight performance or breaks the incremental update path, the practice experience suffers directly.

**Independent Test**: Play back a score and verify that note highlights appear in time with audio, that pinned/error/expected highlights display correctly, and that frame budget monitoring works as expected.

**Acceptance Scenarios**:

1. **Given** a score is playing back, **When** the current playback position advances, **Then** note highlights update within the same frame budget as before the refactor
2. **Given** multiple highlight types are active (highlighted, pinned, error, expected), **When** playback progresses, **Then** each highlight type renders correctly with the appropriate visual style
3. **Given** a low-performance device, **When** playback is active, **Then** the frame budget monitor degrades highlights gracefully without dropping audio sync

---

### User Story 3 - Preserve note interaction and selection after refactor (Priority: P2)

As a user clicking on individual notes in a rendered score, the click-to-select behavior must continue working identically. Clicking a note must identify the correct note and trigger the appropriate selection callback.

**Why this priority**: Note interactivity is essential for practice mode and annotation features. While less critical than rendering correctness, breaking note clicks would degrade the user experience significantly.

**Independent Test**: Click on various notes across different staves, instruments, and positions. Verify that the correct note is identified and the selection callback fires with the expected note reference.

**Acceptance Scenarios**:

1. **Given** a rendered score, **When** a user clicks on a note, **Then** the correct note is identified via event delegation and the selection callback fires
2. **Given** a score with multiple instruments, **When** a user clicks notes in different staff groups, **Then** each click correctly identifies the note regardless of which staff group it belongs to

---

### User Story 4 - Improve developer experience for renderer maintenance (Priority: P2)

As a developer working on the Graditone renderer, when I need to modify rendering behavior (e.g., fix a glyph positioning bug, add a new annotation type, or tune highlight performance), I should be able to locate the relevant code quickly in a focused, well-scoped module rather than navigating a 1,500+ line monolithic file.

**Why this priority**: The primary goal of this refactoring is to improve maintainability. Smaller, focused modules reduce cognitive load, make code reviews easier, and decrease the risk of unintended side effects when making changes.

**Independent Test**: A developer unfamiliar with the renderer internals can locate and modify the code responsible for a specific concern (e.g., highlight management, glyph rendering, or interaction handling) without reading the entire renderer file.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** a developer needs to fix a highlight bug, **Then** the highlight-related code is in a dedicated module of no more than 400 lines
2. **Given** the refactored codebase, **When** a developer needs to modify glyph rendering, **Then** the glyph rendering pipeline code is in its own module, separate from highlight and interaction logic
3. **Given** the refactored codebase, **When** a developer runs the existing test suite, **Then** all tests pass with no changes to test code (tests exercise public interface only)

---

### User Story 5 - Preserve loop region overlay rendering after refactor (Priority: P3)

As a user who has set a loop region for practicing a specific passage, the semi-transparent overlay indicating the loop boundaries must render correctly after the refactor.

**Why this priority**: Loop regions are a secondary practice feature. While important, they are less foundational than core rendering and highlighting.

**Independent Test**: Set a loop region on a score and verify the overlay renders at the correct boundaries with the expected visual style.

**Acceptance Scenarios**:

1. **Given** a loop region is defined, **When** the score renders, **Then** a semi-transparent overlay appears at the exact loop start and end positions
2. **Given** a loop region spans multiple systems, **When** the user scrolls, **Then** the overlay clips correctly to the visible viewport

---

### Edge Cases

- What happens when the renderer receives a layout with zero systems (empty score)?
- How does the renderer handle a system where all glyph runs are empty?
- What happens when the viewport exactly aligns with a system boundary (edge of binary search)?
- How does the renderer handle rapid consecutive re-renders during window resize?
- What happens when highlight updates arrive faster than the frame budget allows?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The refactored renderer MUST produce pixel-identical SVG output for all existing scores compared to the current monolithic renderer
- **FR-002**: The main renderer file (currently ~1,520 lines) MUST be decomposed into focused modules, each with a single, clearly defined responsibility
- **FR-003**: The highlight management logic (two-tier model, four highlight types, frame budget monitoring, incremental patch computation) MUST be extracted into a dedicated module
- **FR-004**: The glyph rendering pipeline (system → staff group → staff → glyph run traversal and SVG element creation) MUST be extracted into a dedicated module
- **FR-005**: The interaction handling logic (event delegation, click-to-note identification, selection callbacks) MUST be extracted into a dedicated module
- **FR-006**: The viewport virtualization logic (binary search for visible systems, viewport intersection tests) MUST remain accessible as a focused utility
- **FR-007**: The rendering utilities file (currently ~550 lines) MUST be decomposed so that configuration management, SVG element factories, viewport queries, and SMuFL glyph codepoint mappings are each in separate modules
- **FR-008**: All extracted modules MUST expose clear, well-defined interfaces so that the main renderer component acts as a thin orchestrator
- **FR-009**: The refactored code MUST maintain the existing public component interface (props, callbacks, refs) so that parent components require no changes
- **FR-010**: All existing unit tests and integration tests MUST pass after the refactor. Import paths in test files MAY be updated to reflect new module locations, but test logic, assertions, and structure MUST NOT be modified
- **FR-011**: The loop region overlay rendering MUST be extractable as a self-contained helper within the rendering pipeline
- **FR-012**: No individual module resulting from the refactor SHOULD exceed 400 lines of code

### Key Entities

- **LayoutRenderer**: The top-level orchestrator component that coordinates all rendering sub-modules and manages the component lifecycle
- **HighlightManager**: A plain class that encapsulates its own state (highlight Sets, frame budget monitor, previous-ID tracking) and exposes methods for computing highlight patches and driving the rAF-based incremental update loop
- **RenderingPipeline**: A plain class that encapsulates rendering traversal state and exposes methods for walking the layout hierarchy (systems → staff groups → staves → glyph runs) and creating the corresponding SVG elements
- **InteractionHandler**: A plain class that encapsulates event delegation state and exposes methods for walking the DOM to identify clicked notes and dispatching selection callbacks
- **SMuFLGlyphs**: A dedicated data module containing all musical symbol Unicode codepoint mappings and glyph metadata, separate from SVG DOM helpers, so that adding new musical symbols is a data-only change
- **RenderConfig**: The configuration object controlling font family, font size, and color scheme for the SVG output
- **ViewportManager**: The utility responsible for determining which systems are visible in the current scroll position via binary search

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No file in the refactored renderer exceeds 400 lines, down from the current 1,520-line monolith
- **SC-002**: 100% of existing rendering tests pass without modification after the refactor
- **SC-003**: Score rendering for all preloaded scores produces visually identical output (verified by screenshot comparison or SVG structure diff)
- **SC-004**: Playback highlight latency remains within the same frame budget thresholds as before the refactor
- **SC-005**: A developer new to the codebase can identify which module to modify for a given concern (rendering, highlights, interaction, loop overlay) within 2 minutes
- **SC-006**: The number of distinct responsibilities per module is reduced to one primary concern each (measured by code review)
- **SC-007**: The refactored renderer maintains the same public component interface, requiring zero changes in parent components

## Assumptions

- The existing test suite provides sufficient coverage to detect visual and behavioral regressions introduced by the refactor
- The current two-tier highlight model (structural re-renders + rAF incremental updates) is architecturally sound and should be preserved, not redesigned
- The backend layout engine output format (GlobalLayout JSON) will not change during this refactoring — this is a frontend-only effort
- The deprecated NotationRenderer.tsx (pre-Feature 017) is out of scope for this refactor and will not be modified or removed
- The React class component pattern used by LayoutRenderer is acceptable to retain; migrating to functional components/hooks is out of scope for this feature
- SMuFL glyph codepoint mappings and font metrics utilities may be relocated but their behavior must remain unchanged

## Scope Boundaries

### In Scope

- Decomposing LayoutRenderer.tsx (~1,520 lines) into focused sub-modules
- Decomposing renderUtils.ts (~550 lines) into focused utility modules
- Extracting highlight management, rendering pipeline, interaction handling, and loop overlay into separate modules
- Ensuring all existing tests pass without modification
- Maintaining the existing public component interface

### Out of Scope

- Backend layout engine changes (Rust/WASM)
- Migrating from React class component to functional component/hooks
- Performance optimizations beyond maintaining current performance levels
- Adding new rendering features or notation support
- Removing or modifying the deprecated NotationRenderer.tsx
- Changing the two-tier highlight architecture
- Modifying the RenderConfig interface or context provider

