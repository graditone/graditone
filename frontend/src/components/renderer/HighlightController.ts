/**
 * HighlightController
 * Feature 058 - Extracted from LayoutRenderer.tsx
 *
 * Manages the rAF-driven highlight loop, CSS class toggling,
 * and highlight state (pinned, error, expected, playing).
 * Implements the Tier-2 rendering model: fast DOM class updates
 * that bypass React re-renders.
 */

import { HighlightIndex } from '../../services/highlight/HighlightIndex';
import { computeHighlightPatch } from '../../services/highlight/computeHighlightPatch';
import { FrameBudgetMonitor } from '../../services/highlight/FrameBudgetMonitor';
import type { ITickSource } from '../../types/playback';

export class HighlightController {
  private svgElement: SVGSVGElement | null = null;
  private highlightIndex: HighlightIndex | null = null;
  private frameBudgetMonitor: FrameBudgetMonitor;

  private rafId = 0;
  private lastFrameTime = 0;
  private frameInterval: number;
  /** Feature 053: deferred reapplyHighlights rAF handle for system-change race fix */
  private deferredReapplyId = 0;

  private prevHighlightedIds = new Set<string>();
  private prevPinnedIds = new Set<string>();
  private prevErrorIds = new Set<string>();
  private prevExpectedIds = new Set<string>();

  // Live references updated by host component
  private tickSourceRef?: { current: ITickSource };
  private highlightedNoteIds?: Set<string>;

  constructor(frameInterval: number, frameBudgetMs: number) {
    this.frameInterval = frameInterval;
    this.frameBudgetMonitor = new FrameBudgetMonitor(frameBudgetMs);
  }

  init(svg: SVGSVGElement): void {
    this.svgElement = svg;
  }

  buildIndex(notes: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>): void {
    if (!this.highlightIndex) this.highlightIndex = new HighlightIndex();
    this.highlightIndex.build(notes);
  }

  get noteCount(): number {
    return this.highlightIndex?.noteCount ?? 0;
  }

  clearIndex(): void {
    this.highlightIndex?.clear();
  }

