/**
 * LoopOverlayRenderer
 * Feature 058 - Extracted from LayoutRenderer.tsx
 *
 * Renders semi-transparent loop-region overlay rects on each visible system
 * to visualize the active practice loop region. Uses barline x-positions from
 * the layout engine to place boundaries precisely at measure edges.
 */

import type { GlobalLayout, System } from '../../wasm/layout';
import type { Viewport } from '../../types/Viewport';
import { createSVGElement } from '../../utils/svgHelpers';
import { getVisibleSystems } from '../../utils/viewportUtils';

export interface LoopOverlayOptions {
  loopRegion: { startTick: number; endTick: number };
  rawNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  expandedNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  sourceToNoteIdMap?: Map<string, string>;
}

export class LoopOverlayRenderer {
  /**
   * Insert loop overlay rects into visible system groups.
   * Must be called after pipeline.renderAll() so system groups exist in the DOM.
   */
  renderOverlays(
    svg: SVGSVGElement,
    layout: GlobalLayout,
    viewport: Viewport,
    options: LoopOverlayOptions,
  ): void {
    const visibleSystems = getVisibleSystems(layout.systems, viewport);
    for (const system of visibleSystems) {
      const overlay = this.renderOverlay(system, options);
      if (overlay) {
        const systemGroup = svg.querySelector(`[data-system-index="${system.index}"]`);
        if (systemGroup) {
          systemGroup.insertBefore(overlay, systemGroup.firstChild);
        }
      }
    }
  }

  /**
   * Renders a semi-transparent loop-region overlay rect for a single system.
   *
   * Uses barline x-positions from the layout engine to place boundaries
   * precisely at measure edges, matching PhraseOverlayRenderer's approach.
   */
  private renderOverlay(system: System, options: LoopOverlayOptions): SVGRectElement | null {
    const { loopRegion } = options;

    // loopRegion ticks are in raw (layout) tick space — either from
    // measureRangeToTicks (task-initiated) or from note pins (user-initiated,
    // task-locked sessions prevent this). No tick-space conversion needed
    // since barline positioning operates in the same raw tick space as systems.
    const { startTick, endTick } = loopRegion;

    const sysStart = system.tick_range.start_tick;
    const sysEnd   = system.tick_range.end_tick;

    // No overlap between loop and this system
    if (endTick <= sysStart || startTick >= sysEnd) return null;

    // Resolve coordinate edges from staff lines
    const firstStaff = system.staff_groups[0]?.staves[0];
    const lastGroup  = system.staff_groups[system.staff_groups.length - 1];
    const lastStaff  = lastGroup?.staves[lastGroup.staves.length - 1];

    const topY      = firstStaff?.staff_lines[0]?.y_position ?? system.bounding_box.y;
    const bottomY   = lastStaff?.staff_lines[4]?.y_position  ?? (system.bounding_box.y + system.bounding_box.height);
    const leftEdge  = firstStaff?.staff_lines[0]?.start_x    ?? system.bounding_box.x;
    const rightEdge = firstStaff?.staff_lines[0]?.end_x      ?? (system.bounding_box.x + system.bounding_box.width);

    // Build barline x-positions for tick→x mapping
    const barlineXs = this.collectBarlineXPositions(system);

    const xStart = this.tickToX(startTick, sysStart, sysEnd, leftEdge, rightEdge, barlineXs);
    const xEnd   = this.tickToX(endTick, sysStart, sysEnd, leftEdge, rightEdge, barlineXs);

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
   * Collect barline x-positions from the first staff, sorted ascending.
   */
  private collectBarlineXPositions(system: System): number[] {
    const staff = system.staff_groups[0]?.staves[0];
    if (!staff?.bar_lines?.length) return [];

    const xs: number[] = [];
    for (const bl of staff.bar_lines) {
      if (bl.segments.length > 0) {
        xs.push(bl.segments[0].x_position);
      }
    }
    xs.sort((a, b) => a - b);
    return xs;
  }

  /**
   * Interpolate a tick position to an x coordinate using barline positions.
   * Each barline marks the right edge of a measure.
   */
  private tickToX(
    tick: number,
    sysStart: number,
    sysEnd: number,
    leftEdge: number,
    rightEdge: number,
    barlineXs: number[],
  ): number {
    if (tick <= sysStart) return leftEdge;
    if (tick >= sysEnd) return rightEdge;

    const numMeasures = barlineXs.length;
    if (numMeasures === 0) {
      const frac = (tick - sysStart) / (sysEnd - sysStart);
      return leftEdge + frac * (rightEdge - leftEdge);
    }
    const ticksPerMeasure = (sysEnd - sysStart) / numMeasures;

    const measureOffset = (tick - sysStart) / ticksPerMeasure;
    const measureIdx = Math.min(Math.floor(measureOffset), numMeasures - 1);
    const frac = measureOffset - measureIdx;

    const xBreaks = [leftEdge, ...barlineXs];
    const x0 = xBreaks[measureIdx] ?? leftEdge;
    const x1 = xBreaks[measureIdx + 1] ?? rightEdge;

    return x0 + frac * (x1 - x0);
  }
}
