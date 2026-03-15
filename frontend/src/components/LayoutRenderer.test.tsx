/**
 * Feature 027: Demo Flow UX
 * LayoutRenderer component tests
 *
 * Constitution VII: Failing tests must be written before fixes.
 *
 * T002: shouldComponentUpdate must return true when selectedNoteId changes
 * T029: .layout-glyph.highlighted fill must be #F5A340, not #4A90E2
 * T033: bracket glyph text element must have dominant-baseline="hanging"
 * T022: STAFF_LINE_STROKE_WIDTH must be ≥ 1.5 for tablet readability
 *
 * @see specs/027-demo-flow-ux/tasks.md T002, T029, T033
 * @see specs/050-fix-layout-preloaded-scores/tasks.md T022
 */

import { describe, it, expect } from 'vitest';
import type { LayoutRendererProps } from './LayoutRenderer';
import type { RenderConfig } from '../types/RenderConfig';
import type { Viewport } from '../types/Viewport';

// Minimal valid props for shouldComponentUpdate unit tests
// We call shouldComponentUpdate directly on the prototype — no mounting needed.
const makeMinimalProps = (overrides: Partial<LayoutRendererProps> = {}): LayoutRendererProps => ({
  layout: null,
  config: {
    staffLineWidth: 1,
    staffLineSpacing: 10,
    fontFamily: 'Bravura',
    defaultColor: '#000000',
    selectionColor: '#FF6B00',
    highlightColor: '#4A90E2',
  } as RenderConfig,
  viewport: { x: 0, y: 0, width: 800, height: 600 } as Viewport,
  ...overrides,
});

// ============================================================================
// T002 [BUG]: shouldComponentUpdate must include selectedNoteId
//
// Root cause: shouldComponentUpdate at ~L139 compares layout, config,
// viewport, and sourceToNoteIdMap — but NOT selectedNoteId. This means
// changing only selectedNoteId never triggers a re-render, so the orange
// selection highlight never appears after a tap-to-seek.
//
// This test FAILS before T003 (returns false — bug confirmed).
// This test PASSES after T003 (returns true — fix applied).
// ============================================================================

describe('[T002] BUG: shouldComponentUpdate missing selectedNoteId', () => {
  it('shouldComponentUpdate returns true when selectedNoteId changes from undefined to a value', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const baseProps = makeMinimalProps({ selectedNoteId: undefined });
    const nextProps = makeMinimalProps({ selectedNoteId: 'note-42' });

    // Instantiate without mounting — we just need prototype access
    // shouldComponentUpdate is a pure function of prevProps and nextProps
    const result = LayoutRenderer.prototype.shouldComponentUpdate.call(
      { props: baseProps },
      nextProps,
    );

    // BUG: currently returns false (selectedNoteId not in guard)
    // AFTER T003 FIX: must return true
    expect(result).toBe(true);
  });

  it('shouldComponentUpdate returns true when selectedNoteId changes from one note to another', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const baseProps = makeMinimalProps({ selectedNoteId: 'note-1' });
    const nextProps = makeMinimalProps({ selectedNoteId: 'note-2' });

    const result = LayoutRenderer.prototype.shouldComponentUpdate.call(
      { props: baseProps },
      nextProps,
    );

    expect(result).toBe(true);
  });

  it('shouldComponentUpdate returns true when selectedNoteId changes from a value to undefined', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const baseProps = makeMinimalProps({ selectedNoteId: 'note-99' });
    const nextProps = makeMinimalProps({ selectedNoteId: undefined });

    const result = LayoutRenderer.prototype.shouldComponentUpdate.call(
      { props: baseProps },
      nextProps,
    );

    expect(result).toBe(true);
  });

  it('shouldComponentUpdate returns false when selectedNoteId is unchanged (no spurious re-renders)', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    // Share the SAME object references for all non-selected props to ensure
    // only selectedNoteId is the discriminating factor.
    const sharedProps = makeMinimalProps({ selectedNoteId: 'note-42' });
    const nextProps: LayoutRendererProps = {
      ...sharedProps,
      selectedNoteId: 'note-42', // identical — no change
    };

    const result = LayoutRenderer.prototype.shouldComponentUpdate.call(
      { props: sharedProps },
      nextProps,
    );

    expect(result).toBe(false);
  });

  it('shouldComponentUpdate still returns false for highlight-only changes (performance guard)', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    // Share the SAME object references for all structural props.
    const sharedBase = makeMinimalProps({
      selectedNoteId: 'note-42',
      highlightedNoteIds: new Set(['note-1']),
    });
    // Only highlightedNoteIds changes — must NOT trigger structural re-render
    const nextProps: LayoutRendererProps = {
      ...sharedBase,
      highlightedNoteIds: new Set(['note-2']),
    };

    const result = LayoutRenderer.prototype.shouldComponentUpdate.call(
      { props: sharedBase },
      nextProps,
    );

    expect(result).toBe(false);
  });
});
// ============================================================================
// T029 [BUG]: .layout-glyph.highlighted fill must be #F5A340 (amber), not #4A90E2 (blue)
//
// Root cause: LayoutRenderer.css currently sets fill: #4A90E2 for all
// .highlighted selectors. FR-012 requires amber (#F5A340) for
// good contrast against dark notation at viewing distance SC-005.
//
// This test FAILS before T030 (fill is #4A90E2 — bug confirmed).
// This test PASSES after T030 (fill is #F5A340 — fix applied).
// ============================================================================