  /**
   * Start the rAF self-scheduling highlight loop.
   * Runs independently of React rendering at device-adaptive frame rate.
   */
  startLoop(tickSourceRef?: { current: ITickSource }): void {
    this.tickSourceRef = tickSourceRef;

    const loop = (timestamp: number): void => {
      this.rafId = requestAnimationFrame(loop);

      // Frame-skip: only process if enough time has passed
      if (timestamp - this.lastFrameTime < this.frameInterval) return;
      this.lastFrameTime = timestamp;

      // Check frame budget — skip visual updates if degraded
      if (this.frameBudgetMonitor.shouldSkipFrame()) return;

      const startTime = this.frameBudgetMonitor.startFrame();
      this.updateHighlights();
      this.frameBudgetMonitor.endFrame(startTime);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  setHighlightedNoteIds(ids?: Set<string>): void {
    this.highlightedNoteIds = ids;
  }

  /**
   * Apply a scale(factor) SVG transform centred on the glyph's (x, y) position.
   * Only applied to <text> elements (noteheads/accidentals).
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

  /**
   * Diff-based CSS class toggling for playback highlights.
   * Reads current tick from tickSource, computes playing notes via
   * HighlightIndex, diffs against previous frame, toggles CSS classes.
   */
  private updateHighlights(): void {
    const tickSource = this.tickSourceRef?.current;
    const highlightedNoteIds = this.highlightedNoteIds;

    let currentIds: string[];
    if (this.highlightIndex && tickSource && tickSource.status === 'playing') {
      currentIds = this.highlightIndex.findPlayingNoteIds(tickSource.currentTick);
    } else if (highlightedNoteIds && highlightedNoteIds.size > 0) {
      currentIds = Array.from(highlightedNoteIds);
    } else {
      if (this.prevHighlightedIds.size === 0) return;
      currentIds = [];
    }

    const baseIds = [...new Set(currentIds.map(id => id.replace(/-r\d+$/, '')))];

    const patch = computeHighlightPatch(this.prevHighlightedIds, baseIds);
    if (patch.unchanged) return;

    const svg = this.svgElement;
    if (!svg) return;

    for (const id of patch.removed) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.remove('highlighted');
        if (!el.classList.contains('pinned') && !el.classList.contains('error') && !el.classList.contains('expected')) this.applyNoteheadScale(el, 1);
      });
    }
    for (const id of patch.added) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        if (!el.classList.contains('pinned') && !el.classList.contains('error') && !el.classList.contains('expected')) {
          el.classList.add('highlighted');
          this.applyNoteheadScale(el, 1.2);
        }
      });
    }

    this.prevHighlightedIds = new Set(baseIds);
  }

  updatePinned(ids?: Set<string>): void {
    const svg = this.svgElement;
    if (!svg) return;
    const rawPinned = ids ?? new Set<string>();
    const currentPinned = new Set([...rawPinned].map(id => id.replace(/-r\d+$/, '')));

    const currentExpected = this.prevExpectedIds;
    for (const id of this.prevPinnedIds) {
      if (!currentPinned.has(id)) {
        svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
          el.classList.remove('pinned');
          if (currentExpected.has(id)) {
            el.classList.add('expected');
          } else {
            this.applyNoteheadScale(el, 1);
          }
        });
      }
    }
    for (const id of currentPinned) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.add('pinned');
        el.classList.remove('highlighted');
        el.classList.remove('expected');
        this.applyNoteheadScale(el, 1.2);
      });
    }
    this.prevPinnedIds = new Set(currentPinned);
  }

  updateError(ids?: Set<string>): void {
    const svg = this.svgElement;
    if (!svg) return;
    const rawError = ids ?? new Set<string>();
    const currentError = new Set([...rawError].map(id => id.replace(/-r\d+$/, '')));

    for (const id of this.prevErrorIds) {
      if (!currentError.has(id)) {
        svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
          el.classList.remove('error');
          if (!el.classList.contains('pinned') && !el.classList.contains('highlighted')) {
            this.applyNoteheadScale(el, 1);
          }
        });
      }
    }
    for (const id of currentError) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.add('error');
        el.classList.remove('highlighted');
        el.classList.remove('pinned');
        this.applyNoteheadScale(el, 1.2);
      });
    }
    this.prevErrorIds = new Set(currentError);
  }

  updateExpected(ids?: Set<string>): void {
    const svg = this.svgElement;
    if (!svg) return;
    const rawExpected = ids ?? new Set<string>();
    const currentExpected = new Set([...rawExpected].map(id => id.replace(/-r\d+$/, '')));

    for (const id of this.prevExpectedIds) {
      if (!currentExpected.has(id)) {
        svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
          el.classList.remove('expected');
          if (!el.classList.contains('pinned') && !el.classList.contains('highlighted') && !el.classList.contains('error')) {
            this.applyNoteheadScale(el, 1);
          }
        });
      }
    }
    for (const id of currentExpected) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        el.classList.add('expected');
        el.classList.remove('highlighted');
        this.applyNoteheadScale(el, 1.2);
      });
    }
    this.prevExpectedIds = new Set(currentExpected);
  }

  /**
   * Re-apply current highlight state after structural render.
   * Called after renderSVG() rebuilds SVG, since all data-note-id elements
   * were recreated and lost their CSS classes.
   */
  reapplyHighlights(): void {
    if (this.deferredReapplyId) {
      cancelAnimationFrame(this.deferredReapplyId);
      this.deferredReapplyId = 0;
    }

    const svg = this.svgElement;
    if (!svg) {
      this.deferredReapplyId = requestAnimationFrame(() => {
        this.deferredReapplyId = 0;
        this.reapplyHighlights();
      });
      return;
    }

    const tickSource = this.tickSourceRef?.current;
    const highlightedNoteIds = this.highlightedNoteIds;
    let currentIds: string[];

    if (this.highlightIndex && tickSource && tickSource.status === 'playing') {
      currentIds = this.highlightIndex.findPlayingNoteIds(tickSource.currentTick);
    } else if (highlightedNoteIds && highlightedNoteIds.size > 0) {
      currentIds = Array.from(highlightedNoteIds);
    } else {
      currentIds = [];
    }

    const baseIds = [...new Set(currentIds.map(id => id.replace(/-r\d+$/, '')))];
    this.prevHighlightedIds = new Set(baseIds);

    for (const id of baseIds) {
      svg.querySelectorAll(`.layout-glyph[data-note-id="${id}"]`).forEach(el => {
        if (!el.classList.contains('pinned') && !el.classList.contains('error') && !el.classList.contains('expected')) {
          el.classList.add('highlighted');
          this.applyNoteheadScale(el, 1.2);
        }
      });
    }

    this.updatePinned(this.prevPinnedIds);
    this.updateError(this.prevErrorIds);
    this.updateExpected(this.prevExpectedIds);

    if (this.deferredReapplyId) cancelAnimationFrame(this.deferredReapplyId);
    this.deferredReapplyId = requestAnimationFrame(() => {
      this.deferredReapplyId = 0;
      this.updatePinned(this.prevPinnedIds);
      this.updateError(this.prevErrorIds);
      this.updateExpected(this.prevExpectedIds);
    });
  }

  dispose(): void {
    this.stopLoop();
    if (this.deferredReapplyId) cancelAnimationFrame(this.deferredReapplyId);
    this.highlightIndex?.clear();
    this.frameBudgetMonitor.reset();
    this.svgElement = null;
  }
}
