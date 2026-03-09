/**
 * ScoreViewer Component
 * Feature 017 - Interactive music score viewer with scrolling and zoom
 * 
 * Integrates LayoutRenderer with viewport management, scroll handling,
 * and zoom controls for production use.
 */

import { Component, createRef, type RefObject } from 'react';
import { LayoutRenderer } from '../components/LayoutRenderer';
import { createDefaultConfig } from '../utils/renderUtils';
import type { GlobalLayout } from '../wasm/layout';
import type { RenderConfig } from '../types/RenderConfig';
import type { Viewport } from '../types/Viewport';
import type { ITickSource } from '../types/playback';

/**
 * Props for ScoreViewer component
 */
export interface ScoreViewerProps {
  /** Computed layout from Feature 016's computeLayout() */
  layout: GlobalLayout | null;
  /** Optional custom rendering configuration */
  config?: RenderConfig;
  /** Initial zoom level (1.0 = 100%, 2.0 = 200%) */
  initialZoom?: number;
  /** Enable dark mode (overrides config colors) */
  darkMode?: boolean;
  /** Feature 019: Set of note IDs to highlight during playback */
  highlightedNoteIds?: Set<string>;
  /** Feature 019: Map from SourceReference keys to Note IDs */
  sourceToNoteIdMap?: Map<string, string>;
  /** Long-press pinned note IDs — rendered with permanent green highlight */
  pinnedNoteIds?: Set<string>;
  /** Note IDs for auto-scroll targeting; overrides highlightedNoteIds for scroll only */
  scrollTargetNoteIds?: Set<string>;
  /** Loop region for overlay rect and rAF loop-back */
  loopRegion?: { startTick: number; endTick: number } | null;
  /** Toggle playback on click/touch of the score */
  onTogglePlayback?: () => void;
  /** Callback when a note glyph is clicked */
  onNoteClick?: (noteId: string) => void;
  /** ID of the currently selected note */
  selectedNoteId?: string;
  /** Feature 024: Tick source ref for rAF-driven highlights.
   * Must be a ref object so the rAF loop reads live tick data
   * even when shouldComponentUpdate blocks React re-renders. */
  tickSourceRef?: { current: ITickSource };
  /** Feature 024: Notes array for building HighlightIndex */
  notes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Raw (unexpanded) notes — original ticks matching the layout engine.
   * Used for tickFromNoteId lookups and loop overlay rendering. */
  rawNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Long-press pin: combined seek + note highlight callback.
   * tick=null means unpin. noteId is the spatially nearest note to the tap. */
  onPin?: (tick: number | null, noteId: string | null) => void;
  /** Current pinned note ID (null = not pinned) — used for same-note unpin detection */
  pinnedNoteId?: string | null;
  /** Short tap when far from current position: seek + auto-play */
  onSeekAndPlay?: (tick: number) => void;
  /** Current playback status — used to decide tap behaviour */
  playbackStatus?: 'playing' | 'paused' | 'stopped';
  /** Suppress rendering of measure number labels above each system */
  hideMeasureNumbers?: boolean;
  /**
   * Optional scroll container element. When provided, ScoreViewer listens
   * to this element's scroll events and drives scrollTo() on it instead of
   * using window. Required when the score is embedded inside an overflow:auto
   * wrapper (e.g. the play-score plugin) rather than a full-page scroll layout.
   */
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

/**
 * State for ScoreViewer component
 */
interface ScoreViewerState {
  /** Current viewport region */
  viewport: Viewport;
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Rendering configuration (supports dark mode) */
  config: RenderConfig;
  /** Current scroll position in pixels */
  scrollTop: number;
}

/**
 * ScoreViewer component implementation (T066-T067)
 * 
 * Features:
 * - Scroll-based viewport tracking (T066)
 * - Zoom controls via viewBox manipulation (T067)
 * - Dark mode support (T069)
 * - Error boundary integration (T070)
 * 
 * @example
 * ```tsx
 * import { computeLayout } from '../wasm/layout';
 * 
 * function App() {
 *   const [layout, setLayout] = useState<GlobalLayout | null>(null);
 * 
 *   useEffect(() => {
 *     const result = computeLayout(compiledScore);
 *     setLayout(result);
 *   }, [compiledScore]);
 * 
 *   return <ScoreViewer layout={layout} />;
 * }
 * ```
 */
/**
 * Base scale factor: the layout coordinate system is authored at 2x visual size,
 * so a user-facing zoom of 100% actually renders at 0.5× layout units.
 */
const BASE_SCALE = 0.5;

/**
 * Label margin: extra space on the left of each system for instrument name labels.
 * Feature 026 (Fix P2): Increased from 80 → 150 layout units to prevent clipping
 * of multi-instrument names at typical render scales.
 */
export const LABEL_MARGIN = 150;

export class ScoreViewer extends Component<ScoreViewerProps, ScoreViewerState> {
  /** Reference to scroll container */
  private containerRef: RefObject<HTMLDivElement | null>;
  