describe('[T029] BUG: highlighted note fill must be amber #F5A340, not blue #4A90E2', () => {
  it('LayoutRenderer.css sets fill: #F5A340 for .layout-glyph.highlighted', async () => {
    // Load the CSS file content via dynamic import (Vitest supports CSS modules)
    // We inspect the actual CSS rules by injecting a style and checking computed style.
    const div = document.createElement('div');
    div.className = 'layout-glyph highlighted';
    document.body.appendChild(div);

    // Import the LayoutRenderer module which imports LayoutRenderer.css
    await import('./LayoutRenderer');

    // Allow the CSS to apply
    await new Promise(r => setTimeout(r, 10));

    // Parse injected stylesheets for the rule
    const cssText = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules ?? []).map(r => r.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');

    document.body.removeChild(div);

    // After T030: must contain #F5A340 (amber), not #4A90E2 (blue)
    // Both assertions: .layout-glyph.highlighted has amber fill
    const hasBlue = cssText.includes('#4A90E2') || cssText.includes('#4a90e2');
    const hasOrange = cssText.includes('#F5A340') || cssText.includes('#f5a340');

    // In JSDOM, CSS may not be parsed from imported files — so we fall back
    // to checking the raw source text of the CSS file that was loaded.
    // If cssText parsing is unavailable, verify via module source inspection.
    if (!hasOrange && !hasBlue) {
      // CSS not loaded in JSDOM (expected) — verify via file read in Vitest node env
      const fs = await import('fs');
      const path = await import('path');
      const cssPath = path.resolve(__dirname, 'LayoutRenderer.css');
      const cssSource = fs.readFileSync(cssPath, 'utf-8');

      const sourceHasBlue = cssSource.includes('#4A90E2') || cssSource.includes('#4a90e2');
      const sourceHasOrange = cssSource.includes('#F5A340') || cssSource.includes('#f5a340');

      // The highlighted rules must use orange
      expect(sourceHasOrange).toBe(true);
      // The old blue color must be gone from highlighted rules
      expect(sourceHasBlue).toBe(false);
    } else {
      expect(hasOrange).toBe(true);
      expect(hasBlue).toBe(false);
    }
  });
});

// ============================================================================
// T033 [BUG]: Bracket glyph text element must have dominant-baseline="hanging"
//
// Root cause: renderGlyph() sets dominant-baseline="middle" for all text glyphs.
// For the bracket brace (SMuFL U+E000), "middle" uses the font's typographic
// midpoint, not the glyph's geometric center, causing visual misalignment.
// With the Rust fix (T034, y=top_y), the correct anchor is "hanging" so the
// glyph top aligns with the top staff line.
//
// This test FAILS before T035 (value is "middle"), PASSES after T035 ("hanging").
// ============================================================================

