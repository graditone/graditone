/**
 * LoopOverlayRenderer
 * Feature 058 - Extracted from LayoutRenderer.tsx
 *
 * Renders semi-transparent loop-region overlay rects on each visible system
 * to visualize the active practice loop region.
 */

import type { GlobalLayout, System } from '../../wasm/layout';
import type { Viewport } from '../../types/Viewport';
import { createSVGElement } from '../../utils/svgHelpers';
import { getVisibleSystems } from '../../utils/viewportUtils';
import { createSourceKey } from '../../services/highlight/sourceMapping';

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
   * Strategy:
   * 1. Skip if the loop region doesn't overlap this system's tick_range.
   * 2. Build a tick → x map by scanning glyphs via sourceToNoteIdMap + notes.
   * 3. x_start = x of first note >= loopStartTick (or staff left edge).
   * 4. x_end   = x of first note >= loopEndTick   (or staff right edge).
   */
  private renderOverlay(system: System, options: LoopOverlayOptions): SVGRectElement | null {
    const { loopRegion, rawNotes, expandedNotes, sourceToNoteIdMap } = options;

    // Convert expanded→raw ticks via the note arrays
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

    // Build tick → leftmost-x map from all glyphs in this system
    const tickToX = new Map<number, number>();

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

    // Resolve coordinate edges from staff lines
    const firstStaff = system.staff_groups[0]?.staves[0];
    const lastGroup  = system.staff_groups[system.staff_groups.length - 1];
    const lastStaff  = lastGroup?.staves[lastGroup.staves.length - 1];

    const topY      = firstStaff?.staff_lines[0]?.y_position ?? system.bounding_box.y;
    const bottomY   = lastStaff?.staff_lines[4]?.y_position  ?? (system.bounding_box.y + system.bounding_box.height);
    const leftEdge  = firstStaff?.staff_lines[0]?.start_x    ?? system.bounding_box.x;
    const rightEdge = firstStaff?.staff_lines[0]?.end_x      ?? (system.bounding_box.x + system.bounding_box.width);

    const sortedTicks = [...tickToX.keys()].sort((a, b) => a - b);

    let xStart: number;
    if (startTick <= sysStart) {
      xStart = leftEdge;
    } else {
      const match = sortedTicks.find(t => t >= startTick);
      xStart = match !== undefined ? tickToX.get(match)! : leftEdge;
    }

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
}
