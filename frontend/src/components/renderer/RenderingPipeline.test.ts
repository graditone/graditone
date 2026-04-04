/**
 * Tests for RenderingPipeline — dynamics rendering (Feature 072)
 *
 * T012: DynamicGlyph with valid codepoint renders SVG <text> with Bravura font
 * T018: Crescendo HairpinLayout renders two SVG <line> elements
 * T019: Diminuendo HairpinLayout renders two SVG <line> elements
 * T024: DynamicGlyph with empty codepoint renders italic fallback
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RenderingPipeline } from './RenderingPipeline';
import type { GlobalLayout, Staff, System, StaffGroup } from '../../wasm/layout';
import type { RenderConfig } from '../../types/RenderConfig';
import type { Viewport } from '../../types/Viewport';

// --- Helpers ---

const config: RenderConfig = {
  backgroundColor: '#ffffff',
  staffLineColor: '#000000',
  glyphColor: '#000000',
  fontFamily: 'Bravura',
};

const viewport: Viewport = {
  x: 0,
  y: 0,
  width: 2500,
  height: 1000,
};

function makeStaffLine(y: number) {
  return { y_position: y, start_x: 0, end_x: 2400 };
}

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    staff_lines: [
      makeStaffLine(80),
      makeStaffLine(100),
      makeStaffLine(120),
      makeStaffLine(140),
      makeStaffLine(160),
    ],
    glyph_runs: [],
    structural_glyphs: [],
    bar_lines: [],
    ledger_lines: [],
    ...overrides,
  };
}

function makeLayout(staff: Staff): GlobalLayout {
  const staffGroup: StaffGroup = {
    instrument_id: 'P1',
    instrument_name: 'Piano',
    staves: [staff],
    bracket_type: 'None',
  };
  const system: System = {
    index: 0,
    bounding_box: { x: 0, y: 0, width: 2400, height: 400 },
    staff_groups: [staffGroup],
    tick_range: { start_tick: 0, end_tick: 3840 },
  };
  return {
    systems: [system],
    total_width: 2400,
    total_height: 400,
    units_per_space: 20,
  };
}

function renderAndGetSVG(layout: GlobalLayout): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const pipeline = new RenderingPipeline();
  pipeline.init(svg);
  pipeline.renderAll(layout, config, viewport);
  return svg;
}

// --- Tests ---

describe('RenderingPipeline — dynamic glyphs', () => {
  /** T012: DynamicGlyph with valid codepoint renders SVG <text> with Bravura */
  it('renders a DynamicGlyph as SVG text with Bravura font', () => {
    const staff = makeStaff({
      dynamic_glyphs: [
        {
          codepoint: '\uE520', // dynamicPiano
          label: '',
          x: 300,
          y: 200,
          font_size: 80,
          bounding_box: { x: -0.036, y: -0.576, width: 0.816, height: 0.792 },
        },
      ],
    });

    const svg = renderAndGetSVG(makeLayout(staff));
    const texts = svg.querySelectorAll('text');

    // Find the dynamic glyph text element
    const dynamicTexts = Array.from(texts).filter(
      (t) => t.textContent === '\uE520'
    );

    expect(dynamicTexts.length).toBe(1);
    const el = dynamicTexts[0];
    expect(el.getAttribute('font-family')).toBe('Bravura');
    expect(el.getAttribute('font-size')).toBe('80');
    expect(el.getAttribute('dominant-baseline')).toBe('middle');
    expect(el.getAttribute('x')).toBe('300');
    expect(el.getAttribute('y')).toBe('200');
  });

  /** T024: DynamicGlyph with empty codepoint renders italic fallback text */
  it('renders a fallback DynamicGlyph as italic serif text', () => {
    const staff = makeStaff({
      dynamic_glyphs: [
        {
          codepoint: '',
          label: 'dyn',
          x: 300,
          y: 200,
          font_size: 80,
          bounding_box: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });

    const svg = renderAndGetSVG(makeLayout(staff));
    const texts = svg.querySelectorAll('text');

    const fallbackTexts = Array.from(texts).filter(
      (t) => t.textContent === 'dyn'
    );

    expect(fallbackTexts.length).toBe(1);
    const el = fallbackTexts[0];
    expect(el.getAttribute('font-style')).toBe('italic');
    expect(el.getAttribute('font-family')).toBe('serif');
    expect(el.getAttribute('font-size')).toBe('40'); // font_size * 0.5
  });
});

describe('RenderingPipeline — hairpin rendering', () => {
  /** T018: Crescendo HairpinLayout renders two SVG <line> elements */
  it('renders a crescendo hairpin as two SVG lines', () => {
    const staff = makeStaff({
      hairpin_layouts: [
        {
          direction: 'Crescendo',
          x_start: 200,
          x_end: 500,
          y_center: 200,
          opening: 20,
          continues_left: false,
          continues_right: false,
        },
      ],
    });

    const svg = renderAndGetSVG(makeLayout(staff));

    // Find hairpin lines by checking for the specific coordinates
    const lines = Array.from(svg.querySelectorAll('line'));
    const hairpinLines = lines.filter((l) => {
      const x1 = parseFloat(l.getAttribute('x1') || '');
      const x2 = parseFloat(l.getAttribute('x2') || '');
      return x1 === 200 && x2 === 500;
    });

    expect(hairpinLines.length).toBe(2);

    // Crescendo: point at (x_start, y_center) → (x_end, y_center ± opening/2)
    const topLine = hairpinLines.find(
      (l) => parseFloat(l.getAttribute('y2') || '') === 190
    );
    const bottomLine = hairpinLines.find(
      (l) => parseFloat(l.getAttribute('y2') || '') === 210
    );

    expect(topLine).toBeDefined();
    expect(bottomLine).toBeDefined();

    // Both start at the point (x_start, y_center)
    expect(topLine!.getAttribute('y1')).toBe('200');
    expect(bottomLine!.getAttribute('y1')).toBe('200');

    // stroke-width should be 1.5
    expect(topLine!.getAttribute('stroke-width')).toBe('1.5');
  });

  /** T019: Diminuendo HairpinLayout renders two SVG <line> elements */
  it('renders a diminuendo hairpin as two SVG lines', () => {
    const staff = makeStaff({
      hairpin_layouts: [
        {
          direction: 'Diminuendo',
          x_start: 200,
          x_end: 500,
          y_center: 200,
          opening: 20,
          continues_left: false,
          continues_right: false,
        },
      ],
    });

    const svg = renderAndGetSVG(makeLayout(staff));

    const lines = Array.from(svg.querySelectorAll('line'));
    const hairpinLines = lines.filter((l) => {
      const x1 = parseFloat(l.getAttribute('x1') || '');
      const x2 = parseFloat(l.getAttribute('x2') || '');
      return x1 === 200 && x2 === 500;
    });

    expect(hairpinLines.length).toBe(2);

    // Diminuendo: open at (x_start, y_center ± opening/2) → point at (x_end, y_center)
    const topLine = hairpinLines.find(
      (l) => parseFloat(l.getAttribute('y1') || '') === 190
    );
    const bottomLine = hairpinLines.find(
      (l) => parseFloat(l.getAttribute('y1') || '') === 210
    );

    expect(topLine).toBeDefined();
    expect(bottomLine).toBeDefined();

    // Both converge to the point (x_end, y_center)
    expect(topLine!.getAttribute('y2')).toBe('200');
    expect(bottomLine!.getAttribute('y2')).toBe('200');

    expect(topLine!.getAttribute('stroke-width')).toBe('1.5');
  });
});
