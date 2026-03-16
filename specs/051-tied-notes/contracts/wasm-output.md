# Contract: WASM Layout Output — Tied Notes

**Feature**: `051-tied-notes`  
**Date**: 2026-03-16  
**Direction**: Rust layout engine → Frontend TypeScript

---

## Purpose

This contract defines the data structures emitted by the Rust/WASM layout engine for tied notes. The frontend renderer consumes these structures to draw tie arcs without performing any coordinate calculations itself (Constitution VI).

---

## Updated `Staff` Layout Output

The existing `Staff` type in layout output gains one new field:

```typescript
// Existing type (abbreviated)
interface LayoutStaff {
  staffLines: StaffLine[];
  glyphRuns: GlyphRun[];
  structuralGlyphs: Glyph[];
  barLines: BarLine[];
  ledgerLines: LedgerLine[];
  notationDots: NotationDot[];

  // NEW: Tie arcs for this staff, one per adjacent tied-note pair
  tieArcs: TieArc[];
}
```

---

## New `TieArc` Type

```typescript
/**
 * Precomputed Bézier geometry for a single tie arc.
 * Emitted by the Rust layout engine — the frontend renderer MUST NOT
 * recalculate or modify these coordinates.
 */
interface TieArc {
  /** Starting point: right edge of the first (start) notehead. */
  start: Point;
  /** Ending point: left edge of the second (continuation) notehead. */
  end: Point;
  /** First cubic Bézier control point (~1/3 horizontal span, offset by arc_height). */
  cp1: Point;
  /** Second cubic Bézier control point (~2/3 horizontal span, offset by arc_height). */
  cp2: Point;
  /** True = arc curves above noteheads (stems down); false = below (stems up). */
  above: boolean;
  /** ID of the note at the start of this arc (tie origin). */
  noteIdStart: string;
  /** ID of the note at the end of this arc (tie continuation). */
  noteIdEnd: string;
}

interface Point {
  x: number;
  y: number;
}
```

---

## Updated `Note` in Score Output

The Note type emitted in the WASM score output gains two new fields:

```typescript
interface Note {
  id: string;
  startTick: number;
  durationTicks: number;
  pitch: Pitch;
  spelling?: NoteSpelling;
  beams?: NoteBeamData[];
  staccato?: boolean;
  dotCount?: number;

  // NEW: Tie support
  /** ID of the next note in this tie chain. Present only on tie-start notes. */
  tieNext?: string;
  /** True if this note is a tied continuation (no new attack). */
  isTieContinuation?: boolean;
}
```

---

## Renderer Contract (Frontend Obligation)

For each `TieArc` in `staff.tieArcs`, the renderer MUST:
1. Draw a cubic Bézier `<path>` using the precomputed coordinates.
2. Apply no stroke fill (arcs are open curves).
3. NOT compute any coordinates itself — use only what the layout engine provides.

**Reference SVG path**:
```jsx
<path
  key={`tie-${arc.noteIdStart}-${arc.noteIdEnd}`}
  d={`M ${arc.start.x},${arc.start.y} C ${arc.cp1.x},${arc.cp1.y} ${arc.cp2.x},${arc.cp2.y} ${arc.end.x},${arc.end.y}`}
  fill="none"
  stroke="currentColor"
  strokeWidth={1.5}
  className="tie-arc"
/>
```

---

## JSON Example

A staff containing one tie arc between two quarter notes:

```json
{
  "tieArcs": [
    {
      "start":      { "x": 142.5, "y": 110.0 },
      "end":        { "x": 218.3, "y": 110.0 },
      "cp1":        { "x": 167.6, "y":  98.0 },
      "cp2":        { "x": 193.1, "y":  98.0 },
      "above":      true,
      "noteIdStart": "n-001",
      "noteIdEnd":   "n-002"
    }
  ]
}
```

---

## Breaking Change Policy

Adding `tieArcs` to `Staff` is **additive**: existing consumers ignore the new field. Adding `tieNext` and `isTieContinuation` to `Note` is also additive. No breaking changes to existing contracts.
