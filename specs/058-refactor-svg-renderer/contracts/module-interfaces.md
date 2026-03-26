# Module Contracts: Refactor SVG Renderer

**Feature**: 058-refactor-svg-renderer  
**Date**: 2026-03-26

## Contract 1: RenderingPipeline

```typescript
// frontend/src/components/renderer/RenderingPipeline.ts

import type { GlobalLayout, System, StaffGroup, Staff, GlyphRun, BarLine } from '../../wasm/layout';
import type { RenderConfig } from '../../types/RenderConfig';
import type { Viewport } from '../../types/Viewport';

export interface RenderOptions {
  hideMeasureNumbers?: boolean;
  selectedNoteId?: string;
}

export class RenderingPipeline {
  private svgElement: SVGSVGElement | null;

  constructor();

  /** Bind to SVG element after mount */
  init(svg: SVGSVGElement): void;

  /** Render all visible systems from layout into SVG */
  renderAll(
    layout: GlobalLayout,
    config: RenderConfig,
    viewport: Viewport,
    options?: RenderOptions,
  ): void;

  /** Release SVG reference */
  dispose(): void;
}
```

**Invariants**:
- `renderAll()` clears the SVG before rendering (fresh render each call)
- Only systems intersecting the viewport are rendered (virtualization preserved)
- No coordinate calculations — all positions come from `GlobalLayout`
- `selectedNoteId` results in a CSS class on the matching glyph element

---

## Contract 2: HighlightController

```typescript
// frontend/src/components/renderer/HighlightController.ts

import type { ITickSource } from '../../services/highlight/types';

export class HighlightController {
  constructor(budgetMs?: number);

  /** Bind to SVG element after mount */
  init(svg: SVGSVGElement): void;

  /** Build the binary search index from notes array */
  buildIndex(
    notes: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>,
    sourceToNoteIdMap?: Map<string, string>,
  ): void;

  /** Start the rAF-driven highlight loop reading from tickSourceRef */
  startLoop(tickSourceRef: { current: ITickSource }): void;

  /** Stop the rAF loop */
  stopLoop(): void;

  /** Apply pinned highlight changes (full diff against previous) */
  updatePinned(pinnedIds: Set<string>): void;

  /** Apply error highlight changes (full diff against previous) */
  updateError(errorIds: Set<string>): void;

  /** Apply expected highlight changes (full diff against previous) */
  updateExpected(expectedIds: Set<string>): void;

  /** Stop loop, clear state, release SVG reference */
  dispose(): void;
}
```

**Invariants**:
- Only one rAF loop runs at a time (calling `startLoop` while running stops the previous loop)
- Frame budget degradation halves update rate when consecutive overruns exceed threshold
- DOM manipulation uses `data-note-id` attribute for element lookup
- Highlight priority: Pinned > Error > Expected > Playback (highest wins)
- `dispose()` is idempotent

---

## Contract 3: InteractionHandler

```typescript
// frontend/src/components/renderer/InteractionHandler.ts

export class InteractionHandler {
  constructor();

  /** Bind click listener to SVG element */
  init(svg: SVGSVGElement): void;

  /** Set or update the note click callback */
  setCallback(onNoteClick: ((noteId: string) => void) | undefined): void;

  /** Remove listener and release SVG reference */
  dispose(): void;
}
```

**Invariants**:
- Uses event delegation (single listener on SVG root)
- Walks DOM parentward from click target to find `data-note-id` attribute
- If no `data-note-id` found, click is silently ignored
- `dispose()` is idempotent

---

## Contract 4: LoopOverlayRenderer

```typescript
// frontend/src/components/renderer/LoopOverlayRenderer.ts

import type { GlobalLayout } from '../../wasm/layout';
import type { Viewport } from '../../types/Viewport';

export interface LoopRegion {
  startTick: number;
  endTick: number;
}

export class LoopOverlayRenderer {
  constructor();

  /** Render loop overlay rects on visible systems */
  renderOverlay(
    svg: SVGSVGElement,
    layout: GlobalLayout,
    loopRegion: LoopRegion,
    notes: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>,
    viewport: Viewport,
  ): void;

  /** Remove any existing overlay elements from SVG */
  clear(svg: SVGSVGElement): void;
}
```

**Invariants**:
- Overlay rendered as semi-transparent rect per visible system
- Tick-to-X mapping uses notes array (falls back gracefully if empty)
- `clear()` removes all overlay elements identified by a data attribute marker

---

## Contract 5: Utility modules (renderUtils split)

```typescript
// frontend/src/utils/svgHelpers.ts
export const svgNS: string;
export function createSVGElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K];
export function createSVGGroup(): SVGGElement;

// frontend/src/utils/viewportUtils.ts
export function createViewportFromSVG(svg: SVGSVGElement, scrollY?: number): Viewport;
export function intersectsViewport(systemY: number, systemHeight: number, viewport: Viewport): boolean;
export function getViewportArea(viewport: Viewport): number;
export function validateViewport(viewport: Viewport): void;
export function getVisibleSystems(systems: System[], viewport: Viewport): System[];

// frontend/src/utils/renderConfigUtils.ts
export function createDefaultConfig(): RenderConfig;
export function createDarkModeConfig(fontSize?: number): RenderConfig;
export function validateRenderConfig(config: RenderConfig): void;

// frontend/src/utils/smuflGlyphs.ts
// Codepoint constants, duration-to-codepoint maps, glyph metadata
// (exact exports TBD during implementation — preserve all existing exports)

// frontend/src/utils/renderUtils.ts (barrel)
export { createDefaultConfig, createDarkModeConfig, validateRenderConfig } from './renderConfigUtils';
export { createViewportFromSVG, intersectsViewport, getViewportArea, validateViewport, getVisibleSystems } from './viewportUtils';
export { svgNS, createSVGElement, createSVGGroup } from './svgHelpers';
// + any smuflGlyphs exports used externally
```

**Invariants**:
- Barrel re-export preserves all existing import paths
- No behavioral changes to any function
- Pure functions — no side effects, no shared mutable state
