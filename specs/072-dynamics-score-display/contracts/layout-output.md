# Layout Output Contract: Dynamics

**Feature**: 072-dynamics-score-display  
**Date**: 2026-04-04  
**Contract Type**: WASM output contract (Rust layout engine → TypeScript renderer)

This document defines the contract between the Rust layout engine (producer) and the TypeScript SVG renderer (consumer) for dynamic markings (static symbols and hairpins). The renderer MUST treat this contract as read-only — it MUST NOT derive, modify, or recalculate any spatial values from these structures.

---

## Context

The WASM layout output contract is defined by:
- **Rust producer**: `backend/src/layout/types.rs` (`Staff`, `DynamicGlyph`, `HairpinLayout`)
- **TypeScript consumer**: `frontend/src/wasm/layout.ts` (mirror interfaces)
- **Serialisation**: JSON via `serde_json` / `JSON.parse`
- **Entry point**: `compute_layout(score_json) -> GlobalLayout` (WASM export `layout_generate`)

---

## GlobalLayout (extended)

The pre-existing `GlobalLayout → System → StaffGroup → Staff` hierarchy is extended. Only the new fields added by this feature are documented here. All pre-existing fields are unchanged and stable.

```
GlobalLayout
└── systems: System[]
    └── staff_groups: StaffGroup[]
        └── staves: Staff[]
            ├── dynamic_glyphs?: DynamicGlyph[]   ← NEW
            └── hairpin_layouts?: HairpinLayout[]  ← NEW
```

Both new fields are **optional** (`skip_serializing_if = "Vec::is_empty"`) and default to `[]` when absent. Consumers MUST handle both absent fields and empty arrays gracefully.

---

## DynamicGlyph Contract

A single positioned dynamic level symbol.

```
DynamicGlyph {
  codepoint:    string       // SMuFL Unicode char, e.g. "\uE520".
                             // Empty string "" → render as italic fallback text (see label).
  label:        string       // Fallback text. Only meaningful when codepoint === "".
                             // Value is always "dyn" in this version.
  x:            number       // Absolute x in logical units. Left edge of glyph.
                             // Invariant: x ≥ 0
  y:            number       // Absolute y in logical units. Glyph baseline.
                             // Invariant: y > staff_lines[4].y_position  (below staff)
  font_size:    number       // Always 80.0. Consumer MUST use this value.
  bounding_box: BoundingBox  // Pre-computed bbox in logical units.
                             // Consumer MUST NOT recompute.
}
```

### Consumer rendering contract

| Condition | Rendering action |
|-----------|-----------------|
| `codepoint !== ""` | Render as SVG `<text>` using Bravura font at `font_size`, positioned at `(x, y)`. Use `dominant-baseline="auto"` (positioned at baseline). |
| `codepoint === ""` | Render as SVG `<text>` at `(x, y)` with `font-style: italic`, `font-family: serif`, `font-size: font_size * 0.5`. Text content = `label`. |

### Producer invariants (layout engine guarantees)

- `y` is always `staff_bottom_line_y + 2 * units_per_space` (2 staff spaces below bottom staff line)
- `x` is derived from the `note_positions` map at `DynamicMarking.start_tick`
- `font_size` is always `80.0`
- `dynamic_glyphs` contains exactly one entry per `DynamicMarking` in the system's tick range for this staff
- Ordering: entries are sorted by ascending `x` (i.e. left to right)

---

## HairpinLayout Contract

A single pre-computed hairpin wedge segment. One `DynamicGlyph` source may produce 1 or 2 `HairpinLayout` entries when a hairpin spans a system line break.

```
HairpinLayout {
  direction:       'Crescendo' | 'Diminuendo'
  x_start:         number   // Left x endpoint (logical units). x_start < x_end.
  x_end:           number   // Right x endpoint (logical units).
  y_center:        number   // Vertical center (logical units). Same row as DynamicGlyph.y.
  opening:         number   // Half the opening spread (logical units). Default: 20.0 (1 staff space).
  continues_left:  boolean  // True → this is a system-continuation segment.
                            // The left end is at the system left margin; do not draw inward stroke.
  continues_right: boolean  // True → hairpin continues on the next system.
                            // The right end is at system_end_x; do not draw inward stroke.
}
```

### Consumer rendering contract

The renderer derives four endpoints from a `HairpinLayout` and draws two `<line>` elements:

**Crescendo** (`direction === 'Crescendo'`):
```
point    = (x_start, y_center)               // narrow end
top_open = (x_end, y_center - opening / 2)  // top arm open end
bot_open = (x_end, y_center + opening / 2)  // bottom arm open end

Line 1: point → top_open
Line 2: point → bot_open
```

**Diminuendo** (`direction === 'Diminuendo'`):
```
top_open = (x_start, y_center - opening / 2)  // top arm open end
bot_open = (x_start, y_center + opening / 2)  // bottom arm open end
point    = (x_end, y_center)                   // narrow end

Line 1: top_open → point
Line 2: bot_open → point
```

**Cross-system continuation**:
- When `continues_right === true`: do not draw the closing stroke at the narrow end (for crescendo at right side; for diminuendo there is no narrow end at the right side). The hairpin terminates at `x_end` in an open state.
- When `continues_left === true`: the hairpin starts at `x_start` already open (for diminuendo). No additional inward stroke at the left end.

**Stroke attributes**: `stroke = config.staffLineColor`, `stroke-width = 1.5`, `fill = none`.

### Producer invariants (layout engine guarantees)

- `x_start < x_end`
- `y_center === staff_bottom_line_y + 2 * units_per_space` (same row as dynamic glyphs)
- `opening === units_per_space` (1 staff space = 20 logical units at default scale)
- For a hairpin entirely within one system: `continues_left = false`, `continues_right = false`
- For the first segment of a cross-system hairpin: `continues_right = true`
- For the continuation segment: `continues_left = true`
- Hairpins with `stop_tick` not found in `note_positions` are clipped to the system end x

---

## Versioning

This contract is implicitly versioned by `ScoreDto` DTO version. Dynamic layout fields first appear in DTO v12 (dynamics arrays in `ScoreDto`). The layout output is forward-only; existing `GlobalLayout` consumers that do not reference `dynamic_glyphs` or `hairpin_layouts` are unaffected.

---

## Test Coverage Requirements (Principle V)

Contract tests MUST verify:
1. A score with static dynamics produces `dynamic_glyphs` in the correct `Staff`
2. A score with hairpins produces `hairpin_layouts` in the correct `Staff`
3. A score with no dynamics produces empty/absent `dynamic_glyphs` and `hairpin_layouts`
4. A hairpin spanning a system break produces exactly 2 `HairpinLayout` entries with correct `continues_right`/`continues_left` flags
5. `DynamicGlyph.y` is exactly `staff_bottom_line_y + 2 * units_per_space` for every emitted glyph
6. All `dynamic_glyphs` within a staff are sorted by ascending `x`