describe('[T033] Brace renders as SVG path, Bracket renders as SVG lines', () => {
  it('renderBracket with Brace type produces an SVG <path> element spanning topY→bottomY', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const minimalStaffGroup = {
      instrument_id: 'piano',
      bracket_type: 'Brace',
      bracket_glyph: {
        x: 15,
        y: 0,
        scale_y: 0.781,
        codepoint: '\uE000',
        bounding_box: { x: 10, y: 0, width: 20, height: 250 },
      },
      staves: [],
      brace_glyph: null,
      measures: [],
    };

    const minimalConfig = {
      staffLineWidth: 1,
      staffLineSpacing: 10,
      fontFamily: 'Bravura',
      defaultColor: '#000000',
      selectionColor: '#FF6B00',
      highlightColor: '#F5A340',
      staffLineColor: '#000000',
      glyphColor: '#000000',
    };

    const receiver: any = { props: { config: minimalConfig } };
    receiver.renderGlyph = LayoutRenderer.prototype.renderGlyph.bind(receiver);

    const bracketGroup = LayoutRenderer.prototype.renderBracket.call(
      receiver,
      minimalStaffGroup,
    ) as SVGGElement | null;

    expect(bracketGroup).not.toBeNull();
    // Must contain a <path> element (SVG Bézier brace)
    const pathEl = bracketGroup?.querySelector('path');
    expect(pathEl).not.toBeNull();
    // Must NOT contain a <text> glyph (font metric approach abandoned)
    expect(bracketGroup?.querySelector('text')).toBeNull();
  });

  it('renderBracket with Bracket type produces SVG line primitives (no path)', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const minimalStaffGroup = {
      instrument_id: 'piano',
      bracket_type: 'Bracket',
      bracket_glyph: {
        x: 15,
        y: 0,
        scale_y: 1,
        codepoint: '\uE002',
        bounding_box: { x: 10, y: 0, width: 20, height: 100 },
      },
      staves: [],
      brace_glyph: null,
      measures: [],
    };

    const minimalConfig = {
      staffLineWidth: 1,
      staffLineSpacing: 10,
      fontFamily: 'Bravura',
      defaultColor: '#000000',
      selectionColor: '#FF6B00',
      highlightColor: '#F5A340',
      staffLineColor: '#000000',
      glyphColor: '#000000',
    };

    const receiver: any = { props: { config: minimalConfig } };
    receiver.renderGlyph = LayoutRenderer.prototype.renderGlyph.bind(receiver);

    const bracketGroup = LayoutRenderer.prototype.renderBracket.call(
      receiver,
      minimalStaffGroup,
    ) as SVGGElement | null;

    expect(bracketGroup).not.toBeNull();
    expect(bracketGroup?.querySelector('text')).toBeNull();
    const lines = bracketGroup?.querySelectorAll('line');
    expect(lines?.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// T013 [US2]: renderGlyphRun must emit a transparent <rect> hit overlay per note glyph
// T014 [US2]: <rect> hit overlay width/height must be >= MIN_TOUCH_PX / renderScale
//
// Root cause: Current renderGlyphRun only emits the glyph element (text/line/rect).
// FR-006 + SC-006 require minimum 44px touch targets for noteheads.
// The fix (T016) adds a transparent <rect> sibling with data-note-id using bounding_box.
//
// T013 FAILS before T016 (no <rect> with data-note-id in group).
// T013 PASSES after T016 (transparent <rect> sibling present).
// T014 FAILS before T016 (width/height below 44px threshold).
// T014 PASSES after T016 (width/height clamped to MIN_TOUCH_PX / renderScale).
// ============================================================================

describe('[T013] BUG: renderGlyphRun must emit transparent hit-rect overlay per notehead', () => {
  it('renderGlyphRun emits a <rect> with data-note-id, fill=transparent for each note glyph', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    // Minimal glyph run with one notehead glyph that has a source_reference and bounding_box
    const noteSourceRef = {
      instrument_id: 'piano',
      staff_index: 0,
      voice_index: 0,
      event_index: 0,
    };

    const minimalGlyphRun = {
      font_family: 'Bravura',
      font_size: 40,
      color: null,
      glyphs: [
        {
          codepoint: '\uE0A4', // SMuFL notehead (quarter note black)
          position: { x: 100, y: 200 },
          bounding_box: { x: 96, y: 195, width: 20, height: 20 },
          source_reference: noteSourceRef,
        },
      ],
    };

    // Build sourceToNoteIdMap so noteId resolves for this glyph
    // createSourceKey format: `{system_index}/{instrument_id}/{staff_index}/{voice_index}/{event_index}`
    const sourceKey = `0/piano/0/0/0`;
    const noteId = 'note-abc-123';
    const sourceToNoteIdMap = new Map([[sourceKey, noteId]]);

    const minimalConfig = {
      staffLineWidth: 1,
      staffLineSpacing: 10,
      fontFamily: 'Bravura',
      defaultColor: '#000000',
      selectionColor: '#FF6B00',
      highlightColor: '#F5A340',
      glyphColor: '#000000',
    };

    // Build receiver with all methods renderGlyphRun calls
     
    const receiver: any = {
      props: {
        config: minimalConfig,
        sourceToNoteIdMap,
        selectedNoteId: undefined,
      },
    };
    receiver.renderGlyph = LayoutRenderer.prototype.renderGlyph.bind(receiver);

    const systemIndex = 0;
    const glyphRunGroup = LayoutRenderer.prototype.renderGlyphRun.call(
      receiver,
      minimalGlyphRun,
      systemIndex,
    ) as SVGGElement;

    expect(glyphRunGroup).not.toBeNull();

    // After T016: there must be a <rect> with data-note-id in the group
    const hitRects = glyphRunGroup.querySelectorAll('rect[data-note-id]');
    expect(hitRects.length).toBeGreaterThan(0);

    const hitRect = hitRects[0] as SVGRectElement;

    // Must be transparent (invisible visual, pointer events only)
    expect(hitRect.getAttribute('fill')).toBe('transparent');

    // Must carry the resolved note ID
    expect(hitRect.dataset.noteId).toBe(noteId);

    // Hit rect x/y may be shifted to center the enlarged target over the bounding_box
    // (Constitution VI: geometry derived from Rust bounding_box; clamping may shift x/y)
    const hitX = parseFloat(hitRect.getAttribute('x') ?? '0');
    const hitY = parseFloat(hitRect.getAttribute('y') ?? '0');
    const hitW2 = parseFloat(hitRect.getAttribute('width') ?? '0');
    const hitH2 = parseFloat(hitRect.getAttribute('height') ?? '0');
    // The hit rect must cover the glyph bounding_box (x=96, y=195, w=20, h=20)
    expect(hitX).toBeLessThanOrEqual(96); // must start at or before glyph left edge
    expect(hitY).toBeLessThanOrEqual(195); // must start at or above glyph top edge
    expect(hitX + hitW2).toBeGreaterThanOrEqual(96 + 20); // must extend to/past glyph right
    expect(hitY + hitH2).toBeGreaterThanOrEqual(195 + 20); // must extend to/past glyph bottom
  });
});

describe('[T014] US2: hit-rect overlay width/height must be >= MIN_TOUCH_PX / renderScale', () => {
  it('small bounding_box (< 44px) gets clamped to MIN_TOUCH_PX (44) at renderScale=1', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    // Use a small glyph (10x10 — well below 44px minimum)
    const minimalGlyphRun = {
      font_family: 'Bravura',
      font_size: 40,
      color: null,
      glyphs: [
        {
          codepoint: '\uE0A4',
          position: { x: 100, y: 200 },
          bounding_box: { x: 96, y: 195, width: 10, height: 10 }, // tiny — needs clamping
          source_reference: {
            instrument_id: 'piano',
            staff_index: 0,
            voice_index: 0,
            event_index: 1,
          },
        },
      ],
    };

    const sourceKey = `0/piano/0/0/1`;
    const noteId = 'note-tiny-456';
    const sourceToNoteIdMap = new Map([[sourceKey, noteId]]);

    const minimalConfig = {
      staffLineWidth: 1,
      staffLineSpacing: 10,
      fontFamily: 'Bravura',
      defaultColor: '#000000',
      selectionColor: '#FF6B00',
      highlightColor: '#F5A340',
      glyphColor: '#000000',
    };

     
    const receiver: any = {
      props: {
        config: minimalConfig,
        sourceToNoteIdMap,
        selectedNoteId: undefined,
      },
    };
    receiver.renderGlyph = LayoutRenderer.prototype.renderGlyph.bind(receiver);

    const glyphRunGroup = LayoutRenderer.prototype.renderGlyphRun.call(
      receiver,
      minimalGlyphRun,
      0,
    ) as SVGGElement;

    const hitRects = glyphRunGroup.querySelectorAll('rect[data-note-id]');
    expect(hitRects.length).toBeGreaterThan(0);

    const hitRect = hitRects[0] as SVGRectElement;
    const width = parseFloat(hitRect.getAttribute('width') ?? '0');
    const height = parseFloat(hitRect.getAttribute('height') ?? '0');

    // At renderScale=1: MIN_TOUCH_PX / 1 = 44px minimum
    // Bounding box is 10x10 — must be clamped to at least 44x44
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  it('large bounding_box (> 44px) uses actual bounding_box dimensions', async () => {
    const { LayoutRenderer } = await import('./LayoutRenderer');

    const minimalGlyphRun = {
      font_family: 'Bravura',
      font_size: 40,
      color: null,
      glyphs: [
        {
          codepoint: '\uE0A4',
          position: { x: 100, y: 200 },
          bounding_box: { x: 96, y: 195, width: 60, height: 60 }, // larger than 44px
          source_reference: {
            instrument_id: 'piano',
            staff_index: 0,
            voice_index: 0,
            event_index: 2,
          },
        },
      ],
    };

    const sourceKey = `0/piano/0/0/2`;
    const noteId = 'note-large-789';
    const sourceToNoteIdMap = new Map([[sourceKey, noteId]]);

    const minimalConfig = {
      staffLineWidth: 1,
      staffLineSpacing: 10,
      fontFamily: 'Bravura',
      defaultColor: '#000000',
      selectionColor: '#FF6B00',
      highlightColor: '#F5A340',
      glyphColor: '#000000',
    };

     
    const receiver: any = {
      props: {
        config: minimalConfig,
        sourceToNoteIdMap,
        selectedNoteId: undefined,
      },
    };
    receiver.renderGlyph = LayoutRenderer.prototype.renderGlyph.bind(receiver);

    const glyphRunGroup = LayoutRenderer.prototype.renderGlyphRun.call(
      receiver,
      minimalGlyphRun,
      0,
    ) as SVGGElement;

    const hitRects = glyphRunGroup.querySelectorAll('rect[data-note-id]');
    expect(hitRects.length).toBeGreaterThan(0);

    const hitRect = hitRects[0] as SVGRectElement;
    const width = parseFloat(hitRect.getAttribute('width') ?? '0');
    const height = parseFloat(hitRect.getAttribute('height') ?? '0');

    // Bounding box is 60x60 — width/height should be >= 44 (already satisfied by 60)
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });
});

// ============================================================================
// T022 [BUG]: Staff line stroke-width must be ≥ 1.5 (readable on tablet)
//
// Root cause: renderStaff() hardcodes stroke-width='1' for staff lines.
// At units_per_space=20, this is 0.05 sp — approximately half the Musescore
// standard of ~0.12 sp (~2.4 units). On tablet screens this produces hairline
// staff lines. Minimum acceptable value for tablet readability is 1.5.
//
// This test FAILS before T023 (STAFF_LINE_STROKE_WIDTH=1 < 1.5).
// This test PASSES after T023 (STAFF_LINE_STROKE_WIDTH=1.5 ≥ 1.5).
//
// @see specs/050-fix-layout-preloaded-scores/research.md M-004
// ============================================================================

describe('[T022] BUG: STAFF_LINE_STROKE_WIDTH must be ≥ 1.5 for tablet readability', () => {
  it('STAFF_LINE_STROKE_WIDTH is at least 1.5 SVG units', async () => {
    const { STAFF_LINE_STROKE_WIDTH } = await import('./LayoutRenderer');
    expect(STAFF_LINE_STROKE_WIDTH).toBeGreaterThanOrEqual(1.5);
  });

  it('LEDGER_LINE_STROKE_WIDTH is at least as wide as STAFF_LINE_STROKE_WIDTH', async () => {
    const { STAFF_LINE_STROKE_WIDTH, LEDGER_LINE_STROKE_WIDTH } = await import('./LayoutRenderer');
    expect(LEDGER_LINE_STROKE_WIDTH).toBeGreaterThanOrEqual(STAFF_LINE_STROKE_WIDTH);
  });
});

