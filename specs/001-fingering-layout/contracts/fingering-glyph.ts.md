# TypeScript Interface Contracts: Fingering Support

**File**: `frontend/src/wasm/layout.ts` and `frontend/src/components/LayoutRenderer.tsx`  
**Date**: 2026-03-22

These are the exact TypeScript additions required. Use these as the authoritative source during implementation.

---

## New: `FingeringGlyph` interface in `frontend/src/wasm/layout.ts`

```typescript
export interface FingeringGlyph {
  /** Horizontal centre of the numeral (same x as notehead) */
  x: number;
  /** Vertical position of the numeral; always outside staff lines */
  y: number;
  /** Finger number to display (1–5 for standard piano, other values possible) */
  digit: number;
  /** true = numeral above notehead, false = numeral below notehead */
  above: boolean;
}
```

---

## Changed: `Staff` interface in `frontend/src/wasm/layout.ts`

Add one optional field (optional because scores without fingering omit the field in JSON):

```typescript
export interface Staff {
  staff_lines: StaffLine[];
  glyph_runs: GlyphRun[];
  structural_glyphs: Glyph[];
  bar_lines: BarLine[];
  ledger_lines: LedgerLine[];
  notation_dots?: NotationDot[];
  tie_arcs?: TieArc[];
  slur_arcs?: TieArc[];
  fingering_glyphs?: FingeringGlyph[];  // NEW — absent when score has no fingering
}
```

---

## Changed: Rendering loop in `frontend/src/components/LayoutRenderer.tsx`

Add after the existing `slur_arcs` rendering loop. Uses SVG `<text>` element:

```typescript
// Fingering glyphs — positioned numerals above/below noteheads
for (const fg of staff.fingering_glyphs ?? []) {
  const text = createSVGElement('text');
  text.setAttribute('x', fg.x.toString());
  text.setAttribute('y', fg.y.toString());
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-family', 'Bravura, serif');
  text.setAttribute('font-size', (unitsPerSpace * 1.4).toString());
  text.setAttribute('fill', config.glyphColor);
  text.setAttribute('class', 'fingering-glyph');
  text.textContent = fg.digit.toString();
  staffElement.appendChild(text);
}
```

**Note**: `unitsPerSpace` is the layout config constant already available in `LayoutRenderer.tsx` scope. `config.glyphColor` is the existing color configuration. `createSVGElement` is the existing SVG element factory used for other annotation types.

---

## Rendering Invariants

- `fingering_glyphs ?? []` — safe fallback; never throws when field is absent (scores without fingering)
- `fg.digit.toString()` — always produces '1'–'5' for standard piano fingering
- `class="fingering-glyph"` — allows CSS targeting and E2E test selection if needed
- `font-size: unitsPerSpace * 1.4` — scales with layout zoom, consistent with other text-based annotations
- No mutation of `fg.x`, `fg.y` in the renderer — all spatial decisions are made by the Rust layout engine (Principle VI)

---

## Frontend Test Contract (Vitest)

If a frontend unit test is written for the renderer, the mock staff fixture should include:

```typescript
const mockStaffWithFingering: Staff = {
  // ... existing fields ...
  fingering_glyphs: [
    { x: 100.0, y: 45.0, digit: 3, above: true },
    { x: 200.0, y: 210.0, digit: 5, above: false },
  ],
};
```

Expected assertions:
- Two SVG `<text>` elements with class `fingering-glyph` are present
- First element has `textContent === '3'` and `y === '45'`
- Second element has `textContent === '5'` and `y === '210'`
