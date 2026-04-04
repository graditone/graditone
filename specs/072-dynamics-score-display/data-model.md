# Data Model: Music Dynamics Score Display

**Feature**: 072-dynamics-score-display  
**Date**: 2026-04-04

This document describes the layout-layer data model introduced by this feature. Domain entities (`DynamicMarking`, `GradualDynamic`) already exist and are unchanged. This document covers only the new layout output types added to `GlobalLayout`.

---

## Existing Domain Entities (unchanged)

### `DynamicMarking` (backend/src/domain/events/dynamics.rs)

An instantaneous dynamic level event associated with a staff and tick position.

| Field | Type | Description |
|-------|------|-------------|
| `marking` | `DynamicLevel` | One of: PPP, PP, P, MP, MF, F, FF, FFF |
| `velocity` | `u8` | MIDI velocity 1–127 (used by playback; read-only for layout) |
| `start_tick` | `Tick` (u32) | 960-PPQ tick position of the dynamic event |
| `staff` | `u8` | 1-based staff number within the instrument |

### `GradualDynamic` (backend/src/domain/events/dynamics.rs)

A gradual intensity transition (crescendo or diminuendo) spanning a tick range.

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `GradualDirection` | `Crescendo` or `Diminuendo` |
| `start_tick` | `Tick` (u32) | 960-PPQ tick where hairpin begins |
| `stop_tick` | `Tick` (u32) | 960-PPQ tick where hairpin ends |
| `staff` | `u8` | 1-based staff number within the instrument |
| `number` | `u8` | MusicXML wedge number for start/stop matching |

---

## New Layout Types

### `DynamicGlyph` (NEW — backend/src/layout/dynamics.rs)

A positioned dynamic symbol ready for rendering. Emitted by the layout engine; consumed by the SVG renderer.

| Field | Type | Description |
|-------|------|-------------|
| `codepoint` | `String` | SMuFL Unicode codepoint string (e.g. `"\u{E520}"` for p). Empty string = fallback text mode. |
| `label` | `String` | Fallback text label (used only when `codepoint` is empty, e.g., `"dyn"` for unrecognised markings). |
| `x` | `f32` | Absolute x coordinate (logical units, left edge of glyph) |
| `y` | `f32` | Absolute y coordinate (logical units, glyph baseline) |
| `font_size` | `f32` | Always 80.0 (SMuFL standard, 4 staff spaces = 1em) |
| `bounding_box` | `BoundingBox` | Pre-computed glyph bounding box in logical units (from Bravura metrics) |

**Validation**: `x ≥ 0`, `y > staff_bottom_line_y`, `font_size = 80.0`.

### `HairpinLayout` (NEW — backend/src/layout/dynamics.rs)

A pre-computed hairpin wedge segment. The layout engine always emits per-system segments; a hairpin spanning a line break produces two `HairpinLayout` entries.

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `HairpinDirection` | `Crescendo` (open rightward) or `Diminuendo` (open leftward) |
| `x_start` | `f32` | Left endpoint x coordinate (logical units) |
| `x_end` | `f32` | Right endpoint x coordinate (logical units) |
| `y_center` | `f32` | Vertical center of the hairpin (same baseline as dynamic glyphs) |
| `opening` | `f32` | Half the maximum opening width in logical units (default: `1 * units_per_space` = 20.0) |
| `open_left` | `bool` | True = left end is open (wide); false = left end is the point. Set by `direction`. |
| `continues_left` | `bool` | True = this segment is a system-continuation (left end stays open at `x_start = left_margin`). Used by renderer to omit the left endpoint stroke. |
| `continues_right` | `bool` | True = hairpin continues onto next system (right end stays open at `x_end = system_end`). Used by renderer to omit the right endpoint stroke. |

**Derived geometry** (renderer uses these to draw the two SVG lines):

For a **crescendo** (`open_left = false`):
- Top arm: `(x_start, y_center)` → `(x_end, y_center - opening/2)`  
- Bottom arm: `(x_start, y_center)` → `(x_end, y_center + opening/2)`

For a **diminuendo** (`open_left = true`):
- Top arm: `(x_start, y_center - opening/2)` → `(x_end, y_center)`  
- Bottom arm: `(x_start, y_center + opening/2)` → `(x_end, y_center)`

---