  /** Reference to the wrapper div for scroll-into-view calculations */
  private wrapperRef: RefObject<HTMLDivElement | null>;
  
  /** Debounce timer for scroll events */
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  /** Track which system we last auto-scrolled to, to avoid redundant scrolls */
  private lastAutoScrollSystemIndex: number = -1;

  /** Active auto-scroll animation frame ID */
  private autoScrollAnimationId: number | null = null;

  /** System index that the current auto-scroll animation is targeting */
  private autoScrollTargetSystemIndex: number = -1;

  /** Feature 024 (T026): rAF-based scroll throttle ID */
  private scrollRafId: number = 0;

  /** Long-press seek: timer handle */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last touch X used for both long-press and short-tap logic */
  private touchX: number = 0;
  /** Last touch Y */
  private touchY: number = 0;
  /** True once the 500ms long-press timer fires; suppresses short-tap handling */
  private longPressFired: boolean = false;
  /** True after any touchend; suppresses the subsequent synthetic click event */
  private touchWasHandled: boolean = false;
  /** True if the finger drifted enough during a touch to count as a scroll */
  private hasMoved: boolean = false;

  /** Mouse long-press: timer handle (desktop equivalent of touch long-press) */
  private mouseLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  /** Starting X of the current mouse-down (for drift detection) */
  private mouseDownX: number = 0;
  /** Starting Y of the current mouse-down */
  private mouseDownY: number = 0;
  /** True once the 500ms mouse long-press timer fires; suppresses click */
  private mouseLongPressFired: boolean = false;

  /** Feature 024 (T027): Last scroll position applied to viewport (avoid redundant setState)
   * Initialize to -Infinity so the first updateViewport() call always runs. */
  private lastAppliedScrollTop: number = -Infinity;

  /** Reverse index: noteId → systemIndex. Built once when sourceToNoteIdMap changes.
   * Replaces the O(systems × notes) nested scan in scrollToHighlightedSystem
   * with an O(k) lookup where k = number of highlighted notes. */
  private noteIdToSystemIndex: Map<string, number> = new Map();

  /** The sourceToNoteIdMap instance used to build noteIdToSystemIndex */
  private cachedSourceMap: Map<string, string> | null = null;

  /** Feature 024 (T027): Minimum scroll delta before updating viewport state (pixels) */
  private static readonly SCROLL_THRESHOLD = 4;

  constructor(props: ScoreViewerProps) {
    super(props);
    this.containerRef = createRef();
    this.wrapperRef = createRef();

    const baseConfig = props.config || createDefaultConfig();
    const config = props.darkMode ? this.createDarkModeConfig(baseConfig) : baseConfig;

    this.state = {
      viewport: {
        x: -LABEL_MARGIN, // Start with label margin to prevent clef cutoff on first render
        y: 0,
        width: 2400 + LABEL_MARGIN, // Include label margin in width
        height: 10000, // Large initial height to show all systems until updateViewport adjusts it
      },
      zoom: 1.0,
      scrollTop: 0,
      config,
    };
  }

