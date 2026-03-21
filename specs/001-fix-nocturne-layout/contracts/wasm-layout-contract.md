# WASM Layout Engine → Frontend Contract

**Feature**: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)  
**Date**: 2026-03-21  
**Contract Type**: WASM output → TypeScript renderer interface  
**Nature of change**: Additive — existing fields unchanged; accidental codepoints extended to full 5-value range

---

## Overview

The Rust layout engine emits a `LayoutOutput` JSON blob via WASM. The frontend TypeScript renderer reads this blob and draws SVG/Canvas elements. This contract documents the relevant parts of `LayoutOutput` that change or are validated by this feature.

No new fields are added to the TypeScript interface — the existing `codepoint: string` (Unicode character) field on glyph elements already supports any SMuFL codepoint. The change is that the Rust engine will now correctly emit U+E263 and U+E264 (previously incorrectly collapsed to U+E261). The frontend renderer does not need modification for this specific field.

The contract fix in `NotationRenderer.tsx` (where only `sharp`/`flat` cases existed) is eliminated by moving glyph selection fully into the Rust engine — see the design decision in `research.md`.

---

## Contract Sections Affected

### 1. AccidentalGlyph in LayoutOutput

```typescript
// UNCHANGED interface — but now all 5 alter values produce correct codepoints
interface AccidentalGlyph {
  /** Unicode code point of the SMuFL glyph to render */
  codepoint: string;       // char rendered with the SMuFL music font
  x: number;               // logical x coordinate (layout engine space)
  y: number;               // logical y coordinate (layout engine space)
  source_note_id: string;  // reference back to source note for selection/highlighting
}
```

**Before fix**: `codepoint` for a double-flat note would be `"\uE261"` (natural ♮) — incorrect.  
**After fix**: `codepoint` for a double-flat note will be `"\uE264"` (double-flat 𝄫) — correct.

**Validation test** (frontend contract):
```typescript
// frontend/e2e/nocturne-m29-m37-layout.spec.ts
test('M29 double-flat note shows double-flat glyph U+E264', async ({ page }) => {
  // Load Nocturne, navigate to M29, assert the rendered glyph text equals '\uE264'
});
```

---

### 2. OttavaBracketLayout in LayoutOutput

```typescript
// UNCHANGED interface — the fix corrects x_start to match M30's first beat
interface OttavaBracketLayout {
  label: string;        // "8va" or "8vb"
  x_start: number;      // FIXED: logical x of the first note in the bracket region (M30)
  x_end: number;        // logical x of the last note in the bracket region
  y: number;            // logical y above/below the staff
  above: boolean;       // true for 8va (above), false for 8vb (below)
  closed_right: boolean;// true when the bracket ends with a vertical hook within same system
  staff_index: number;  // 0-based staff index within the system
}
```

**Before fix**: An `OttavaBracketLayout` element either (a) had `x_start` positioned at M31 instead of M30, or (b) was absent entirely.  
**After fix**: `x_start` positioned at the first note of M30.

**Validation test**:
```typescript
test('M30 8va bracket starts at M30 x-coordinate', async ({ page }) => {
  // Load Nocturne, verify layout JSON contains ottava bracket with x_start ≤ first note of M30
});
```

---

### 3. RestGlyph in LayoutOutput

```typescript
// UNCHANGED interface — the fix corrects y for multi-voice measures
interface RestGlyph {
  codepoint: string;       // SMuFL rest glyph (e.g., "\uE4E3" eighth rest)
  x: number;
  y: number;               // FIXED: correct voice-adjusted vertical position
  voice: number;           // 1-based voice number (from MusicXML)
  duration_ticks: number;
}
```

**Before fix**: `y` for voice 2 rest in M34–M36 was placed at wrong position (voice index off by one).  
**After fix**: `y` correctly reflects standard voice 1 (centred) and voice 2 (displaced down ~2 staff spaces) positions.

---

### 4. SlurArc in LayoutOutput

```typescript
// UNCHANGED interface — the fix adds correct system-relative coordinates for cross-system slurs
interface SlurArc {
  start: { x: number; y: number };
  end:   { x: number; y: number };
  cp1:   { x: number; y: number };  // Bézier control point 1
  cp2:   { x: number; y: number };  // Bézier control point 2
  above: boolean;
  is_cross_system: boolean;          // FIXED: correctly set to true when start/end on different systems
  note_ids: [string, string];
}
```

**Before fix**: If M37 slur spans systems, `is_cross_system` was false and `end.x` was in the wrong coordinate space.  
**After fix**: `is_cross_system` correctly set; `start` and `end` use system-relative coordinates; frontend renderer draws two half-arcs when true.

---

## No New API Endpoints

This feature operates entirely within the WASM layout pipeline. There are no HTTP endpoints, REST methods, or GraphQL mutations involved.

---

## Regression Contract

After implementing all fixes, the following invariants must hold for the Nocturne fixture at all times:

| Invariant | Test | Location |
|-----------|------|----------|
| M29 double-flat note → AccidentalGlyph.codepoint == U+E264 | `test_nocturne_m29_double_flat_accidental` | `backend/tests/nocturne_m29_m37_test.rs` |
| M30 OttavaBracketLayout.x_start is within M30's x-range | `test_nocturne_m30_ottava_bracket_starts_at_m30` | `backend/tests/nocturne_m29_m37_test.rs` |
| M34–M36 all courtesy accidentals present | `test_nocturne_m34_m36_courtesy_accidentals` | `backend/tests/nocturne_m29_m37_test.rs` |
| M34–M36 voice 2 rest.y within expected staff position range | `test_nocturne_m34_m36_rest_centering` | `backend/tests/nocturne_m29_m37_test.rs` |
| M37 slur start.x < system_width when is_cross_system=false | `test_nocturne_m37_slur_coordinates` | `backend/tests/nocturne_m29_m37_test.rs` |
| M32–M34 adjacent elements have ≥ MIN_CLEARANCE horizontal gap | `test_nocturne_m32_m34_no_overlaps` | `backend/tests/nocturne_m29_m37_test.rs` |
| No regressions in M1–M28, M38 of Nocturne | Existing `layout_test.rs` nocturne tests | `backend/tests/layout_test.rs` |
| No regressions in other scores | Full `cargo test` pass | CI |
