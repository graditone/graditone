/**
 * LayoutRenderer Component
 * Feature 017 - SVG-based music notation renderer
 * 
 * Renders music notation using exact glyph positions computed by
 * Feature 016 (Rust Layout Engine). Uses SVG DOM with viewBox for
 * resolution-independent display.
 */

import { Component, createRef, type RefObject } from 'react';
import type { GlobalLayout, System, StaffGroup, Staff, GlyphRun, BarLine, Glyph } from '../wasm/layout';
import type { RenderConfig } from '../types/RenderConfig';
import type { Viewport } from '../types/Viewport';
import { 
  validateRenderConfig, 
  validateViewport,
  getVisibleSystems,
  createSVGElement,
  createSVGGroup,
  svgNS,
} from '../utils/renderUtils';
import { createSourceKey } from '../services/highlight/sourceMapping';
import { HighlightIndex } from '../services/highlight/HighlightIndex';
import { computeHighlightPatch } from '../services/highlight/computeHighlightPatch';
import { FrameBudgetMonitor } from '../services/highlight/FrameBudgetMonitor';
import { detectDeviceProfile } from '../utils/deviceDetection';
import type { ITickSource } from '../types/playback';
import './LayoutRenderer.css';

/**
 * Props for LayoutRenderer component
 */
export interface LayoutRendererProps {
  /** Computed layout from Feature 016's computeLayout() */
  layout: GlobalLayout | null;
  /** Rendering configuration (colors, fonts, sizing) */
  config: RenderConfig;
  /** Visible viewport region (for virtualization) */
  viewport: Viewport;
  /** Optional CSS class name for SVG element */
  className?: string;
  /** Feature 019: Set of note IDs to highlight during playback */
  highlightedNoteIds?: Set<string>;
  /** Feature 019: Map from SourceReference keys to Note IDs */
  sourceToNoteIdMap?: Map<string, string>;
  /** Callback when a note glyph is clicked */
  onNoteClick?: (noteId: string) => void;
  /** ID of the currently selected note (for visual feedback) */
  selectedNoteId?: string;
  /** Long-press pinned note IDs — rendered with permanent green highlight */
  pinnedNoteIds?: Set<string>;
  /** Loop region: when both pins are active, draws a semi-transparent overlay rect.
   * startTick and endTick are the absolute tick positions of the two pinned notes. */
  loopRegion?: { startTick: number; endTick: number } | null;
  /** When true, suppresses rendering of measure number labels above each system.
   * Useful for compact practice staves where vertical space is at a premium. */
  hideMeasureNumbers?: boolean;
  /** Feature 024: Tick source ref for rAF-driven highlight updates.
   * Must be a ref object (not a value) so the rAF loop reads live tick data
   * even when shouldComponentUpdate blocks React re-renders. */
  tickSourceRef?: { current: ITickSource };
  /** Feature 024: Notes array for building HighlightIndex */
  notes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Raw (unexpanded) notes — original ticks matching the layout engine.
   * Used for loop overlay tick→x mapping. Falls back to notes if absent. */
  rawNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
}

/**
 * LayoutRenderer component implementation
 * 
 * @example
 * ```tsx
 * import { computeLayout } from '../wasm/layout';
 * import { createDefaultConfig } from '../utils/renderUtils';
 * 
 * function ScoreDisplay({ score }) {
 *   const layout = computeLayout(score, { max_system_width: 1200 });
 *   const config = createDefaultConfig();
 *   const viewport = { x: 0, y: 0, width: 1200, height: 800 };
 * 
 *   return <LayoutRenderer layout={layout} config={config} viewport={viewport} />;
 * }
 * ```
 */
export class LayoutRenderer extends Component<LayoutRendererProps> {
  /** Reference to SVG element for direct DOM manipulation */
  private svgRef: RefObject<SVGSVGElement | null>;

  // Feature 024: Two-tier render model instance fields
  /** rAF handle for highlight loop cleanup */
  private rafId = 0;
  /** Timestamp of last processed highlight frame */
  private lastFrameTime = 0;
  /** Previous frame's highlighted note IDs for diff computation */
  private prevHighlightedIds = new Set<string>();
  /** Previous pinned note IDs for diff computation */
  private prevPinnedIds = new Set<string>();
  /** Target interval between highlight frames (33ms mobile / 16ms desktop) */
  private frameInterval = 16;
  /** Pre-sorted note index for O(log n) highlight queries */
  private highlightIndex: HighlightIndex | null = null;
  /** Frame budget tracker for audio-first degradation */
  private frameBudgetMonitor: FrameBudgetMonitor;

  constructor(props: LayoutRendererProps) {
    super(props);
    this.svgRef = createRef();

    // Validate config on construction
    validateRenderConfig(props.config);
    validateViewport(props.viewport);

    // Feature 024 (T017): Detect device profile for frame rate selection
    const profile = detectDeviceProfile();
    this.frameInterval = profile.targetFrameIntervalMs;
    this.frameBudgetMonitor = new FrameBudgetMonitor(profile.frameBudgetMs);

    // Feature 024: Build highlight index if notes provided
    if (props.notes && props.notes.length > 0) {
      this.highlightIndex = new HighlightIndex();
      this.highlightIndex.build(props.notes);
    }
  }

  /**
   * Handle click events on SVG via event delegation.
   * Walks up from click target to find a glyph with data-note-id.
   */
  private handleSVGClick = (event: MouseEvent): void => {
    const { onNoteClick } = this.props;
    if (!onNoteClick) return;

    let target = event.target as Element | null;
    const svg = this.svgRef.current;
    while (target && target !== svg) {
      if (target instanceof SVGElement && target.dataset.noteId) {
        event.stopPropagation(); // Prevent toggle playback on container
        onNoteClick(target.dataset.noteId);
        return;
      }
      target = target.parentElement;
    }
    // Click was not on a note — let it propagate for togglePlayback
  };