## Extensions to Existing Types

### `Staff` struct extended (backend/src/layout/types.rs)

Two new optional fields added to the existing `Staff` struct. Marked `#[serde(default, skip_serializing_if = "Vec::is_empty")]` for full backward compatibility with all existing tests and serialised snapshots.

```rust
pub struct Staff {
    // ... all existing fields unchanged ...

    /// Positioned dynamic level symbols below the staff (ppp through fff, fallback "dyn")
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dynamic_glyphs: Vec<DynamicGlyph>,

    /// Positioned hairpin crescendo/diminuendo segments below the staff
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hairpin_layouts: Vec<HairpinLayout>,
}
```

### `Staff` TypeScript interface extended (frontend/src/wasm/layout.ts)

```typescript
export interface Staff {
  // ... all existing fields unchanged ...

  /** Positioned dynamic level symbols (ppp through fff, or fallback "dyn") */
  dynamic_glyphs?: DynamicGlyph[];

  /** Positioned hairpin crescendo/diminuendo segments */
  hairpin_layouts?: HairpinLayout[];
}
```

---

## New TypeScript Interfaces (frontend/src/wasm/layout.ts)

### `DynamicGlyph`

```typescript
export interface DynamicGlyph {
  /** SMuFL Unicode codepoint string (e.g. "\uE520" for p). Empty = fallback text. */
  codepoint: string;
  /** Fallback text label when codepoint is empty (e.g. "dyn"). */
  label: string;
  /** Absolute x coordinate in logical units (left edge of glyph) */
  x: number;
  /** Absolute y coordinate in logical units (glyph baseline) */
  y: number;
  /** Always 80.0 (SMuFL standard, 4 staff spaces) */
  font_size: number;
  /** Pre-computed glyph bounding box in logical units */
  bounding_box: BoundingBox;
}
```

### `HairpinLayout`

```typescript
export interface HairpinLayout {
  /** Crescendo = opens rightward; Diminuendo = closes rightward */
  direction: 'Crescendo' | 'Diminuendo';
  /** Left endpoint x coordinate (logical units) */
  x_start: number;
  /** Right endpoint x coordinate (logical units) */
  x_end: number;
  /** Vertical center y coordinate (logical units, same baseline as dynamic glyphs) */
  y_center: number;
  /** Half the opening width (logical units, default 20 = 1 staff space) */
  opening: number;
  /** True = this segment is a right-side continuation from a previous system */
  continues_left: boolean;
  /** True = this hairpin continues onto the next system; right end is open */
  continues_right: boolean;
}
```

---

## State Transitions

Dynamic markings have no state transitions. They are immutable once computed: `DynamicMarking` at a given tick stays in effect until the next `DynamicMarking` on the same staff (this is the playback model and is not a concern for layout). The layout engine renders each marking independently at its tick position.

A `GradualDynamic` starting at tick T and ending at tick T' is always rendered as one or two `HairpinLayout` entries depending on whether the range crosses a system break.

---

## Bravura Metadata Extension

The file `backend/assets/bravura_metadata.json` must be extended with bounding box entries for all 8 dynamic glyph names in the `glyphBBoxes` object. Values are in staff-space units at 1em scale (standard Bravura 1.396 values):

```json
{
  "glyphBBoxes": {
    "dynamicPPP":    { "bBoxSW": [-0.036, -0.576], "bBoxNE": [2.244, 0.216] },
    "dynamicPP":     { "bBoxSW": [-0.036, -0.576], "bBoxNE": [1.512, 0.216] },
    "dynamicPiano":  { "bBoxSW": [-0.036, -0.576], "bBoxNE": [0.780, 0.216] },
    "dynamicMP":     { "bBoxSW": [-0.036, -0.576], "bBoxNE": [1.476, 0.216] },
    "dynamicMF":     { "bBoxSW": [-0.036, -0.576], "bBoxNE": [1.332, 0.216] },
    "dynamicForte":  { "bBoxSW": [-0.036, -0.576], "bBoxNE": [0.636, 0.216] },
    "dynamicFF":     { "bBoxSW": [-0.036, -0.576], "bBoxNE": [1.248, 0.216] },
    "dynamicFFF":    { "bBoxSW": [-0.036, -0.576], "bBoxNE": [1.980, 0.216] }
  }
}
```
