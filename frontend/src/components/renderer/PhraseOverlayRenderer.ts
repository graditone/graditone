/**
 * PhraseOverlayRenderer
 * Feature 062 — Score Phrase Detection
 *
 * Renders semi-transparent alternating color bands on each visible system
 * to visualize detected musical phrases. Follows the LoopOverlayRenderer
 * pattern: imperative SVG DOM manipulation, inserted into system groups.
 */

import type { GlobalLayout, System } from '../../wasm/layout';
import type { Viewport } from '../../types/Viewport';
import type { PhraseRegion } from '../../types/score';
import { createSVGElement } from '../../utils/svgHelpers';
import { getVisibleSystems } from '../../utils/viewportUtils';
import { createSourceKey } from '../../services/highlight/sourceMapping';

/** Two alternating colors for adjacent phrases. Opacity controlled via fill-opacity attr. */
const PHRASE_COLOR_A = 'rgb(66, 133, 244)';   // blue
const PHRASE_COLOR_B = 'rgb(251, 188, 4)';     // amber

export interface PhraseOverlayOptions {
  /** Phrase regions from the score */
  phrases: readonly PhraseRegion[];
  /** Index of currently selected phrase (null = none) */
  selectedPhraseIndex?: number | null;
  /** Callback when a phrase band is clicked/tapped */
  onPhraseClick?: (phraseIndex: number) => void;
  /** Raw notes for tick→x glyph mapping (same as LoopOverlayRenderer) */
  rawNotes?: ReadonlyArray<{ id: string; start_tick: number; duration_ticks: number }>;
  /** Map from SourceReference keys to Note IDs */
  sourceToNoteIdMap?: Map<string, string>;
}