  /**
   * Create dark mode configuration (T069)
   */
  private createDarkModeConfig(base: RenderConfig): RenderConfig {
    return {
      ...base,
      backgroundColor: '#1E1E1E',
      staffLineColor: '#CCCCCC',
      glyphColor: '#FFFFFF',
    };
  }

  /**
   * Setup scroll event listener
   * Uses window scroll since container has overflow:visible (page scrollbar)
   */
  componentDidMount(): void {
    const scrollEl = this.props.scrollContainerRef?.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', this.handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }
    this.updateViewport();
  }

  /**
   * Cleanup scroll event listener
   */
  componentWillUnmount(): void {
    const scrollEl = this.props.scrollContainerRef?.current;
    if (scrollEl) {
      scrollEl.removeEventListener('scroll', this.handleScroll);
    } else {
      window.removeEventListener('scroll', this.handleScroll);
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
    if (this.mouseLongPressTimer !== null) {
      clearTimeout(this.mouseLongPressTimer);
    }
    if (this.autoScrollAnimationId !== null) {
      cancelAnimationFrame(this.autoScrollAnimationId);
    }
    // Feature 024 (T026): Cancel pending scroll rAF
    if (this.scrollRafId !== 0) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = 0;
    }
  }

  /**
   * Update config when dark mode changes, update viewport when layout changes,
   * and auto-scroll to follow highlighted notes during playback.
   */
  componentDidUpdate(prevProps: ScoreViewerProps): void {
    if (prevProps.darkMode !== this.props.darkMode) {
      const baseConfig = this.props.config || createDefaultConfig();
      const config = this.props.darkMode ? this.createDarkModeConfig(baseConfig) : baseConfig;
      this.setState({ config });
    }
    
    // Update viewport when layout changes (new score loaded / note count changed).
    // Reset lastAppliedScrollTop so the SCROLL_THRESHOLD guard in updateViewport()
    // does not short-circuit the update when scrollTop hasn't moved — otherwise
    // viewport.width stays locked to the previous layout's total_width.
    if (prevProps.layout !== this.props.layout && this.props.layout) {
      this.lastAppliedScrollTop = -Infinity;
      this.updateViewport();
    }

    // Auto-scroll to follow the scroll target (if set) or highlighted notes.
    // scrollTargetNoteIds overrides highlightedNoteIds for scroll purposes,
    // allowing practice mode to scroll to the user's target note while the
    // highlight shows the phantom tempo position.
    const scrollIds = this.props.scrollTargetNoteIds ?? this.props.highlightedNoteIds;
    const prevScrollIds = prevProps.scrollTargetNoteIds ?? prevProps.highlightedNoteIds;
    if (
      scrollIds !== prevScrollIds &&
      scrollIds &&
      scrollIds.size > 0 &&
      this.props.layout &&
      this.props.sourceToNoteIdMap
    ) {
      this.scrollToHighlightedSystem(scrollIds);
    }

    // Reset auto-scroll tracking when scroll target stops
    if (
      prevScrollIds &&
      prevScrollIds.size > 0 &&
      (!scrollIds || scrollIds.size === 0)
    ) {
      this.lastAutoScrollSystemIndex = -1;
    }
  }

