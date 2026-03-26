# Research: Refactor SVG Renderer

**Feature**: 058-refactor-svg-renderer  
**Date**: 2026-03-26

## Research Task 1: Current LayoutRenderer.tsx responsibility mapping

### Context
LayoutRenderer.tsx is ~1,520 lines. Need to map every method to a responsibility domain to determine extraction boundaries.

### Findings

**Rendering Pipeline** (~600 lines):
- `renderSVG()` — clears SVG, iterates visible systems
- `renderSystem(system, offsetX, offsetY)` — renders one system line
- `renderStaffGroup()` — renders staff group with bracket/brace
- `renderStaff()` — renders staff lines, ledger lines, glyph runs, notation dots, tie/slur arcs, fingerings
- `renderGlyphRun(glyphRun, offsetX, offsetY)` — batch-renders positioned glyphs as SVG `<text>` elements
- `renderBarLines()` — renders barlines for system
- `renderStaffLines()` — renders horizontal staff lines
- `renderLedgerLines()` — renders short ledger lines
- `renderNotationDots()` — augmentation/staccato dots
- `renderTieArcs()` / `renderSlurArcs()` — curved arcs
- `renderFingeringGlyphs()` — fingering number annotations
- `renderMeasureNumbers()` — measure number labels
- `renderVoltaBrackets()` — volta/repeat brackets (Feature 047)
- `renderOttavaBrackets()` — 8va/8vb brackets

**Highlight Management** (~400 lines):
- `startHighlightLoop()` / `stopHighlightLoop()` — rAF lifecycle
- `highlightTick()` — main rAF callback, queries HighlightIndex, computes and applies patches
- `applyHighlightClasses()` — DOM class manipulation for highlight/pinned/error/expected
- `updatePinnedHighlights()` — diff and apply pinned note changes
- `updateErrorHighlights()` — diff and apply error note changes
- `updateExpectedHighlights()` — diff and apply expected note changes
- `buildHighlightIndex()` — constructs HighlightIndex from notes array
- Instance fields: `highlightIndex`, `frameBudgetMonitor`, `prevHighlightedIds`, `prevPinnedIds`, `prevErrorIds`, `prevExpectedIds`, `rafId`

**Interaction Handling** (~80 lines):
- `handleSVGClick(event)` — event delegation, walks DOM to find `data-note-id`, calls `onNoteClick`

**Loop Overlay** (~120 lines):
- `renderLoopOverlay()` — semi-transparent rect over loop region
- `tickToX(tick, system)` — maps tick position to X coordinate within a system
- Uses `rawNotes` or `notes` props for tick→x mapping

**Lifecycle Orchestration** (~320 lines):
- `constructor()` — initializes refs, frame budget monitor
- `shouldComponentUpdate()` — two-tier gate: skips re-render for highlight-only changes
- `componentDidMount()` — initial render + start highlight loop
- `componentDidUpdate()` — re-render + restart highlight loop if layout/config changed
- `componentWillUnmount()` — cleanup (stop highlight loop)
- `render()` — returns bare `<svg>` element, imperative rendering via refs

### Decision
Extract into 4 modules: RenderingPipeline (~600 lines → target ≤ 400 after cleanup), HighlightController (~400 lines → ≤ 350), InteractionHandler (~80 lines → ≤ 100), LoopOverlayRenderer (~120 lines → ≤ 130). LayoutRenderer retains lifecycle orchestration (~200 lines).

### Rationale
Method boundaries are natural extraction points. Each group has distinct state requirements and can be encapsulated in a class. The rendering pipeline is the largest and may need internal helpers, but won't exceed 400 lines since annotation rendering methods (dots, arcs, fingerings) can be inlined or co-located as private methods.

### Alternatives Considered
- **Single extraction (highlights only)**: Leaves rendering pipeline monolithic. Rejected: doesn't meet FR-002/FR-004.
- **Functional decomposition (pure functions only)**: Would require passing 10+ parameters per call. Rejected per clarification Q1 (plain classes chosen).
- **Full React component split**: Would require prop drilling between sub-components. Rejected: adds unnecessary complexity and blurs the two-tier highlight model.

---

## Research Task 2: Current renderUtils.ts responsibility mapping

### Context
renderUtils.ts is ~550 lines. Need to determine which functions group together.

### Findings

**Config Management** (~120 lines):
- `createDefaultConfig()` — returns light theme RenderConfig
- `createDarkModeConfig(fontSize)` — returns dark theme RenderConfig
- `validateRenderConfig(config)` — validates font size, font family, CSS colors
- `isValidCSSColor(color)` — DOM-based CSS color validation helper

**Viewport Queries** (~180 lines):
- `createViewportFromSVG(svg, scrollY)` — extract viewport from SVG viewBox
- `intersectsViewport(systemY, systemHeight, viewport)` — boolean collision test
- `getViewportArea(viewport)` — area calculation
- `validateViewport(viewport)` — viewport parameter validation
- `getVisibleSystems(systems, viewport)` — O(log n) binary search for visible systems

**SVG Element Factories** (~50 lines):
- `svgNS` — SVG namespace constant
- `createSVGElement(tagName)` — generic typed SVG element factory
- `createSVGGroup()` — `<g>` element factory

**SMuFL Data** (~200 lines):
- Glyph codepoint constants and lookup maps for common musical symbols
- Duration-to-codepoint mapping
- Glyph metrics helpers

### Decision
Split into 4 modules: `renderConfigUtils.ts`, `viewportUtils.ts`, `svgHelpers.ts`, `smuflGlyphs.ts`. Keep `renderUtils.ts` as a barrel re-export for backward compatibility with external consumers (App.tsx, ScoreViewer.tsx import `createDefaultConfig` from it).

