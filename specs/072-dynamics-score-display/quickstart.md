# Quickstart: Music Dynamics Score Display (072)

**Feature**: 072-dynamics-score-display  
**Worktree**: `../worktrees/072-dynamics-score-display`

## What This Feature Does

Adds visual rendering of music dynamic markings (ppp through fff and hairpin crescendo/diminuendo) to the score layout and SVG renderer. Dynamic data is already parsed and used for audio playback. This feature makes it visible in the score.

## Architecture Overview

```
MusicXML file
      ↓
  Importer (Rust) ── already parses DynamicMarking + GradualDynamic
      ↓
  ScoreDto  ── already carries dynamics[] + gradual_dynamics[]
      ↓
  compute_layout() [WASM / Rust]
      ↓ NEW: reads dynamics from score JSON, calls render_dynamics()
  GlobalLayout  ── Staff now has dynamic_glyphs[] + hairpin_layouts[]
      ↓
  RenderingPipeline.ts [TypeScript]
      ↓ NEW: renderDynamics() draws glyphs + hairpin SVG lines
  SVG output
```

## Key Files to Change

| File | Change |
|------|--------|
| `backend/src/layout/dynamics.rs` | **NEW** — `render_dynamics()` function |
| `backend/src/layout/types.rs` | ADD `DynamicGlyph`, `HairpinLayout`, extend `Staff` |
| `backend/src/layout/mod.rs` | CALL `render_dynamics()` in per-staff loop |
| `backend/assets/bravura_metadata.json` | ADD 8 dynamic glyph bbox entries |
| `frontend/src/wasm/layout.ts` | ADD `DynamicGlyph`, `HairpinLayout` interfaces, extend `Staff` |
| `frontend/src/components/renderer/RenderingPipeline.ts` | ADD `renderDynamics()` call in `renderStaff()` |

## Key Conventions to Follow

- **Layout engine authority (Principle VI)**: All x/y coordinates are computed in Rust. The TypeScript renderer only draws what it receives — it MUST NOT compute or adjust positions.
- **1 staff space = 20 logical units** at default `units_per_space = 20.0`
- **Dynamic baseline y** = `staff_vertical_offset + 4 * units_per_space + 2 * units_per_space`  
  = `staff_vertical_offset + 6 * units_per_space`  
  (2 staff spaces below the bottom staff line)
- **Font size** = `80.0` (SMuFL standard, same as all other notation glyphs)
- **Hairpin stroke-width** = `1.5` (same as `STAFF_LINE_STROKE_WIDTH`)
- **Backward compatibility**: both new `Staff` fields use `#[serde(default, skip_serializing_if = "Vec::is_empty")]` — existing tests are unaffected

## SMuFL Codepoints

| Level | Glyph Name | Codepoint |
|-------|-----------|-----------|
| ppp | `dynamicPPP` | `\uE52A` |
| pp | `dynamicPP` | `\uE52B` |
| p | `dynamicPiano` | `\uE520` |
| mp | `dynamicMP` | `\uE52C` |
| mf | `dynamicMF` | `\uE52D` |
| f | `dynamicForte` | `\uE522` |
| ff | `dynamicFF` | `\uE52F` |
| fff | `dynamicFFF` | `\uE530` |

## Test-First Checklist (Principle V)

Before writing any implementation:

1. [ ] Write `backend/tests/dynamics_layout_test.rs` with failing tests for:
   - Static marking `p` appears in `Staff.dynamic_glyphs` at correct tick position
   - Crescendo hairpin appears in `Staff.hairpin_layouts`
   - Hairpin spanning system break produces 2 entries with correct flags
   - Score with no dynamics → no `dynamic_glyphs`, no `hairpin_layouts`
   - `DynamicGlyph.y` equals `staff_bottom_y + 2 * units_per_space`

2. [ ] Write `RenderingPipeline.test.ts` tests for:
   - `DynamicGlyph` with valid codepoint renders Bravura `<text>` element
   - `DynamicGlyph` with empty codepoint renders italic fallback `<text>`
   - Crescendo hairpin produces 2 `<line>` elements with correct endpoints
   - Diminuendo hairpin produces 2 `<line>` elements with correct endpoints

## Build & Run

```bash
# Backend tests (from worktree root)
cd backend
cargo test dynamics

# Frontend tests
cd frontend
npm test -- RenderingPipeline

# Full build
cd backend && cargo build --target wasm32-unknown-unknown
cd frontend && npm run build
```

## Related Docs

- [spec.md](spec.md) — requirements and acceptance criteria
- [research.md](research.md) — SMuFL names, layout decisions
- [data-model.md](data-model.md) — full type definitions
- [contracts/layout-output.md](contracts/layout-output.md) — WASM output contract