  /**
   * Handle scroll events with rAF-based throttling (T066, T026)
   * Feature 024 (T026): Replaced setTimeout debounce with rAF for
   * efficient scroll handling that aligns with display refresh rate.
   */
  /**
   * Touch strategy:
   *   Short tap, close to current position  → toggle play/stop
   *   Short tap, far from current position  → seek + auto-play
   *   Long press (≥ 500 ms, finger still)   → pin / unpin at this position
   *
   * Scroll detection: if finger drifts > 15 px, cancel long press AND mark
   * hasMoved=true so the short-tap handler is also suppressed on touchEnd.
   */
  private handleTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    this.touchX = touch.clientX;
    this.touchY = touch.clientY;
    this.longPressFired = false;
    this.touchWasHandled = false;
    this.hasMoved = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      // Long press → pin / unpin
      // Spatial lookup: find the note glyph closest to the touch point so we
      // pin exactly the note the user tapped (not all notes at that tick, and
      // not accidentals or notes from the other clef/staff).
      const noteId = this.findNearestNoteId(this.touchX, this.touchY);
      // Use the note's actual start_tick — linear tickFromTouch is inaccurate
      // because notes are not linearly spaced along the visual system width.
      const tick = (noteId !== null ? this.tickFromNoteId(noteId) : null)
        ?? this.tickFromTouch(this.touchX, this.touchY);
      // Always pass (tick, noteId) — the loop state machine in ScoreViewer
      // (component layer) decides whether this is a pin, unpin, or loop clear.
      this.props.onPin?.(tick, noteId);
    }, 500);
  };

  private handleTouchEnd = (): void => {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.touchWasHandled = true;
    if (!this.longPressFired && !this.hasMoved) {
      // Short tap (not a scroll, not a long press): toggle or seek-and-play
      this.handleTapAt(this.touchX, this.touchY);
    }
  };

  private handleTouchCancel = (): void => {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.touchWasHandled = true;
    this.hasMoved = true; // treat cancel as a scroll (suppress tap)
  };

  private handleTouchMove = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchX;
    const dy = touch.clientY - this.touchY;
    if (Math.sqrt(dx * dx + dy * dy) > 15) {
      // Finger drifted: this is a scroll gesture — cancel long press and mark moved
      this.hasMoved = true;
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }
  };

  /**
   * Short tap logic (simplified):
   *   Playing  → pause at current position
   *   Stopped/paused → seek to the tapped note and play.
   *     If a green pin is set, play() will automatically use it instead of the
   *     tapped position (pin priority is handled inside MusicTimeline.play()).
   */
  private handleTapAt = (clientX: number, clientY: number): void => {
    if (this.props.playbackStatus === 'playing') {
      this.props.onTogglePlayback?.(); // pause
      return;
    }
    // Resolve tapped position using nearest note's exact start_tick.
    const nearestNoteId = this.findNearestNoteId(clientX, clientY);
    const tick = (nearestNoteId !== null ? this.tickFromNoteId(nearestNoteId) : null)
      ?? this.tickFromTouch(clientX, clientY);
    // Seek and play from tapped position (pin takes priority inside play()).
    this.props.onSeekAndPlay?.(tick ?? 0);
  };

  /**
   * Click handler (mouse/pointer; suppressed after touch or mouse long-press).
   */
  private handleContainerClick = (e: React.MouseEvent): void => {
    if (this.touchWasHandled) { this.touchWasHandled = false; return; }
    if (this.mouseLongPressFired) { this.mouseLongPressFired = false; return; }
    this.handleTapAt(e.clientX, e.clientY);
  };

  /** Mouse-down: start 500ms long-press timer (mirrors handleTouchStart). */
  private handleMouseDown = (e: React.MouseEvent): void => {
    // Only primary button; ignore right-click (context menu)
    if (e.button !== 0) return;
    this.mouseDownX = e.clientX;
    this.mouseDownY = e.clientY;
    this.mouseLongPressFired = false;
    this.mouseLongPressTimer = setTimeout(() => {
      this.mouseLongPressFired = true;
      const noteId = this.findNearestNoteId(this.mouseDownX, this.mouseDownY);
      const tick = (noteId !== null ? this.tickFromNoteId(noteId) : null)
        ?? this.tickFromTouch(this.mouseDownX, this.mouseDownY);
      this.props.onPin?.(tick, noteId);
    }, 500);
  };

  /** Mouse-up: cancel the timer (click handler fires separately for short press). */
  private handleMouseUp = (): void => {
    if (this.mouseLongPressTimer !== null) {
      clearTimeout(this.mouseLongPressTimer);
      this.mouseLongPressTimer = null;
    }
  };

  /** Mouse-move: cancel long-press if pointer drifts > 15 px (scroll/drag). */
  private handleMouseMove = (e: React.MouseEvent): void => {
    if (this.mouseLongPressTimer === null) return;
    const dx = e.clientX - this.mouseDownX;
    const dy = e.clientY - this.mouseDownY;
    if (Math.sqrt(dx * dx + dy * dy) > 15) {
      clearTimeout(this.mouseLongPressTimer);
      this.mouseLongPressTimer = null;
    }
  };

  /** Mouse-leave: cancel long-press when pointer leaves the container. */
  private handleMouseLeave = (): void => {
    if (this.mouseLongPressTimer !== null) {
      clearTimeout(this.mouseLongPressTimer);
      this.mouseLongPressTimer = null;
    }
  };

  /**
   * Compute the playback tick at a screen coordinate (clientX, clientY).
   * Returns null if the position doesn't correspond to a valid system.
   */
  /**
   * Spatial nearest-note lookup: finds the note glyph element (`.layout-glyph`)
   * whose bounding-box centre is closest to the given screen coordinate.
   * Returns the note's ID string, or null if no glyphs are visible.
   *
   * Using `.layout-glyph` (visual SVG elements, not hit rects) avoids selecting
   * the enlarged transparent hit-rect, which could resolve to a neighbour note.
   */
  private findNearestNoteId(clientX: number, clientY: number): string | null {
    const container = this.containerRef.current;
    if (!container) return null;
    const glyphs = container.querySelectorAll<SVGElement>('.layout-glyph[data-note-id]');
    let nearestId: string | null = null;
    let nearestDistSq = Infinity;
    for (const el of glyphs) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // invisible
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distSq = (cx - clientX) ** 2 + (cy - clientY) ** 2;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestId = el.dataset.noteId ?? null;
      }
    }
    return nearestId;
  }

  /**
   * Look up the actual start_tick of a note by ID from the notes index.
   * Returns null when notes prop is absent or the ID is not found.
   *
   * This is the counterpart to tickFromTouch's linear interpolation: once we
   * know WHICH note the user tapped (via findNearestNoteId), we return its
   * precise start_tick so scheduling never starts 2-3 notes late.
   */
  private tickFromNoteId(noteId: string): number | null {
    const note = this.props.notes?.find(n => n.id === noteId);
    return note ? note.start_tick : null;
  }

  private tickFromTouch = (clientX: number, clientY: number): number | null => {
    const { layout } = this.props;
    if (!layout) return null;
    const container = this.containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const renderScale = this.state.zoom * BASE_SCALE;
    const layoutX = (clientX - rect.left) / renderScale - LABEL_MARGIN;
    const layoutY = (clientY - rect.top) / renderScale;

    const system = layout.systems.find(
      s => layoutY >= s.bounding_box.y && layoutY < s.bounding_box.y + s.bounding_box.height
    );
    if (!system) return null;

    const { start_tick, end_tick } = system.tick_range;
    const sw = system.bounding_box.width;
    const sx = system.bounding_box.x;
    const clampedX = Math.max(sx, Math.min(sx + sw, layoutX));
    const fraction = sw > 0 ? (clampedX - sx) / sw : 0;
    return Math.floor(start_tick + fraction * (end_tick - start_tick));
  };

  private handleScroll = (): void => {
    // rAF-based throttle: coalesce all scroll events within one frame
    if (this.scrollRafId === 0) {
      this.scrollRafId = requestAnimationFrame(() => {
        this.scrollRafId = 0;
        this.updateViewport();
      });
    }
  };

  /**
   * Update viewport based on page scroll position (T066)
   * Since the container has overflow:visible, scrolling is handled by the
   * browser page scrollbar. We compute the effective "scrollTop" by measuring
   * how far the container's top has scrolled above the viewport.
   * Feature 024 (T027): Skips setState when scroll delta is below threshold
   * to reduce React re-renders during playback auto-scroll.
   */
  private updateViewport(): void {
    const container = this.containerRef.current;
    if (!container || !this.props.layout) {
      return;
    }

    const { zoom } = this.state;
    const renderScale = zoom * BASE_SCALE;

    // Compute effective scroll offset: how many pixels of the container
    // are above the viewport. containerRect.top is negative when scrolled past.
    const scrollEl = this.props.scrollContainerRef?.current;
    const scrollTop = scrollEl
      ? scrollEl.scrollTop
      : Math.max(0, -container.getBoundingClientRect().top);

    // Feature 024 (T027): Skip viewport update if scroll delta is negligible
    if (Math.abs(scrollTop - this.lastAppliedScrollTop) < ScoreViewer.SCROLL_THRESHOLD) {
      return;
    }
    this.lastAppliedScrollTop = scrollTop;

    const clientHeight = scrollEl ? scrollEl.clientHeight : window.innerHeight;

    // Calculate viewport in logical units
    // renderScale affects the visible area: higher scale = smaller viewport
    // Add padding to viewport to show glyphs that extend beyond system bounds
    // Use extra padding to show more systems and avoid sudden pop-in
    const viewportPadding = 150; // Extra space top/bottom for smooth scrolling
    
    // Use window innerHeight as the visible viewport height
    const viewportHeight = (clientHeight / renderScale) + viewportPadding;
    
    // Allow negative Y to show glyphs above first system (e.g., clef at y=-10)
    const viewportY = (scrollTop / renderScale) - (viewportPadding / 2);
    const viewportWidth = this.props.layout.total_width;

    // Expand viewport leftward to show instrument name labels (Feature 023)
    const labelMargin = LABEL_MARGIN;
    this.setState({
      viewport: {
        x: -labelMargin,
        y: viewportY,
        width: viewportWidth + labelMargin,
        height: viewportHeight,
      },
      scrollTop,
    });
  }

  /**
   * Auto-scroll to keep the system containing highlighted notes visible.
   * Uses requestAnimationFrame with ease-out interpolation for smooth scrolling
   * that doesn't jump abruptly between systems.
   * 
   * Checks visibility: even if the same system index, re-scroll if it has
   * drifted out of the visible viewport area.
   */
  /**
   * Build the reverse index noteId → systemIndex from sourceToNoteIdMap.
   * Called lazily before the first scroll lookup and whenever the map changes.
   * O(N) — runs once per score/layout change, not during playback.
   */
  private ensureNoteIdIndex(): void {
    const { sourceToNoteIdMap } = this.props;
    if (!sourceToNoteIdMap || sourceToNoteIdMap === this.cachedSourceMap) return;
    this.cachedSourceMap = sourceToNoteIdMap;
    this.noteIdToSystemIndex.clear();
    for (const [key, noteId] of sourceToNoteIdMap.entries()) {
      const systemIndex = parseInt(key.split('/')[0], 10);
      // Keep the lowest system index for each noteId (first occurrence)
      if (!this.noteIdToSystemIndex.has(noteId)) {
        this.noteIdToSystemIndex.set(noteId, systemIndex);
      }
    }
  }

  private scrollToHighlightedSystem(noteIds?: Set<string>): void {
    const { layout, sourceToNoteIdMap } = this.props;
    const targetNoteIds = noteIds ?? this.props.scrollTargetNoteIds ?? this.props.highlightedNoteIds;
    if (!layout || !targetNoteIds || !sourceToNoteIdMap) return;

    // Ensure reverse index is up-to-date (O(N) once, then cached)
    this.ensureNoteIdIndex();

    // O(k) lookup: find system index for any target note.
    // Strip repeat-expansion suffix (e.g. "-r1") so repeated-section IDs
    // resolve to their original layout position.
    let targetSystemIndex = -1;
    for (const noteId of targetNoteIds) {
      const baseId = noteId.replace(/-r\d+$/, '');
      const systemIndex = this.noteIdToSystemIndex.get(baseId);
      if (systemIndex !== undefined) {
        targetSystemIndex = systemIndex;
        break;
      }
    }

    if (targetSystemIndex < 0) {
      return;
    }

    const targetSystem = layout.systems[targetSystemIndex];
    if (!targetSystem) return;

    const { zoom } = this.state;
    const renderScale = zoom * BASE_SCALE;
    const systemTopPx = targetSystem.bounding_box.y * renderScale;
    const systemHeight = (targetSystem.bounding_box.height || 200) * renderScale;

    const container = this.containerRef.current;
    if (!container) return;

    const scrollEl = this.props.scrollContainerRef?.current;
    const viewportHeight = scrollEl ? scrollEl.clientHeight : window.innerHeight;
    const containerRect = container.getBoundingClientRect();
    const scrollElRect = scrollEl ? scrollEl.getBoundingClientRect() : { top: 0 };
    
    // Calculate where the system currently is relative to the visible area
    const systemViewportTop = (containerRect.top - scrollElRect.top) + systemTopPx;
    const systemViewportBottom = systemViewportTop + systemHeight;

    // Check if system is already well-visible (within 15%-85% of viewport)
    const topThreshold = viewportHeight * 0.15;
    const bottomThreshold = viewportHeight * 0.85;
    
    const isVisible = systemViewportTop >= topThreshold && systemViewportBottom <= bottomThreshold;

    // Skip if same system and still visible
    if (targetSystemIndex === this.lastAutoScrollSystemIndex && isVisible) {
      return;
    }

    // Skip if an animation is already running to the same target system.
    // This prevents the scroll fight: each ~100ms highlight change was
    // cancelling and restarting the 400ms animation, causing constant
    // viewport re-renders and visual jitter.
    if (this.autoScrollAnimationId !== null && targetSystemIndex === this.autoScrollTargetSystemIndex) {
      return;
    }

    this.lastAutoScrollSystemIndex = targetSystemIndex;
    this.autoScrollTargetSystemIndex = targetSystemIndex;

    // Calculate target scroll position: system ~20% from top of the visible area
    if (scrollEl) {
      // Container-scroll path: use scrollEl.scrollTop directly
      const currentScroll = scrollEl.scrollTop;
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      const targetScroll = Math.min(Math.max(0, systemTopPx - viewportHeight * 0.2), maxScroll);
      const distance = targetScroll - currentScroll;
      if (Math.abs(distance) < 2) return;

      // Cancel any in-progress animation
      if (this.autoScrollAnimationId !== null) {
        cancelAnimationFrame(this.autoScrollAnimationId);
        this.autoScrollAnimationId = null;
      }

      const duration = 400;
      const startTime = performance.now();
      const animateScroll = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        scrollEl.scrollTop = currentScroll + distance * eased;
        if (progress < 1) {
          this.autoScrollAnimationId = requestAnimationFrame(animateScroll);
        } else {
          this.autoScrollAnimationId = null;
          this.autoScrollTargetSystemIndex = -1;
        }
      };
      this.autoScrollAnimationId = requestAnimationFrame(animateScroll);
    } else {
      // Page-scroll path: original window-based logic
      const currentPageScroll = window.scrollY || document.documentElement.scrollTop;
      const containerTopInPage = containerRect.top + currentPageScroll;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetScroll = Math.min(
        Math.max(0, containerTopInPage + systemTopPx - viewportHeight * 0.2),
        maxScroll
      );

      if (this.autoScrollAnimationId !== null) {
        cancelAnimationFrame(this.autoScrollAnimationId);
        this.autoScrollAnimationId = null;
      }

      const startScroll = window.scrollY;
      const distance = targetScroll - startScroll;
      if (Math.abs(distance) < 2) return;

      const duration = 400;
      const startTime = performance.now();
      const animateScroll = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startScroll + distance * eased);
        if (progress < 1) {
          this.autoScrollAnimationId = requestAnimationFrame(animateScroll);
        } else {
          this.autoScrollAnimationId = null;
          this.autoScrollTargetSystemIndex = -1;
        }
      };
      this.autoScrollAnimationId = requestAnimationFrame(animateScroll);
    }
  }

  /**
   * Render ScoreViewer UI
   */
  render() {
    const { layout } = this.props;
    const { viewport, zoom, config, scrollTop } = this.state;

    if (!layout) {
      return (
        <div style={styles.container}>
          <div style={styles.message}>No score loaded</div>
        </div>
      );
    }

    // Calculate scroll container dimensions based on layout and renderScale
    // Include label margin in width so SVG viewBox and element aspect ratios match
    const labelMargin = LABEL_MARGIN; // Must match value in updateViewport
    const renderScale = zoom * BASE_SCALE;
    const totalHeight = layout.total_height * renderScale;
    const totalWidth = (layout.total_width + labelMargin) * renderScale;

    return (
      <div ref={this.wrapperRef} style={styles.wrapper}>
        {/* Feature 027 (T028): Removed zoom controls (handleZoomIn/Out/Reset).
            Zoom handled by pinch gesture / browser native zoom on tablets. */}

        {/* Scroll Container (T066) */}
        <div
          ref={this.containerRef}
          onClick={this.handleContainerClick}
          onMouseDown={this.handleMouseDown}
          onMouseUp={this.handleMouseUp}
          onMouseMove={this.handleMouseMove}
          onMouseLeave={this.handleMouseLeave}
          className="score-scroll-container"
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={this.handleTouchStart}
          onTouchEnd={this.handleTouchEnd}
          onTouchCancel={this.handleTouchCancel}
          onTouchMove={this.handleTouchMove}
          style={{
            ...styles.container,
            backgroundColor: config.backgroundColor,
            cursor: 'default',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <div style={{ 
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: 'relative',
            overflow: 'hidden', // Clip SVG so it cannot extend beyond totalHeight (prevents extra scroll space)
          }}>
            {/* SVG container positioned at scroll position (not viewport.y which includes padding) */}
            <div style={{
              position: 'absolute',
              top: `${scrollTop}px`,
              left: 0,
              width: `${totalWidth}px`,
              height: `${viewport.height * renderScale}px`,
              pointerEvents: 'none',
            }}>
              <LayoutRenderer 
                layout={layout} 
                config={config} 
                viewport={viewport}
                highlightedNoteIds={this.props.highlightedNoteIds}
                sourceToNoteIdMap={this.props.sourceToNoteIdMap}
                onNoteClick={this.props.onNoteClick}
                selectedNoteId={this.props.selectedNoteId}
                tickSourceRef={this.props.tickSourceRef}
                notes={this.props.notes}
                rawNotes={this.props.rawNotes}
                pinnedNoteIds={this.props.pinnedNoteIds}
                loopRegion={this.props.loopRegion}
                hideMeasureNumbers={this.props.hideMeasureNumbers}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Inline styles for ScoreViewer
 */
const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    // minHeight rather than height so the wrapper grows to the full score height
    // when embedded in an overflow:auto container (plugin mode). With height:100%
    // the wrapper is capped at the container height, the inner totalHeight div
    // overflows but never contributes to the scroll container's scrollHeight,
    // so the container appears un-scrollable. minHeight:100% means the wrapper
    // is at least as tall as the container but expands to full score height.
    minHeight: '100%',
    width: '100%',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#F5F5F5',
    borderBottom: '1px solid #DDDDDD',
  },
  button: {
    padding: '6px 12px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    border: '1px solid #CCCCCC',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    color: '#000000',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  zoomLabel: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    minWidth: '50px',
    textAlign: 'center' as const,
    color: '#000000',
  },
  container: {
    // No flex: 1 here — let content height (totalHeight px child) determine size.
    // flex:1 was using the flex-allocated height (= viewport height) and the
    // totalHeight child overflowed visually via overflow:visible, which works
    // for page-scroll (documentElement tracks overflow) but NOT for an embedded
    // overflow:auto container (scrollHeight = clientHeight → no scroll).
    // Without flex, containerRef grows to totalHeight, wrapperRef follows,
    // and the scroll container's scrollHeight = totalHeight → scrolling works.
    overflow: 'visible' as const, // Use global browser scrollbar for both axes
    position: 'relative' as const,
  },
  message: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '18px',
    color: '#999999',
  },
};
