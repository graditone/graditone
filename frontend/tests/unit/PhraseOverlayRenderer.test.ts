/**
 * Unit tests for PhraseOverlayRenderer
 * Feature 062 — Score Phrase Detection (US1)
 * Tests T028 + T029: rect count and color alternation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PhraseOverlayRenderer } from '../../src/components/renderer/PhraseOverlayRenderer';
import type { GlobalLayout, System } from '../../src/wasm/layout';
import type { Viewport } from '../../src/types/Viewport';
import type { PhraseRegion } from '../../src/types/score';

// ---------------------------------------------------------------------------
// Helpers — minimal layout fixtures
// ---------------------------------------------------------------------------

/** Build a minimal System with tick_range and bounding_box. */
function makeSystem(index: number, startTick: number, endTick: number, y: number): System {
  return {
    index,
    bounding_box: { x: 0, y, width: 1200, height: 200 },
    staff_groups: [{
      staves: [{
        staff_lines: [
          { y_position: y + 10, start_x: 50, end_x: 1150 },
          { y_position: y + 30, start_x: 50, end_x: 1150 },
          { y_position: y + 50, start_x: 50, end_x: 1150 },
          { y_position: y + 70, start_x: 50, end_x: 1150 },
          { y_position: y + 90, start_x: 50, end_x: 1150 },
        ],
        glyph_runs: [],
      }],
    }],
    tick_range: { start_tick: startTick, end_tick: endTick },
  } as unknown as System;
}

function makeLayout(systems: System[]): GlobalLayout {
  return {
    systems,
    total_width: 1200,
    total_height: systems.length * 400,
    units_per_space: 20,
  };
}

function makeViewport(height: number): Viewport {
  return { x: 0, y: 0, width: 1200, height };
}

function makePhrase(index: number, startMeasure: number, endMeasure: number, startTick: number, endTick: number): PhraseRegion {
  return {
    instrument_index: 0,
    start_measure: startMeasure,
    end_measure: endMeasure,
    start_tick: startTick,
    end_tick: endTick,
  };
}

