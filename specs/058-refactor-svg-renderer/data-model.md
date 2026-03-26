# Data Model: Refactor SVG Renderer

**Feature**: 058-refactor-svg-renderer  
**Date**: 2026-03-26

## Overview

This is a code-structure refactoring with no new data entities. The "data model" here is the **module dependency graph** — which modules exist, what they own, and how they connect.

## Module Inventory

### LayoutRenderer (orchestrator)

**File**: `frontend/src/components/LayoutRenderer.tsx`  
**Role**: Thin React class component orchestrator  
**Owns**: React lifecycle, SVG ref, sub-module instances  
**Target size**: ≤ 200 lines

| Field | Type | Responsibility |
|-------|------|---------------|
| svgRef | RefObject\<SVGSVGElement\> | SVG DOM reference |
| pipeline | RenderingPipeline | Glyph rendering delegation |
| highlightCtrl | HighlightController | Highlight rAF delegation |
| interaction | InteractionHandler | Click event delegation |
| loopOverlay | LoopOverlayRenderer | Loop region delegation |

### RenderingPipeline

**File**: `frontend/src/components/renderer/RenderingPipeline.ts`  
**Role**: SVG element creation from layout hierarchy  
**Owns**: No persistent state (stateless traversal, but encapsulated as class for method grouping and svgElement reference)  
**Target size**: ≤ 400 lines

| Method | Input | Output | Calls |
|--------|-------|--------|-------|
| init(svg) | SVGSVGElement | void | — |
| renderAll(layout, config, viewport, opts) | GlobalLayout, RenderConfig, Viewport, RenderOptions | void | renderSystem, getVisibleSystems |
| renderSystem(system, offX, offY, config) | System, number, number, RenderConfig | SVGGElement | renderStaffGroup |
| renderStaffGroup(sg, offX, offY, config) | StaffGroup, number, number, RenderConfig | SVGGElement | renderStaff |
| renderStaff(staff, offX, offY, config) | Staff, number, number, RenderConfig | SVGGElement | renderGlyphRun, renderBarLines, ... |
| renderGlyphRun(run, offX, offY) | GlyphRun, number, number | SVGGElement | svgHelpers |
| renderBarLines(barlines, offX, offY) | BarLine[], number, number | void | svgHelpers |
| renderMeasureNumbers(system, offX, offY) | System, number, number | void | svgHelpers |
| renderVoltaBrackets(system, offX, offY) | System, number, number | void | svgHelpers |
| renderOttavaBrackets(system, offX, offY) | System, number, number | void | svgHelpers |
| dispose() | — | void | — |

**Dependencies**: svgHelpers, viewportUtils, smuflGlyphs, layout types

### HighlightController

**File**: `frontend/src/components/renderer/HighlightController.ts`  
**Role**: Manages rAF loop and all 4 highlight types  
**Owns**: Highlight state (Sets, rAF ID, HighlightIndex, FrameBudgetMonitor)  
**Target size**: ≤ 350 lines

| Field | Type | Responsibility |
|-------|------|---------------|
| svgElement | SVGSVGElement \| null | DOM target for class manipulation |
| highlightIndex | HighlightIndex \| null | Binary search index |
| frameBudgetMonitor | FrameBudgetMonitor | Frame timing |
| rafId | number \| null | requestAnimationFrame ID |
| prevHighlightedIds | Set\<string\> | Previous playback highlights |
| prevPinnedIds | Set\<string\> | Previous pinned highlights |
| prevErrorIds | Set\<string\> | Previous error highlights |
| prevExpectedIds | Set\<string\> | Previous expected highlights |

| Method | Input | Output |
|--------|-------|--------|
| init(svg) | SVGSVGElement | void |
| buildIndex(notes, sourceToNoteIdMap) | notes array, Map | void |
| startLoop(tickSourceRef) | ITickSource ref | void |
| stopLoop() | — | void |
| updatePinned(pinnedIds) | Set\<string\> | void |
| updateError(errorIds) | Set\<string\> | void |
| updateExpected(expectedIds) | Set\<string\> | void |
| dispose() | — | void |

**Dependencies**: services/highlight/FrameBudgetMonitor, services/highlight/computeHighlightPatch, services/highlight/HighlightIndex, services/highlight/sourceMapping

### InteractionHandler

**File**: `frontend/src/components/renderer/InteractionHandler.ts`  
**Role**: Event delegation for note clicks  
**Owns**: Event listener registration, callback reference  
**Target size**: ≤ 100 lines

| Method | Input | Output |
|--------|-------|--------|
| init(svg) | SVGSVGElement | void |
| setCallback(onNoteClick) | (noteId: string) => void | void |
| dispose() | — | void |

**Dependencies**: None (pure DOM delegation)

### LoopOverlayRenderer

**File**: `frontend/src/components/renderer/LoopOverlayRenderer.ts`  
**Role**: Renders semi-transparent overlay for loop regions  
**Owns**: No persistent state  
**Target size**: ≤ 130 lines

| Method | Input | Output |
|--------|-------|--------|
| renderOverlay(svg, layout, loopRegion, notes, viewport) | SVGSVGElement, GlobalLayout, LoopRegion, notes, Viewport | void |
| clear(svg) | SVGSVGElement | void |

**Dependencies**: svgHelpers, viewportUtils, layout types

### Utility Modules (from renderUtils.ts split)

#### svgHelpers.ts
**File**: `frontend/src/utils/svgHelpers.ts`  
**Target size**: ≤ 60 lines  
**Exports**: `svgNS`, `createSVGElement()`, `createSVGGroup()`

#### viewportUtils.ts
**File**: `frontend/src/utils/viewportUtils.ts`  
**Target size**: ≤ 180 lines  
**Exports**: `createViewportFromSVG()`, `intersectsViewport()`, `getViewportArea()`, `validateViewport()`, `getVisibleSystems()`

#### renderConfigUtils.ts
**File**: `frontend/src/utils/renderConfigUtils.ts`  
**Target size**: ≤ 130 lines  
**Exports**: `createDefaultConfig()`, `createDarkModeConfig()`, `validateRenderConfig()`, `isValidCSSColor()`

#### smuflGlyphs.ts
**File**: `frontend/src/utils/smuflGlyphs.ts`  
**Target size**: ≤ 200 lines  
**Exports**: Codepoint constants, duration-to-codepoint maps, glyph metadata

#### renderUtils.ts (barrel)
**File**: `frontend/src/utils/renderUtils.ts`  
**Target size**: ≤ 20 lines  
**Role**: Re-exports all public functions from the four utility modules above for backward compatibility

## Module Dependency Graph

```
LayoutRenderer.tsx (orchestrator)
├── RenderingPipeline.ts
│   ├── svgHelpers.ts
│   ├── viewportUtils.ts
│   ├── smuflGlyphs.ts
│   └── wasm/layout.ts (types only)
├── HighlightController.ts
│   ├── services/highlight/FrameBudgetMonitor.ts (existing)
│   ├── services/highlight/computeHighlightPatch.ts (existing)
│   ├── services/highlight/HighlightIndex.ts (existing)
│   └── services/highlight/sourceMapping.ts (existing)
├── InteractionHandler.ts
│   └── (no dependencies)
├── LoopOverlayRenderer.ts
│   ├── svgHelpers.ts
│   └── viewportUtils.ts
└── renderUtils.ts (barrel)
    ├── renderConfigUtils.ts
    ├── viewportUtils.ts
    ├── svgHelpers.ts
    └── smuflGlyphs.ts
```

**Key constraint**: No circular dependencies. All arrows flow downward. Renderer modules never import from each other.