### Rationale
Each group has a single concern. The barrel re-export avoids breaking imports in non-renderer files while enabling direct imports from focused modules in new code.

### Alternatives Considered
- **No barrel re-export (update all consumers)**: Would require changing App.tsx, ScoreViewer.tsx, multiple test files. Rejected: increases blast radius unnecessarily.
- **Keep as single file**: Violates FR-007. Rejected.

---

## Research Task 3: Existing highlight service extraction

### Context
Research revealed that highlight infrastructure is already partially extracted to `frontend/src/services/highlight/`.

### Findings

Already extracted modules (no changes needed):
- `FrameBudgetMonitor.ts` — frame time tracking with degradation policy
- `computeHighlightPatch.ts` — pure diff function (prev Set, current Array → patch)
- `HighlightIndex.ts` — binary search index for O(log n + k) tick→noteId queries
- `sourceMapping.ts` — `createSourceKey()` for SourceReference→string mapping

**Still in LayoutRenderer.tsx** (needs extraction):
- rAF loop management (`startHighlightLoop`, `stopHighlightLoop`, `highlightTick`)
- DOM highlight application (`applyHighlightClasses`, `updatePinnedHighlights`, `updateErrorHighlights`, `updateExpectedHighlights`)
- Highlight index construction (`buildHighlightIndex`)
- Instance state: `rafId`, `prevHighlightedIds`, `prevPinnedIds`, `prevErrorIds`, `prevExpectedIds`, `highlightIndex`, `frameBudgetMonitor`

### Decision
Create `HighlightController.ts` as a plain class that owns the rAF loop, previous-ID Sets, and DOM application methods. It consumes the existing `services/highlight/` modules. This completes the highlight extraction without duplicating what's already extracted.

### Rationale
HighlightController fills the gap between the already-extracted pure utilities and the remaining stateful orchestration in LayoutRenderer. It becomes the single entry point for all highlight concerns.

### Alternatives Considered
- **Move everything into services/highlight/**: Would create a module that depends on SVG DOM refs, breaking the service layer abstraction. Rejected.
- **Leave rAF loop in LayoutRenderer**: Keeps highlight state split between two locations. Rejected: violates single-responsibility principle.

---

## Research Task 4: Test import dependency analysis

### Context
Clarification Q3 established that test import paths MAY be updated but test logic MUST NOT change. Need to map exact import updates required.

### Findings

**Test files importing from renderUtils.ts:**
1. `frontend/tests/unit/renderUtils.test.ts` — imports `createDefaultConfig`, `createDarkModeConfig`, `validateRenderConfig`, `createViewportFromSVG`, `intersectsViewport`, `getViewportArea`, `validateViewport`, `getVisibleSystems`, `svgNS`, `createSVGElement`, `createSVGGroup`
2. `frontend/tests/performance/Virtualization.test.tsx` — imports `createDefaultConfig`, `getVisibleSystems`
3. `frontend/tests/unit/LayoutRenderer.test.tsx` — imports `createDefaultConfig`

**Test files importing from LayoutRenderer.tsx:**
1. `frontend/tests/unit/LayoutRenderer.test.tsx` — imports `LayoutRenderer` component
2. `frontend/tests/performance/Virtualization.test.tsx` — imports `LayoutRenderer` component
3. `frontend/src/components/LayoutRenderer.test.tsx` — imports `LayoutRendererProps` type

**Strategy:**
- `renderUtils.ts` barrel re-export → **zero test import changes** for renderUtils tests
- `LayoutRenderer.tsx` retains public export of `LayoutRenderer` component and `LayoutRendererProps` type → **zero test import changes** for LayoutRenderer tests

### Decision
Barrel re-export strategy means NO test files need import path updates. All existing imports will continue to resolve through the original module paths.

### Rationale
This is the least disruptive approach and exceeds the spec requirement (which allowed import path updates). Zero test changes is strictly better.

### Alternatives Considered
- **Update all test imports to point at new modules**: Works but unnecessary given barrel re-exports. Rejected: gratuitous churn.

---

## Research Task 5: Best practices for React class component extraction

### Context
LayoutRenderer is a React class component using imperative DOM manipulation via refs. Need to ensure the extraction pattern works safely.

### Findings

**Pattern: Delegator with owned helper classes**
- LayoutRenderer constructs helper class instances in `constructor()` or `componentDidMount()`
- Helper instances receive the SVG ref and any needed props
- LayoutRenderer delegates to helpers in lifecycle methods
- Helper classes do NOT extend React.Component — they are plain TypeScript classes

**Key considerations:**
- SVG ref availability: refs are null until `componentDidMount()`. Helpers must be initialized/passed the ref after mount.
- Cleanup: `componentWillUnmount()` must call cleanup on all helpers (stop rAF, remove event listeners)
- Two-tier model preservation: `shouldComponentUpdate()` stays in LayoutRenderer since it's a React lifecycle concern. It decides whether to re-render (Tier 1) or let the rAF loop handle highlights (Tier 2).

### Decision
Helper class instances (RenderingPipeline, HighlightController, InteractionHandler, LoopOverlayRenderer) are created in the constructor and initialized with the SVG element ref in `componentDidMount()`. Each exposes `init(svgElement)`, main action methods, and `dispose()`.

### Rationale
Matches the existing class component lifecycle. No React architecture changes needed. Clean initialization and cleanup contract.

### Alternatives Considered
- **Create helpers on every render**: Wasteful, defeats encapsulated state. Rejected.
- **Use React context for helpers**: Over-engineered for internal component extraction. Rejected.