export class PhraseOverlayRenderer {
  /**
   * Insert phrase overlay rects into visible system groups.
   * Must be called after pipeline.renderAll() so system groups exist in the DOM.
   */
  renderOverlays(
    svg: SVGSVGElement,
    layout: GlobalLayout,
    viewport: Viewport,
    options: PhraseOverlayOptions,
  ): void {
    const { phrases, selectedPhraseIndex, onPhraseClick } = options;
    if (phrases.length === 0) return;

    const visibleSystems = getVisibleSystems(layout.systems, viewport);

    for (const system of visibleSystems) {
      const systemGroup = svg.querySelector(`[data-system-index="${system.index}"]`);
      if (!systemGroup) continue;

      // Build tick→x map from actual glyph positions (same as LoopOverlayRenderer)
      const tickToX = new Map<number, number>();
      if (options.sourceToNoteIdMap && options.rawNotes && options.rawNotes.length > 0) {
        const noteIdToTick = new Map<string, number>();
        for (const note of options.rawNotes) noteIdToTick.set(note.id, note.start_tick);
        for (const staffGroup of system.staff_groups) {
          for (const staff of staffGroup.staves) {
            for (const run of staff.glyph_runs) {
              for (const glyph of run.glyphs) {
                if (!glyph.source_reference) continue;
                const key = createSourceKey({ system_index: system.index, ...glyph.source_reference });
                const noteId = options.sourceToNoteIdMap.get(key);
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
      const sortedTicks = [...tickToX.keys()].sort((a, b) => a - b);

      // Collect all phrase elements for this system, then insert in reverse
      // so that phrase 0 elements end up first in DOM order (behind glyphs).
      const allElements: SVGElement[] = [];
      for (let phraseIdx = 0; phraseIdx < phrases.length; phraseIdx++) {
        const phrase = phrases[phraseIdx];
        const isSelected = selectedPhraseIndex === phraseIdx;
        const elements = this.renderPhraseForSystem(system, phrase, phraseIdx, layout, isSelected, onPhraseClick, tickToX, sortedTicks);
        allElements.push(...elements);
      }

      // Insert in reverse so first phrase ends up closest to firstChild
      for (let i = allElements.length - 1; i >= 0; i--) {
        systemGroup.insertBefore(allElements[i], systemGroup.firstChild);
      }
    }
  }

  /**
   * Render a phrase band (rect + optional label) for a single system.
   *
   * Returns empty array if the phrase doesn't overlap this system.
   * Label is only rendered in the system where the phrase starts.
   */
  private renderPhraseForSystem(
    system: System,
    phrase: PhraseRegion,
    phraseIdx: number,
    _layout: GlobalLayout,
    isSelected: boolean,
    onPhraseClick: ((phraseIndex: number) => void) | undefined,
    tickToX: Map<number, number>,
    sortedTicks: number[],
  ): SVGElement[] {
    const sysStart = system.tick_range.start_tick;
    const sysEnd = system.tick_range.end_tick;

    // No overlap between phrase and this system
    if (phrase.end_tick <= sysStart || phrase.start_tick >= sysEnd) return [];

    // Resolve coordinate edges from staff lines
    const firstStaff = system.staff_groups[0]?.staves[0];
    const lastGroup = system.staff_groups[system.staff_groups.length - 1];
    const lastStaff = lastGroup?.staves[lastGroup.staves.length - 1];

    const topY = firstStaff?.staff_lines[0]?.y_position ?? system.bounding_box.y;
    const bottomY = lastStaff?.staff_lines[4]?.y_position ?? (system.bounding_box.y + system.bounding_box.height);
    const leftEdge = firstStaff?.staff_lines[0]?.start_x ?? system.bounding_box.x;
    const rightEdge = firstStaff?.staff_lines[0]?.end_x ?? (system.bounding_box.x + system.bounding_box.width);

    // Determine x-range using actual glyph positions when available,
    // falling back to linear interpolation.
    const sysTickSpan = sysEnd - sysStart;
    const sysXSpan = rightEdge - leftEdge;

    let xStart: number;
    if (phrase.start_tick <= sysStart) {
      xStart = leftEdge;
    } else if (sortedTicks.length > 0) {
      const match = sortedTicks.find(t => t >= phrase.start_tick);
      xStart = match !== undefined ? tickToX.get(match)! : leftEdge;
    } else {
      const ratio = (phrase.start_tick - sysStart) / sysTickSpan;
      xStart = leftEdge + ratio * sysXSpan;
    }

    let xEnd: number;
    if (phrase.end_tick >= sysEnd) {
      xEnd = rightEdge;
    } else if (sortedTicks.length > 0) {
      const match = sortedTicks.find(t => t >= phrase.end_tick);
      xEnd = match !== undefined ? tickToX.get(match)! : rightEdge;
    } else {
      const ratio = (phrase.end_tick - sysStart) / sysTickSpan;
      xEnd = leftEdge + ratio * sysXSpan;
    }

    if (xEnd <= xStart) return [];

    const fill = phraseIdx % 2 === 0 ? PHRASE_COLOR_A : PHRASE_COLOR_B;
    const elements: SVGElement[] = [];

    // Rect
    const rect = createSVGElement('rect');
    rect.setAttribute('class', 'phrase-region');
    rect.setAttribute('x', xStart.toString());
    rect.setAttribute('y', topY.toString());
    rect.setAttribute('width', (xEnd - xStart).toString());
    rect.setAttribute('height', (bottomY - topY).toString());
    rect.setAttribute('fill', fill);
    rect.setAttribute('data-phrase-index', String(phraseIdx));

    // Selection visual distinction
    if (isSelected) {
      rect.setAttribute('fill-opacity', '0.35');
      rect.setAttribute('stroke', phraseIdx % 2 === 0 ? 'rgba(66, 133, 244, 0.6)' : 'rgba(251, 188, 4, 0.6)');
      rect.setAttribute('stroke-width', '2');
    } else {
      rect.setAttribute('fill-opacity', '0.12');
    }

    // Click handler for phrase selection
    if (onPhraseClick) {
      rect.setAttribute('pointer-events', 'auto');
      rect.setAttribute('cursor', 'pointer');
      rect.addEventListener('click', () => onPhraseClick(phraseIdx));
    } else {
      rect.setAttribute('pointer-events', 'none');
    }

    elements.push(rect);

    // Label — only in the system where the phrase actually starts
    const phraseStartsInThisSystem = phrase.start_tick >= sysStart && phrase.start_tick < sysEnd;
    // Also label in the first system if the phrase starts before it (e.g., phrase starts at tick 0)
    const isFirstOverlap = phrase.start_tick <= sysStart &&
      (system.index === 0 || phrase.start_tick > (system.index > 0 ? sysStart - 1 : -1));

    if (phraseStartsInThisSystem || (isFirstOverlap && system.index === 0)) {
      const label = createSVGElement('text');
      label.setAttribute('class', 'phrase-label');
      label.setAttribute('x', xStart.toString());
      label.setAttribute('y', (topY - 5).toString());
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#666');
      label.setAttribute('pointer-events', 'none');
      label.textContent = `Phrase ${phraseIdx + 1}`;
      elements.push(label);
    }

    return elements;
  }
}