  /**
   * Feature 024 (T013): Only re-render SVG for structural changes.
   * Returns false for highlight-only changes — those are handled by the
   * rAF-driven updateHighlights() loop.
   *
   * Feature 027 (T003): selectedNoteId triggers a structural re-render so
   * the orange selection fill is applied to the correct glyph elements.
   * Bug: omitting selectedNoteId meant tapping a note never showed the
   * orange highlight because shouldComponentUpdate returned false.
   */
  shouldComponentUpdate(nextProps: LayoutRendererProps): boolean {
    return (
      nextProps.layout !== this.props.layout ||
      nextProps.config !== this.props.config ||
      nextProps.viewport !== this.props.viewport ||
      nextProps.sourceToNoteIdMap !== this.props.sourceToNoteIdMap ||
      nextProps.selectedNoteId !== this.props.selectedNoteId ||
      nextProps.pinnedNoteIds !== this.props.pinnedNoteIds ||
      nextProps.loopRegion !== this.props.loopRegion
    );
  }

  /**
   * Render SVG after component mounts and start highlight loop
   */
  componentDidMount(): void {
    // React StrictMode in dev unmounts+remounts every component once.
    // componentWillUnmount calls highlightIndex.clear(), so by the time the
    // second componentDidMount runs the index is empty. Rebuild it here if needed.
    if (this.props.notes && this.props.notes.length > 0 &&
        (!this.highlightIndex || this.highlightIndex.noteCount === 0)) {
      if (!this.highlightIndex) this.highlightIndex = new HighlightIndex();
      this.highlightIndex.build(this.props.notes);
    }
    this.renderSVG();
    this.svgRef.current?.addEventListener('click', this.handleSVGClick);
    this.startHighlightLoop();
  }

  /**
   * Cleanup event listener and stop highlight loop
   */
  componentWillUnmount(): void {
    this.stopHighlightLoop();
    this.svgRef.current?.removeEventListener('click', this.handleSVGClick);
    this.highlightIndex?.clear();
    this.frameBudgetMonitor.reset();
  }

  /**
   * Re-render SVG for structural changes only.
   * Feature 024: After structural render, re-apply current highlight state
   * since all data-note-id elements were recreated.
   */
  componentDidUpdate(prevProps: LayoutRendererProps): void {
    // Full structural changes: layout, config, or source map
    if (
      prevProps.layout !== this.props.layout ||
      prevProps.config !== this.props.config ||
      prevProps.sourceToNoteIdMap !== this.props.sourceToNoteIdMap
    ) {
      this.renderSVG();
      // Re-apply highlights after structural render (T024)
      this.reapplyHighlights();
    } else if (prevProps.viewport !== this.props.viewport) {
      // Viewport-only change (scroll/zoom): always update viewBox (cheap)
      this.updateViewBox();
      // Only do full SVG rebuild if the set of visible systems changed.
      // During playback auto-scroll, the same systems are typically visible
      // across ~12 animation frames — this avoids ~12 expensive rebuilds
      // per system transition (each 30ms+ on tablet).
      if (this.visibleSystemsChanged(prevProps.viewport)) {
        this.renderSVG();
        this.reapplyHighlights();
      }
    }

    // Rebuild highlight index when notes change
    if (prevProps.notes !== this.props.notes) {
      const newNotes = this.props.notes;
      if (newNotes && newNotes.length > 0) {
        if (!this.highlightIndex) {
          this.highlightIndex = new HighlightIndex();
        }
        this.highlightIndex.build(newNotes);
      }
      // If notes becomes empty, preserve existing index (transient state during score transitions)
    }

    // Apply pinned highlight when pinnedNoteIds prop changes
    if (prevProps.pinnedNoteIds !== this.props.pinnedNoteIds) {
      this.updatePinnedHighlights();
    }

    // Re-render SVG when loop region changes (overlay rect must be redrawn)
    if (prevProps.loopRegion !== this.props.loopRegion) {
      this.renderSVG();
      this.reapplyHighlights();
    }
  }

  // ─── Viewport helpers ─────────────────────────────────────────────

  /**
   * Update just the SVG viewBox attribute — a single DOM call.
   * Called on viewport-only changes (scroll) to keep the SVG coordinate
   * system aligned with the scroll position without rebuilding content.
   */
  private updateViewBox(): void {
    const svg = this.svgRef.current;
    if (!svg || !this.props.layout) return;
    const { viewport } = this.props;
    svg.setAttribute(
      'viewBox',
      `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`
    );
  }

  /**
   * Check whether the set of visible systems changed between the previous
   * viewport and the current viewport. Uses system indices for comparison.
   */
  private visibleSystemsChanged(prevViewport: Viewport): boolean {
    const layout = this.props.layout;
    if (!layout) return false;
    const prevSystems = getVisibleSystems(layout.systems, prevViewport);
    const nextSystems = getVisibleSystems(layout.systems, this.props.viewport);
    if (prevSystems.length !== nextSystems.length) return true;
    for (let i = 0; i < prevSystems.length; i++) {
      if (prevSystems[i].index !== nextSystems[i].index) return true;
    }
    return false;
  }

  // ─── Feature 024: rAF Highlight Loop (T014-T017) ──────────────────

