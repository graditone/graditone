/**
 * LayoutRenderer Component
 * Feature 017 - SVG-based music notation renderer
 * 
 * Renders music notation using exact glyph positions computed by
 * Feature 016 (Rust Layout Engine). Uses SVG DOM with viewBox for
 * resolution-independent display.
 */

import { Component, createRef, type RefObject } from 'react';
import type { GlobalLayout } from '../wasm/layout';
import type { RenderConfig } from '../types/RenderConfig';
import type { Viewport } from '../types/Viewport';
import { 
  validateRenderConfig, 
  validateViewport,
  getVisibleSystems,
  svgNS,
} from '../utils/renderUtils';
import { detectDeviceProfile } from '../utils/deviceDetection';
import type { ITickSource } from '../types/playback';
import { RenderingPipeline, STAFF_LINE_STROKE_WIDTH, LEDGER_LINE_STROKE_WIDTH } from './renderer/RenderingPipeline';
import { HighlightController } from './renderer/HighlightController';
import { InteractionHandler } from './renderer/InteractionHandler';
import { LoopOverlayRenderer } from './renderer/LoopOverlayRenderer';
import './LayoutRenderer.css';

// Re-export constants for backward compatibility
export { STAFF_LINE_STROKE_WIDTH, LEDGER_LINE_STROKE_WIDTH };

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
  /** Error note IDs — rendered with red highlight (auto-advance flash) */
  errorNoteIds?: Set<string>;
  /** Expected note IDs — rendered with green at low opacity ("play this") */
  expectedNoteIds?: Set<string>;
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

  /** Extracted rendering pipeline */
  private pipeline: RenderingPipeline;

  /** Extracted highlight controller */
  private highlightCtrl: HighlightController;

  /** Extracted interaction handler */
  private interaction: InteractionHandler;

  /** Extracted loop overlay renderer */
  private loopOverlay: LoopOverlayRenderer;

  /** Target frame interval for slow-frame warnings */
  private frameInterval: number;

  constructor(props: LayoutRendererProps) {
    super(props);
    this.svgRef = createRef();

    // Validate config on construction
    validateRenderConfig(props.config);
    validateViewport(props.viewport);

    // Feature 024 (T017): Detect device profile for frame rate selection
    const profile = detectDeviceProfile();

    this.pipeline = new RenderingPipeline();
    this.highlightCtrl = new HighlightController(profile.targetFrameIntervalMs, profile.frameBudgetMs);
    this.frameInterval = profile.targetFrameIntervalMs;
    this.interaction = new InteractionHandler();
    this.loopOverlay = new LoopOverlayRenderer();

    // Feature 024: Build highlight index if notes provided
    if (props.notes && props.notes.length > 0) {
      this.highlightCtrl.buildIndex(props.notes);
    }
  }

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
      nextProps.errorNoteIds !== this.props.errorNoteIds ||
      nextProps.expectedNoteIds !== this.props.expectedNoteIds ||
      nextProps.loopRegion !== this.props.loopRegion
    );
  }

  /**
   * Render SVG after component mounts and start highlight loop
   */
  componentDidMount(): void {
    // React StrictMode in dev unmounts+remounts every component once.
    // Rebuild highlight index if it was cleared during unmount.
    if (this.props.notes && this.props.notes.length > 0 && this.highlightCtrl.noteCount === 0) {
      this.highlightCtrl.buildIndex(this.props.notes);
    }
    if (this.svgRef.current) {
      this.pipeline.init(this.svgRef.current);
      this.highlightCtrl.init(this.svgRef.current);
      this.interaction.init(this.svgRef.current);
      this.interaction.setCallback(this.props.onNoteClick);
    }
    this.renderSVG();
    this.highlightCtrl.setHighlightedNoteIds(this.props.highlightedNoteIds);
    this.highlightCtrl.startLoop(this.props.tickSourceRef);
  }

  /**
   * Cleanup event listener and stop highlight loop
   */
  componentWillUnmount(): void {
    this.highlightCtrl.dispose();
    this.interaction.dispose();
    this.pipeline.dispose();
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
      if (this.visibleSystemsChanged(prevProps.viewport)) {
        this.renderSVG();
        this.reapplyHighlights();
      }
    }

    // Rebuild highlight index when notes change
    if (prevProps.notes !== this.props.notes) {
      const newNotes = this.props.notes;
      if (newNotes && newNotes.length > 0) {
        this.highlightCtrl.buildIndex(newNotes);
      }
    }

    // Update live highlight IDs when prop changes
    if (prevProps.highlightedNoteIds !== this.props.highlightedNoteIds) {
      this.highlightCtrl.setHighlightedNoteIds(this.props.highlightedNoteIds);
    }

    // Apply pinned highlight when pinnedNoteIds prop changes
    if (prevProps.pinnedNoteIds !== this.props.pinnedNoteIds) {
      this.highlightCtrl.updatePinned(this.props.pinnedNoteIds);
    }

    // Apply error highlight when errorNoteIds prop changes
    if (prevProps.errorNoteIds !== this.props.errorNoteIds) {
      this.highlightCtrl.updateError(this.props.errorNoteIds);
    }

    // Apply expected highlight when expectedNoteIds prop changes
    if (prevProps.expectedNoteIds !== this.props.expectedNoteIds) {
      this.highlightCtrl.updateExpected(this.props.expectedNoteIds);
    }

    // Re-render SVG when loop region changes (overlay rect must be redrawn)
    if (prevProps.loopRegion !== this.props.loopRegion) {
      this.renderSVG();
      this.reapplyHighlights();
    }

    // Update note click callback when prop changes
    if (prevProps.onNoteClick !== this.props.onNoteClick) {
      this.interaction.setCallback(this.props.onNoteClick);
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

  // ─── Feature 024: Highlight delegation ─────────────────────────────

  /**
   * Thin wrapper for reapplyHighlights — delegates to HighlightController.
   * Kept on LayoutRenderer to allow componentDidUpdate to call it after structural renders.
   */
  private reapplyHighlights(): void {
    this.highlightCtrl.reapplyHighlights();
  }

  /**
   * Main rendering entry point.
   * Delegates to RenderingPipeline for SVG construction.
   */
  private renderSVG(): void {
    const startTime = performance.now();

    const { layout, viewport, config } = this.props;

    if (!layout) {
      this.pipeline.renderError('No layout available');
      return;
    }

    this.pipeline.renderAll(layout, config, viewport, {
      hideMeasureNumbers: this.props.hideMeasureNumbers,
      selectedNoteId: this.props.selectedNoteId,
      sourceToNoteIdMap: this.props.sourceToNoteIdMap,
      unitsPerSpace: layout.units_per_space,
    });

    // Render loop overlay — delegated to LoopOverlayRenderer
    if (this.props.loopRegion) {
      const svg = this.svgRef.current;
      if (svg) {
        this.loopOverlay.renderOverlays(svg, layout, viewport, {
          loopRegion: this.props.loopRegion,
          rawNotes: this.props.rawNotes ?? this.props.notes,
          expandedNotes: this.props.notes,
          sourceToNoteIdMap: this.props.sourceToNoteIdMap,
        });
      }
    }

    const renderTime = performance.now() - startTime;
    if (renderTime > this.frameInterval) {
      console.warn(
        `LayoutRenderer: Slow frame detected - ${renderTime.toFixed(2)}ms (threshold: ${this.frameInterval}ms)`,
        {
          viewport,
          systemCount: layout.systems.length,
          visibleSystemCount: getVisibleSystems(layout.systems, viewport).length,
          renderTime: `${renderTime.toFixed(2)}ms`
        }
      );
    }
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