/** Create a minimal SVG element with system group children */
function createMockSVG(systems: System[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const sys of systems) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-system-index', String(sys.index));
    svg.appendChild(g);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhraseOverlayRenderer', () => {
  let renderer: PhraseOverlayRenderer;

  beforeEach(() => {
    renderer = new PhraseOverlayRenderer();
  });

  // T028: renders correct number of colored rectangles for 3 phrases across 2 systems
  describe('T028 — rect count for phrases across systems', () => {
    it('renders one rect per phrase-system overlap', () => {
      // 2 systems: system0 covers ticks 0-3840, system1 covers 3840-7680
      const systems = [
        makeSystem(0, 0, 3840, 0),
        makeSystem(1, 3840, 7680, 400),
      ];
      const layout = makeLayout(systems);
      const viewport = makeViewport(1600);
      const svg = createMockSVG(systems);

      // 3 phrases:
      //   Phrase 0: measures 0-1 (ticks 0–1920) → system 0 only
      //   Phrase 1: measures 2-5 (ticks 1920–5760) → system 0 AND system 1
      //   Phrase 2: measures 6-7 (ticks 5760–7680) → system 1 only
      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 1, 0, 1920),
        makePhrase(0, 2, 5, 1920, 5760),
        makePhrase(0, 6, 7, 5760, 7680),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases });

      const rects = svg.querySelectorAll('rect.phrase-region');
      // Phrase 0 → 1 rect (sys0), Phrase 1 → 2 rects (sys0+sys1), Phrase 2 → 1 rect (sys1)
      expect(rects.length).toBe(4);
    });

    it('renders nothing when phrases array is empty', () => {
      const systems = [makeSystem(0, 0, 3840, 0)];
      const layout = makeLayout(systems);
      const viewport = makeViewport(800);
      const svg = createMockSVG(systems);

      renderer.renderOverlays(svg, layout, viewport, { phrases: [] });

      const rects = svg.querySelectorAll('rect.phrase-region');
      expect(rects.length).toBe(0);
    });

    it('renders rects only in overlapping systems', () => {
      const systems = [
        makeSystem(0, 0, 1920, 0),
        makeSystem(1, 1920, 3840, 400),
        makeSystem(2, 3840, 5760, 800),
      ];
      const layout = makeLayout(systems);
      const viewport = makeViewport(2400);
      const svg = createMockSVG(systems);

      // Single phrase covering only system 1
      const phrases: PhraseRegion[] = [
        makePhrase(0, 2, 3, 1920, 3840),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases });

      const rects = svg.querySelectorAll('rect.phrase-region');
      expect(rects.length).toBe(1);

      // Rect should be in system 1's group
      const sys1Group = svg.querySelector('[data-system-index="1"]');
      expect(sys1Group?.querySelector('rect.phrase-region')).toBeTruthy();
      // System 0 and 2 should have no rects
      const sys0Group = svg.querySelector('[data-system-index="0"]');
      expect(sys0Group?.querySelector('rect.phrase-region')).toBeNull();
    });
  });

  // T029: alternates between 2 colors for adjacent phrases
  describe('T029 — color alternation', () => {
    it('assigns alternating colors to adjacent phrases', () => {
      const systems = [makeSystem(0, 0, 7680, 0)];
      const layout = makeLayout(systems);
      const viewport = makeViewport(800);
      const svg = createMockSVG(systems);

      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 1, 0, 1920),
        makePhrase(0, 2, 3, 1920, 3840),
        makePhrase(0, 4, 5, 3840, 5760),
        makePhrase(0, 6, 7, 5760, 7680),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases });

      const rects = svg.querySelectorAll('rect.phrase-region');
      expect(rects.length).toBe(4);

      const fills = Array.from(rects).map(r => r.getAttribute('fill'));
      // Even-indexed phrases get color A, odd-indexed get color B
      expect(fills[0]).toBe(fills[2]); // phrase 0 and 2 same color
      expect(fills[1]).toBe(fills[3]); // phrase 1 and 3 same color
      expect(fills[0]).not.toBe(fills[1]); // adjacent phrases differ
    });

    it('includes phrase labels at each phrase start', () => {
      const systems = [makeSystem(0, 0, 3840, 0)];
      const layout = makeLayout(systems);
      const viewport = makeViewport(800);
      const svg = createMockSVG(systems);

      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 1, 0, 1920),
        makePhrase(0, 2, 3, 1920, 3840),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases });

      const texts = svg.querySelectorAll('text.phrase-label');
      expect(texts.length).toBe(2);
      expect(texts[0].textContent).toBe('Phrase 1');
      expect(texts[1].textContent).toBe('Phrase 2');
    });

    it('renders label only in the first system of a multi-system phrase', () => {
      const systems = [
        makeSystem(0, 0, 3840, 0),
        makeSystem(1, 3840, 7680, 400),
      ];
      const layout = makeLayout(systems);
      const viewport = makeViewport(1600);
      const svg = createMockSVG(systems);

      // Phrase spans both systems
      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 7, 0, 7680),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases });

      const texts = svg.querySelectorAll('text.phrase-label');
      // Label only in system 0 (where the phrase starts)
      expect(texts.length).toBe(1);
      expect(texts[0].textContent).toBe('Phrase 1');

      const sys0Label = svg.querySelector('[data-system-index="0"] text.phrase-label');
      expect(sys0Label).toBeTruthy();
      const sys1Label = svg.querySelector('[data-system-index="1"] text.phrase-label');
      expect(sys1Label).toBeNull();
    });
  });

  // T039: selected phrase has distinct visual style
  describe('T039 — selected phrase visual distinction', () => {
    it('selected phrase has higher opacity than unselected', () => {
      const systems = [makeSystem(0, 0, 3840, 0)];
      const layout = makeLayout(systems);
      const viewport = makeViewport(800);
      const svg = createMockSVG(systems);

      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 1, 0, 1920),
        makePhrase(0, 2, 3, 1920, 3840),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases, selectedPhraseIndex: 1 });

      const rects = svg.querySelectorAll('rect.phrase-region');
      expect(rects.length).toBe(2);

      // Selected phrase (index 1) should have higher opacity
      const rect0Opacity = rects[0].getAttribute('fill-opacity');
      const rect1Opacity = rects[1].getAttribute('fill-opacity');
      expect(Number(rect1Opacity)).toBeGreaterThan(Number(rect0Opacity));
    });

    it('selected phrase has a visible border', () => {
      const systems = [makeSystem(0, 0, 3840, 0)];
      const layout = makeLayout(systems);
      const viewport = makeViewport(800);
      const svg = createMockSVG(systems);

      const phrases: PhraseRegion[] = [
        makePhrase(0, 0, 1, 0, 1920),
        makePhrase(0, 2, 3, 1920, 3840),
      ];

      renderer.renderOverlays(svg, layout, viewport, { phrases, selectedPhraseIndex: 0 });

      const rects = svg.querySelectorAll('rect.phrase-region');
      // Selected phrase (index 0) has a stroke
      expect(rects[0].getAttribute('stroke')).toBeTruthy();
      // Unselected phrase has no stroke
      expect(rects[1].getAttribute('stroke')).toBeNull();
    });
  });
});