  /**
   * Feature 024 (T015): Start the rAF self-scheduling highlight loop.
   * Runs independently of React rendering at device-adaptive frame rate.
   */
  private startHighlightLoop(): void {
    const loop = (timestamp: number): void => {
      this.rafId = requestAnimationFrame(loop);

      // Frame-skip: only process if enough time has passed (T017)
      if (timestamp - this.lastFrameTime < this.frameInterval) return;
      this.lastFrameTime = timestamp;

      // Feature 024 (T016): Check frame budget — skip visual updates if degraded
      if (this.frameBudgetMonitor.shouldSkipFrame()) return;

      const startTime = this.frameBudgetMonitor.startFrame();
      this.updateHighlights();
      this.frameBudgetMonitor.endFrame(startTime);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Feature 024 (T015): Stop the rAF highlight loop.
   */
  private stopHighlightLoop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /**
   * Feature 024 (T014): Diff-based CSS class toggling for highlights.
   * Reads current tick from tickSource (ref), computes playing notes via
   * HighlightIndex, diffs against previous frame, toggles CSS classes.
   * Never triggers React re-renders.
   */
  /**
   * Apply or remove the green 'pinned' CSS class based on pinnedNoteIds prop.
   * Called on componentDidUpdate when pinnedNoteIds changes, and from reapplyHighlights.
   */
  /**
   * Apply a scale(factor) SVG transform centred on the glyph's (x, y) position.
   * Uses translate(x,y) scale(f) translate(-x,-y) in SVG attribute space so the
   * element scales around its own anchor point without relying on CSS transform-box,
   * which Safari mis-implements for SVG <text> elements (causes visual displacement).
   * Only applied to <text> elements (noteheads/accidentals); stems and beams are
   * left at their natural size.
   */
  private applyNoteheadScale(el: Element, scale: number): void {
    if (el.tagName !== 'text') return;
    if (scale === 1) {
      el.removeAttribute('transform');
    } else {
      const x = parseFloat(el.getAttribute('x') ?? '0');
      const y = parseFloat(el.getAttribute('y') ?? '0');
      el.setAttribute('transform', `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`);
    }
  }

  private updatePinnedHighlights(): void {
    const svg = this.svgRef.current;
    if (!svg) return;
    const rawPinned = this.props.pinnedNoteIds ?? new Set<string>();

    // Strip repeat-expansion suffix (e.g. "-r1") so layout DOM elements
    // (which use original note IDs) are found during repeated sections.
    const currentPinned = new Set([...rawPinned].map(id => id.replace(/-r\d+$/, '')));

    // Remove .pinned from ALL matching layout-glyph elements for IDs no longer pinned.
    // Scoped to .layout-glyph to skip hit-rects (transparent overlays) and beams.
    for (const id of this.prevPinnedIds) {
      if (!currentPinned.has(id)) {
        svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
          el.classList.remove('pinned');
          this.applyNoteheadScale(el, 1);
        });
      }
    }
    // Add .pinned to all layout-glyph elements for this note (notehead + accidental + stem)
    // and strip any stale orange highlight so green is visible immediately.
    for (const id of currentPinned) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.add('pinned');
        el.classList.remove('highlighted');
        this.applyNoteheadScale(el, 1.2);
      });
    }
    this.prevPinnedIds = new Set(currentPinned);
  }

  private updateHighlights(): void {
    // Read live tick data from ref (bypasses shouldComponentUpdate freezing)
    const tickSource = this.props.tickSourceRef?.current;
    const { highlightedNoteIds } = this.props;

    // Determine current playing notes
    let currentIds: string[];
    if (this.highlightIndex && tickSource && tickSource.status === 'playing') {
      // Feature 024 path: O(log n) binary search via HighlightIndex
      currentIds = this.highlightIndex.findPlayingNoteIds(tickSource.currentTick);
    } else if (highlightedNoteIds && highlightedNoteIds.size > 0) {
      // Legacy path: use prop-based highlighted note IDs
      currentIds = Array.from(highlightedNoteIds);
    } else {
      // Nothing playing — clear all highlights
      if (this.prevHighlightedIds.size === 0) return;
      currentIds = [];
    }

    // Strip repeat-expansion suffix (e.g. "-r1") so layout DOM elements
    // (which use original note IDs) are found during repeated sections.
    const baseIds = [...new Set(currentIds.map(id => id.replace(/-r\d+$/, '')))];

    const patch = computeHighlightPatch(this.prevHighlightedIds, baseIds);
    if (patch.unchanged) return;

    const svg = this.svgRef.current;
    if (!svg) return;

    // Scoped to .layout-glyph to skip transparent hit-rects (fix Bug #1: orange box)
    // and beam polygons (fix Bug #2: beam spanning all notes turns whole group orange).
    for (const id of patch.removed) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.remove('highlighted');
        // Only remove scale if element is not also pinned
        if (!el.classList.contains('pinned')) this.applyNoteheadScale(el, 1);
      });
    }
    for (const id of patch.added) {
      // Skip elements that are pinned — green takes priority, orange must not overwrite
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        if (!el.classList.contains('pinned')) {
          el.classList.add('highlighted');
          this.applyNoteheadScale(el, 1.2);
        }
      });
    }

    this.prevHighlightedIds = new Set(baseIds);
  }

  /**
   * Feature 024 (T024): Re-apply current highlight state after structural render.
   * Called after renderSVG() rebuilds SVG, since all data-note-id elements
   * were recreated and lost their CSS classes.
   * 
   * Recomputes highlights from the current tick source to avoid stale state —
   * prevHighlightedIds may reference notes that are no longer playing.
   */
  private reapplyHighlights(): void {
    const svg = this.svgRef.current;
    if (!svg) return;

    // Recompute current highlights from tick source (not from stale prevHighlightedIds)
    // Read live tick data from ref (bypasses shouldComponentUpdate freezing)
    const tickSource = this.props.tickSourceRef?.current;
    const { highlightedNoteIds } = this.props;
    let currentIds: string[];

    if (this.highlightIndex && tickSource && tickSource.status === 'playing') {
      currentIds = this.highlightIndex.findPlayingNoteIds(tickSource.currentTick);
    } else if (highlightedNoteIds && highlightedNoteIds.size > 0) {
      currentIds = Array.from(highlightedNoteIds);
    } else {
      currentIds = [];
    }

    // Strip repeat-expansion suffix (e.g. "-r1") — same reasoning as updateHighlights.
    const baseIds = [...new Set(currentIds.map(id => id.replace(/-r\d+$/, '')))];

    // Update prevHighlightedIds to match what we're applying
    this.prevHighlightedIds = new Set(baseIds);

    if (baseIds.length === 0) return;

    // Scoped to .layout-glyph — skips hit-rects and beams (same reasoning as updateHighlights).
    for (const id of baseIds) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        if (!el.classList.contains('pinned')) {
          el.classList.add('highlighted');
          this.applyNoteheadScale(el, 1.2);
        }
      });
    }

    // Re-apply pinned highlights after structural render
    this.updatePinnedHighlights();
  }

  /**
   * Main rendering entry point (Task T016).
   * Clears SVG, queries visible systems, renders them.
   * Includes performance monitoring (T060).
   */
  private renderSVG(): void {
    const startTime = performance.now();
    
    const svg = this.svgRef.current;
    if (!svg) {
      console.warn('LayoutRenderer: SVG ref not available');
      return;
    }

    const { layout, viewport, config } = this.props;

    // Handle missing layout (Task T022)
    if (!layout) {
      this.renderError(svg, 'No layout available');
      return;
    }

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Set background color
    svg.style.backgroundColor = config.backgroundColor;

    // Set viewBox to match layout coordinate system (Task T021)
    // Use logical units from layout engine (staff space = 20)
    svg.setAttribute(
      'viewBox',
      `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`
    );

    // Query visible systems using virtualization (Task T009)
    const visibleSystems = getVisibleSystems(layout.systems, viewport);

    // Create document fragment for efficient DOM insertion (Task T059)
    const fragment = document.createDocumentFragment();

    // Render each visible system (Task T017)
    for (const system of visibleSystems) {
      const systemGroup = this.renderSystem(system, 0, 0);
      fragment.appendChild(systemGroup);
    }

    // Append all systems at once
    svg.appendChild(fragment);

    // Performance monitoring (T060): Warn if render exceeds frame budget
    // Use device-adaptive threshold (33ms for mobile/tablet, 16ms for desktop)
    const renderTime = performance.now() - startTime;
    if (renderTime > this.frameInterval) {
      console.warn(
        `LayoutRenderer: Slow frame detected - ${renderTime.toFixed(2)}ms (threshold: ${this.frameInterval}ms)`,
        {
          viewport,
          systemCount: layout.systems.length,
          visibleSystemCount: visibleSystems.length,
          renderTime: `${renderTime.toFixed(2)}ms`
        }
      );
    }
  }

  /**
   * Renders a single music system (Task T017).
   * Called by renderSVG() for each visible system.
   * 
   * @param system - System to render (from GlobalLayout.systems)
   * @param offsetX - X offset in logical units (typically 0 for left-aligned)
   * @param offsetY - Y offset in logical units (for viewport scrolling)
   * @returns SVG group element containing system content
   */
  private renderSystem(system: System, offsetX: number, offsetY: number): SVGGElement {
    const systemGroup = createSVGGroup();
    
    // Apply transform to position system (Task T017)
    // Note: All element positions (staff lines, glyphs, bar lines) are computed
    // by the Rust layout engine as absolute coordinates that already include
    // system.bounding_box.y. We must NOT add it again as a translate offset,
    // otherwise elements get double-offset vertically.
    const x = system.bounding_box.x + offsetX;
    const y = offsetY;
    systemGroup.setAttribute('transform', `translate(${x}, ${y})`);
    systemGroup.setAttribute('data-system-index', system.index.toString());

    // Loop region overlay — inserted first so notes render on top
    if (this.props.loopRegion) {
      const overlay = this.renderLoopOverlay(system);
      if (overlay) systemGroup.appendChild(overlay);
    }

    // Render measure number above the system (T011)
    if (system.measure_number && !this.props.hideMeasureNumbers) {
      const text = createSVGElement('text');
      text.setAttribute('x', system.measure_number.position.x.toString());
      text.setAttribute('y', system.measure_number.position.y.toString());
      text.setAttribute('font-family', this.props.config.fontFamily);
      text.setAttribute('font-size', '40');
      text.setAttribute('fill', this.props.config.staffLineColor);
      text.setAttribute('data-measure-number', system.measure_number.number.toString());
      text.textContent = system.measure_number.number.toString();
      systemGroup.appendChild(text);
    }

    // Render each staff group (Task T018)
    for (const staffGroup of system.staff_groups) {
      const staffGroupElement = this.renderStaffGroup(staffGroup, system.index, system.staff_groups.length);
      systemGroup.appendChild(staffGroupElement);
    }

    // Feature 023: System bracket — thin vertical line connecting all staves
    // when there are multiple instruments (orchestral convention)
    if (system.staff_groups.length > 1) {
      const firstGroup = system.staff_groups[0];
      const lastGroup = system.staff_groups[system.staff_groups.length - 1];
      const topY = firstGroup.staves[0].staff_lines[0].y_position;
      const bottomY = lastGroup.staves[lastGroup.staves.length - 1].staff_lines[4].y_position;

      const bracketLine = createSVGElement('line');
      bracketLine.setAttribute('x1', '0');
      bracketLine.setAttribute('y1', topY.toString());
      bracketLine.setAttribute('x2', '0');
      bracketLine.setAttribute('y2', bottomY.toString());
      bracketLine.setAttribute('stroke', this.props.config.staffLineColor);
      bracketLine.setAttribute('stroke-width', '3');
      bracketLine.setAttribute('data-system-bracket', 'true');
      systemGroup.appendChild(bracketLine);
    }

    return systemGroup;
  }

  /**
   * Renders a semi-transparent loop-region overlay rect for `system`.
   *
   * Strategy:
   * 1. Skip entirely if the loop region doesn't overlap this system's tick_range.
   * 2. Build a tick → x map by scanning every glyph in the system via sourceToNoteIdMap + notes.
   * 3. x_start = x of first note >= loopStartTick (or staff left edge if loop begins before system).
   * 4. x_end   = x of first note >= loopEndTick   (or staff right edge if loop ends after system).
   *
   * The rect uses the `.loop-region` CSS class and has pointer-events:none so it
   * doesn't interfere with tap/long-press handling.
   */
  private renderLoopOverlay(system: System): SVGRectElement | null {
    const loopRegion = this.props.loopRegion!;

    // loopRegion ticks are in expanded (repeat-aware) tick space, but layout
    // systems use raw ticks. Convert expanded→raw via the note arrays.
    const rawNotes = this.props.rawNotes ?? this.props.notes;
    const expandedNotes = this.props.notes;
    let { startTick, endTick } = loopRegion;
    if (rawNotes && expandedNotes && rawNotes !== expandedNotes) {
      const rawById = new Map<string, number>();
      for (const n of rawNotes) rawById.set(n.id, n.start_tick);
      const exp2raw = new Map<number, number>();
      for (const n of expandedNotes) {
        const raw = rawById.get(n.id);
        if (raw !== undefined) exp2raw.set(n.start_tick, raw);
      }
      startTick = exp2raw.get(startTick) ?? startTick;
      endTick = exp2raw.get(endTick) ?? endTick;
    }

    const sysStart = system.tick_range.start_tick;
    const sysEnd   = system.tick_range.end_tick;

    // No overlap between loop and this system
    if (endTick <= sysStart || startTick >= sysEnd) return null;

    // Build tick → leftmost-x map from all glyphs in this system (raw ticks)
    const tickToX = new Map<number, number>();
    const { sourceToNoteIdMap } = this.props;

    if (sourceToNoteIdMap && rawNotes && rawNotes.length > 0) {
      const noteIdToTick = new Map<string, number>();
      for (const note of rawNotes) noteIdToTick.set(note.id, note.start_tick);

      for (const staffGroup of system.staff_groups) {
        for (const staff of staffGroup.staves) {
          for (const run of staff.glyph_runs) {
            for (const glyph of run.glyphs) {
              if (!glyph.source_reference) continue;
              const key = createSourceKey({ system_index: system.index, ...glyph.source_reference });
              const noteId = sourceToNoteIdMap.get(key);
              if (!noteId) continue;
              const tick = noteIdToTick.get(noteId);
              if (tick === undefined) continue;
              const existing = tickToX.get(tick);
              if (existing === undefined || glyph.position.x < existing) {
                tickToX.set(tick, glyph.position.x);
              }
            }
          }
        }
      }
    }

    // Resolve coordinate edges from staff lines (absolute in SVG space)
    const firstStaff = system.staff_groups[0]?.staves[0];
    const lastGroup  = system.staff_groups[system.staff_groups.length - 1];
    const lastStaff  = lastGroup?.staves[lastGroup.staves.length - 1];

    const topY    = firstStaff?.staff_lines[0]?.y_position        ?? system.bounding_box.y;
    const bottomY = lastStaff?.staff_lines[4]?.y_position          ?? (system.bounding_box.y + system.bounding_box.height);
    const leftEdge  = firstStaff?.staff_lines[0]?.start_x          ?? system.bounding_box.x;
    const rightEdge = firstStaff?.staff_lines[0]?.end_x            ?? (system.bounding_box.x + system.bounding_box.width);

    const sortedTicks = [...tickToX.keys()].sort((a, b) => a - b);

    // x_start: first note >= startTick (or left edge when loop precedes system)
    let xStart: number;
    if (startTick <= sysStart) {
      xStart = leftEdge;
    } else {
      const match = sortedTicks.find(t => t >= startTick);
      xStart = match !== undefined ? tickToX.get(match)! : leftEdge;
    }

    // x_end: first note >= endTick (or right edge when loop extends past system)
    let xEnd: number;
    if (endTick >= sysEnd) {
      xEnd = rightEdge;
    } else {
      const match = sortedTicks.find(t => t >= endTick);
      xEnd = match !== undefined ? tickToX.get(match)! : rightEdge;
    }

    if (xEnd <= xStart) return null;

    const rect = createSVGElement('rect') as SVGRectElement;
    rect.setAttribute('class', 'loop-region');
    rect.setAttribute('x',      xStart.toString());
    rect.setAttribute('y',      topY.toString());
    rect.setAttribute('width',  (xEnd - xStart).toString());
    rect.setAttribute('height', (bottomY - topY).toString());
    rect.setAttribute('pointer-events', 'none');
    return rect;
  }

  /**
   * Renders staff lines, braces, brackets for a group of staves (Task T018).
   * 
   * @param staffGroup - Staff group from system.staffGroups
   * @param systemIndex - System index for source reference mapping
   * @returns SVG group element containing staff group content
   */
  private renderStaffGroup(staffGroup: StaffGroup, systemIndex: number, systemGroupCount: number = 1): SVGGElement {
    const staffGroupElement = createSVGGroup();
    staffGroupElement.setAttribute('data-staff-group', 'true');
    staffGroupElement.setAttribute('data-instrument-id', staffGroup.instrument_id);

    // Render each staff first (Task T019)
    for (const staff of staffGroup.staves) {
      const staffElement = this.renderStaff(staff, systemIndex);
      staffGroupElement.appendChild(staffElement);
    }

    // Render braces/brackets AFTER staves so they appear on top (Tasks T045, T046 - US3)
    if (staffGroup.staves.length > 1 && staffGroup.bracket_type !== 'None') {
      const bracketElement = this.renderBracket(staffGroup);
      if (bracketElement) {
        staffGroupElement.appendChild(bracketElement);
      }
    }

    // Feature 023: Render instrument name label — only when multiple instruments (US2)
    if (staffGroup.name_label && systemGroupCount > 1) {
      const { name_label } = staffGroup;
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textElement.setAttribute('x', String(name_label.position.x));
      textElement.setAttribute('y', String(name_label.position.y));
      textElement.setAttribute('font-size', String(name_label.font_size));
      textElement.setAttribute('font-family', name_label.font_family);
      textElement.setAttribute('fill', `rgba(${name_label.color.r},${name_label.color.g},${name_label.color.b},${name_label.color.a / 255})`);
      textElement.setAttribute('text-anchor', 'end');
      textElement.setAttribute('dominant-baseline', 'central');
      textElement.setAttribute('data-instrument-name', 'true');
      textElement.textContent = name_label.text;
      staffGroupElement.appendChild(textElement);
    }

    return staffGroupElement;
  }

  /**
   * Renders brace or bracket for multi-staff instrument (Tasks T045, T046).
   * 
   * @param staffGroup - Staff group with multiple staves
   * @returns SVG group element with brace/bracket glyph, or null if not applicable
   */
  /**
   * Renders a bracket or brace using geometry calculated by the Rust layout engine.
   * All positioning, scaling, and visual calculations are done in Rust (architecture requirement).
   * 
   * @param staffGroup - Staff group containing bracket_glyph from Rust
   * @returns SVG group element or null if no bracket
   */
  private renderBracket(staffGroup: StaffGroup): SVGGElement | null {
    const { bracket_glyph, bracket_type } = staffGroup;
    if (!bracket_glyph) return null;

    const { config } = this.props;
    const bracketGroup = createSVGGroup();
    bracketGroup.setAttribute('class', 'bracket');
    bracketGroup.setAttribute('data-bracket-type', bracket_type.toLowerCase());

    if (bracket_type === 'Bracket') {
      // Draw a square bracket as SVG primitives: thick vertical bar + horizontal serifs
      const x = bracket_glyph.x;
      const topY = bracket_glyph.bounding_box.y;
      const bottomY = topY + bracket_glyph.bounding_box.height;
      const color = config.staffLineColor;
      const barWidth = 5;
      const serifWidth = 12;

      // Thick vertical bar
      const bar = createSVGElement('line');
      bar.setAttribute('x1', x.toString());
      bar.setAttribute('y1', topY.toString());
      bar.setAttribute('x2', x.toString());
      bar.setAttribute('y2', bottomY.toString());
      bar.setAttribute('stroke', color);
      bar.setAttribute('stroke-width', barWidth.toString());
      bar.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(bar);

      // Top serif
      const topSerif = createSVGElement('line');
      topSerif.setAttribute('x1', (x - barWidth / 2).toString());
      topSerif.setAttribute('y1', topY.toString());
      topSerif.setAttribute('x2', (x + serifWidth).toString());
      topSerif.setAttribute('y2', topY.toString());
      topSerif.setAttribute('stroke', color);
      topSerif.setAttribute('stroke-width', '2.5');
      topSerif.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(topSerif);

      // Bottom serif
      const bottomSerif = createSVGElement('line');
      bottomSerif.setAttribute('x1', (x - barWidth / 2).toString());
      bottomSerif.setAttribute('y1', bottomY.toString());
      bottomSerif.setAttribute('x2', (x + serifWidth).toString());
      bottomSerif.setAttribute('y2', bottomY.toString());
      bottomSerif.setAttribute('stroke', color);
      bottomSerif.setAttribute('stroke-width', '2.5');
      bottomSerif.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(bottomSerif);

      return bracketGroup;
    }

    // Brace: draw as an SVG Bézier path — avoids all font-metric guesswork.
    // The { shape: tips (right-facing) at topY and bottomY, two outward arcs,
    // meeting at a left-pointing spike at centerY.
    {
      const bb = bracket_glyph.bounding_box;
      const topY  = bb.y;
      const H     = bb.height;
      const bottomY = topY + H;
      const centerY = topY + H / 2;
      const color = config.staffLineColor;

      // Geometry: tips on the right, spine/bulges curving left, center spike further left.
      const xRight = bb.x + bb.width;          // right edge — where tips are (near staff)
      const xBulge = bb.x;                      // leftmost extent of the two lobes
      const xSpike = bb.x - bb.width * 0.25;   // center spike (slightly past left edge)

      // SVG cubic-Bézier path for { opening rightward:
      //  Upper half: tip → bulge arc → center spike
      //  Lower half: center spike → bulge arc → tip  (mirror)
      const d = [
        `M ${xRight},${topY}`,
        // upper arc: tip curves left and down to upper lobe, then back in to center spike
        `C ${xRight},${topY + H * 0.08}  ${xBulge},${topY + H * 0.04}  ${xBulge},${topY + H * 0.25}`,
        `C ${xBulge},${topY + H * 0.44}  ${xRight},${topY + H * 0.44}  ${xSpike},${centerY}`,
        // lower arc: mirror of upper half
        `C ${xRight},${centerY + H * 0.06}  ${xBulge},${bottomY - H * 0.44}  ${xBulge},${bottomY - H * 0.25}`,
        `C ${xBulge},${bottomY - H * 0.04}  ${xRight},${bottomY - H * 0.08}  ${xRight},${bottomY}`,
      ].join(' ');

      const path = createSVGElement('path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      bracketGroup.appendChild(path);

      return bracketGroup;
    }
  }

  /**
   * Renders 5 horizontal staff lines using SVG <line> elements (Task T019).
   * 
   * @param staff - Staff from staffGroup.staves
   * @returns SVG group element containing staff lines and glyphs
   */
  private renderStaff(staff: Staff, systemIndex: number): SVGGElement {
    const staffElement = createSVGGroup();
    staffElement.setAttribute('class', 'staff');

    const { config } = this.props;

    // Render 5 staff lines (Task T019)
    for (const staffLine of staff.staff_lines) {
      // Validate staff line position
      if (isNaN(staffLine.y_position) || isNaN(staffLine.start_x) || isNaN(staffLine.end_x)) {
        console.error('Invalid staff line position:', staffLine);
        continue; // Skip this staff line
      }
      
      const line = createSVGElement('line');
      line.setAttribute('x1', staffLine.start_x.toString());
      line.setAttribute('y1', staffLine.y_position.toString());
      line.setAttribute('x2', staffLine.end_x.toString());
      line.setAttribute('y2', staffLine.y_position.toString());
      line.setAttribute('stroke', config.staffLineColor);
      line.setAttribute('stroke-width', '1');
      staffElement.appendChild(line);
    }

    // Render bar lines (measure separators)
    if (staff.bar_lines) {
      for (const barLine of staff.bar_lines) {
        const barLineElement = this.renderBarLine(barLine, config);
        staffElement.appendChild(barLineElement);
      }
    }

    // Render ledger lines (short lines for notes above/below staff)
    if (staff.ledger_lines) {
      for (const ledgerLine of staff.ledger_lines) {
        const line = createSVGElement('line');
        line.setAttribute('x1', ledgerLine.start_x.toString());
        line.setAttribute('y1', ledgerLine.y_position.toString());
        line.setAttribute('x2', ledgerLine.end_x.toString());
        line.setAttribute('y2', ledgerLine.y_position.toString());
        line.setAttribute('stroke', config.staffLineColor);
        line.setAttribute('stroke-width', '1.5');
        staffElement.appendChild(line);
      }
    }

    // Render glyph runs (Task T020)
    for (const glyphRun of staff.glyph_runs) {
      const glyphRunElement = this.renderGlyphRun(glyphRun, systemIndex);
      staffElement.appendChild(glyphRunElement);
    }

    // Render structural glyphs (clefs, key signatures, time signatures)
    for (const glyph of staff.structural_glyphs) {
      // Structural glyphs use SMuFL standard: fontSize 80 = 4 staff spaces = 1em
      const glyphElement = this.renderGlyph(glyph, config.fontFamily, 80, config.glyphColor);
      staffElement.appendChild(glyphElement);
    }

    return staffElement;
  }

  /**
   * Renders a bar line using geometry calculated by the Rust layout engine.
   * Compliant with Principle VI: Layout Engine Authority.
   * 
   * @param barLine - Bar line data with pre-calculated segment positions
   * @param config - Render configuration
   * @returns SVG group element containing bar line segment(s)
   */
  private renderBarLine(barLine: BarLine, config: RenderConfig): SVGGElement {
    const barLineGroup = createSVGGroup();
    barLineGroup.setAttribute('class', 'bar-line');
    barLineGroup.setAttribute('data-bar-type', barLine.bar_type);

    const strokeColor = config.staffLineColor;

    // Render each segment using geometry from Rust layout engine
    // No position calculations in renderer (Principle VI compliance)
    for (const segment of barLine.segments) {
      const line = createSVGElement('line');
      line.setAttribute('x1', segment.x_position.toString());
      line.setAttribute('y1', segment.y_start.toString());
      line.setAttribute('x2', segment.x_position.toString());
      line.setAttribute('y2', segment.y_end.toString());
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', segment.stroke_width.toString());
      barLineGroup.appendChild(line);
    }

    // Render repeat dots using coordinates pre-calculated by Rust layout engine
    // Principle VI: dot positions are never recalculated here — read verbatim from layout output
    for (const dot of barLine.dots ?? []) {
      const circle = createSVGElement('circle');
      circle.setAttribute('cx', dot.x.toString());
      circle.setAttribute('cy', dot.y.toString());
      circle.setAttribute('r', dot.radius.toString());
      circle.setAttribute('fill', strokeColor);
      barLineGroup.appendChild(circle);
    }

    return barLineGroup;
  }

  /**
   * Renders a batch of identical glyphs via SVG <text> elements (Task T020).
   * Leverages Feature 016's GlyphRun batching for performance.
   * 
   * @param run - Glyph run from system.glyphRuns
   * @returns SVG group element containing glyph batch
   */
  private renderGlyphRun(run: GlyphRun, systemIndex: number): SVGGElement {
    const glyphRunGroup = createSVGGroup();
    glyphRunGroup.setAttribute('class', 'glyph-run');

    // Use the GlyphRun's font properties, not the generic config
    const fontFamily = run.font_family || 'Bravura';
    const fontSize = run.font_size || 40;
    const color = run.color ? `rgb(${run.color.r}, ${run.color.g}, ${run.color.b})` : '#000000';

    // Render each glyph in the run (Task T020)
    // Feature 024: Do NOT bake highlight colors into SVG attributes.
    // The rAF highlight loop manages CSS classes (`.highlighted`) which
    // override fill/stroke via !important. Inline blue fills would persist
    // when the CSS class is removed, causing stale highlights.
    const { sourceToNoteIdMap } = this.props;

    for (const glyph of run.glyphs) {
      // Resolve noteId from source reference
      let noteId: string | undefined;
      let isSelected = false;
      if (sourceToNoteIdMap && glyph.source_reference) {
        const sourceKey = createSourceKey({
          system_index: systemIndex,
          ...glyph.source_reference
        });
        noteId = sourceToNoteIdMap.get(sourceKey);
        
        if (noteId) {
          if (this.props.selectedNoteId === noteId) {
            isSelected = true;
          }
        }
      }
      
      // Never pass isHighlighted=true here; highlighting is CSS-class only (Feature 024)
      const glyphElement = this.renderGlyph(glyph, fontFamily, fontSize, color, isSelected);
      // Add data-note-id for click detection and highlight targeting (Feature 019, 024)
      if (noteId) {
        (glyphElement as SVGElement).dataset.noteId = noteId;
        // Beam polygons (U+0001) span the entire beamed group and share the first
        // note's ID — highlight them would make the whole group turn orange (Bug #2).
        // They keep data-note-id for tap/click detection but are NOT marked as
        // layout-glyph so the querySelectorAll('.layout-glyph[data-note-id]') in
        // updateHighlights / updatePinnedHighlights skips them.
        const isBeam = glyph.codepoint === '\u0001' || glyph.codepoint === '\x01';
        if (!isBeam) {
          glyphElement.classList.add('layout-glyph');
        }
        glyphElement.style.cursor = 'pointer';
      }
      glyphRunGroup.appendChild(glyphElement);

      // Feature 027 (T016): Transparent hit-rect overlay per notehead (FR-006, SC-006).
      // Minimum 44px touch target per WCAG (Constitution VI: use Rust bounding_box geometry).
      // renderScale defaults to 1 when not provided (layout coords ≈ CSS pixels).
      if (noteId) {
        const MIN_TOUCH_PX = 44;
        const renderScale = 1; // layout units are in CSS-pixel equivalents at scale=1
        const bb = glyph.bounding_box;
        const hitW = Math.max(bb.width, MIN_TOUCH_PX / renderScale);
        const hitH = Math.max(bb.height, MIN_TOUCH_PX / renderScale);
        // Center the enlarged hit rect over the glyph bounding box
        const hitX = bb.x - (hitW - bb.width) / 2;
        const hitY = bb.y - (hitH - bb.height) / 2;

        const hitRect = createSVGElement('rect') as SVGRectElement;
        hitRect.setAttribute('x', hitX.toString());
        hitRect.setAttribute('y', hitY.toString());
        hitRect.setAttribute('width', hitW.toString());
        hitRect.setAttribute('height', hitH.toString());
        hitRect.setAttribute('fill', 'transparent');
        hitRect.setAttribute('pointer-events', 'all');
        hitRect.setAttribute('cursor', 'pointer');
        (hitRect as SVGElement).dataset.noteId = noteId;
        glyphRunGroup.appendChild(hitRect);
      }
    }

    return glyphRunGroup;
  }

  /**
   * Renders a single glyph as SVG element.
   * Special handling for stems (U+0000) and beams (U+0001).
   * 
   * @param glyph - Glyph to render
   * @param fontFamily - Font family (e.g., 'Bravura')
   * @param fontSize - Font size in logical units
   * @param color - Fill color
   * @param isSelected - Whether this glyph belongs to the selected note
   * @returns SVG element (text for SMuFL, line for stem, rect for beam)
   */
  private renderGlyph(glyph: Glyph, fontFamily: string, fontSize: number, color: string, isSelected = false): SVGElement {
    // Check for special glyphs (stems and beams)
    const codepoint = glyph.codepoint;
    
    // Determine colors: selected (orange) > normal (never inline-set highlight colors;
    // highlighting is CSS-class-only via rAF loop, Feature 024)
    const fillColor = isSelected ? '#FF6B00' : color;
    const strokeColor = isSelected ? '#CC5500' : color;
    
    // U+0000: Stem (vertical line)
    if (codepoint === '\u{0000}' || codepoint === '\0') {
      const line = createSVGElement('line');
      line.setAttribute('x1', glyph.position.x.toString());
      line.setAttribute('y1', glyph.position.y.toString());
      line.setAttribute('x2', glyph.position.x.toString());
      line.setAttribute('y2', (glyph.position.y + glyph.bounding_box.height).toString());
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', glyph.bounding_box.width.toString());
      line.setAttribute('stroke-linecap', 'butt');
      if (isSelected) {
        line.setAttribute('class', 'selected');
      }
      return line;
    }
    
    // U+0001: Beam (filled polygon for sloped beams)
    // Encoding contract from backend:
    //   position.x/y = left-side beam start (x_start, y_start)
    //   bounding_box.y = right-side Y (y_end) for slope reconstruction
    //   bounding_box.width = horizontal span (x_end - x_start)
    //   bounding_box.height = beam thickness
    if (codepoint === '\u{0001}' || codepoint === '\x01') {
      const x1 = glyph.position.x;        // Left X
      const y1Top = glyph.position.y;      // Left Y (top of beam)
      const x2 = x1 + glyph.bounding_box.width; // Right X
      const y2Top = glyph.bounding_box.y;  // Right Y (top of beam, may differ from y1 for slope)
      const thickness = glyph.bounding_box.height;
      
      // Build a 4-point polygon for the sloped beam:
      // top-left, top-right, bottom-right, bottom-left
      const polygon = createSVGElement('polygon');
      const points = `${x1},${y1Top} ${x2},${y2Top} ${x2},${y2Top + thickness} ${x1},${y1Top + thickness}`;
      polygon.setAttribute('points', points);
      polygon.setAttribute('fill', fillColor);
      if (isSelected) {
        polygon.setAttribute('class', 'selected');
      }
      return polygon;
    }
    
    // Regular SMuFL glyph (text element)
    const text = createSVGElement('text');
    
    // Validate position values to catch NaN errors
    if (isNaN(glyph.position.x) || isNaN(glyph.position.y)) {
      console.error('Invalid glyph position:', glyph);
      // Use fallback position instead of crashing
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
    } else {
      text.setAttribute('x', glyph.position.x.toString());
      text.setAttribute('y', glyph.position.y.toString());
    }
    
    text.setAttribute('font-family', fontFamily);
    text.setAttribute('font-size', fontSize.toString());
    text.setAttribute('fill', fillColor);
    if (isSelected) {
      text.setAttribute('class', 'selected');
    }
    
    // SMuFL noteheads should be vertically centered on staff lines
    // Use 'middle' to center horizontally on X coordinate
    // Use 'middle' baseline to center vertically on Y coordinate (staff line position)
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    
    // Set SMuFL codepoint as text content (Task T020)
    // Handle invalid codepoints (Task T023)
    try {
      text.textContent = glyph.codepoint;
    } catch (error) {
      // Render placeholder for invalid codepoint (Task T023)
      console.warn(`Invalid SMuFL codepoint: ${glyph.codepoint}`, error);
      text.textContent = '\u25A1'; // Empty square placeholder
      text.setAttribute('fill', '#FF0000'); // Red to indicate error
    }

    return text;
  }

  /**
   * Renders error message when layout is missing (Task T022).
   * 
   * @param svg - SVG element to render error into
   * @param message - Error message to display
   */
  private renderError(svg: SVGSVGElement, message: string): void {
    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.setAttribute('font-size', '16');
    text.setAttribute('fill', '#999999');
    text.textContent = message;

    svg.appendChild(text);
  }

  /**
   * React render method - returns SVG element
   */
  render() {
    const { className } = this.props;
    
    return (
      <svg
        ref={this.svgRef}
        className={`layout-renderer-svg${className ? ` ${className}` : ''}`}
        xmlns={svgNS}
        preserveAspectRatio="xMinYMin meet"
        style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
      />
    );
  }
}
