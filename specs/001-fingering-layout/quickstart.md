# Quickstart: Fingering Support from MusicXML to Scores Layout

**Branch**: `001-fingering-layout`  
**Date**: 2026-03-22

---

## What this feature adds

Display of fingering numerals (1–5) from MusicXML source files in the rendered score. The pipeline from parsing to rendering is extended at 9 specific touch-points across 6 files — all additive changes, no existing behaviour is modified.

---

## Repository layout (touch-points only)

```
backend/src/
  domain/importers/musicxml/
    types.rs       — add FingeringAnnotation struct + NoteData.fingering
    parser.rs      — add parse_technical() function
    converter.rs   — map NoteData.fingering → Note.fingering in convert_note()
  domain/events/
    note.rs        — add Note.fingering + with_fingering() builder
  layout/
    types.rs       — add FingeringGlyph struct + Staff.fingering_glyphs
    extraction.rs  — add NoteEvent.fingering + JSON deserialization
    annotations.rs — add render_fingering_glyphs() + AnnotationResult.fingering_glyphs
    mod.rs         — wire ann.fingering_glyphs into Staff{}

backend/tests/
  fingering_layout_test.rs   — NEW integration tests

frontend/src/
  wasm/layout.ts             — add FingeringGlyph interface + Staff.fingering_glyphs
  components/LayoutRenderer.tsx — render <text> elements for fingering_glyphs
```

---

## Development workflow

### 1. Run existing tests (baseline)

```bash
cd backend && cargo test 2>&1 | tail -5
```

All tests should pass before starting.

### 2. Implementation order (dependency-ordered)

Follow this exact sequence — each step compiles cleanly before the next:

1. **`types.rs` (musicxml)** — Add `FingeringAnnotation` struct and `NoteData.fingering` field
2. **`parser.rs`** — Add `parse_technical()` and wire it into `parse_notations`
3. **`note.rs`** — Add `Note.fingering` and `with_fingering()` builder
4. **`converter.rs`** — Map `note_data.fingering` → `note.with_fingering(...)` in `convert_note`
5. **`types.rs` (layout)** — Add `FingeringGlyph` and `Staff.fingering_glyphs`
6. **`extraction.rs`** — Add `NoteEvent.fingering` and JSON deserialization
7. **`annotations.rs`** — Add `AnnotationResult.fingering_glyphs` and implement `render_fingering_glyphs()`
8. **`mod.rs`** — Add `fingering_glyphs: ann.fingering_glyphs` to `Staff {}` constructor
9. **`layout.ts`** — Add `FingeringGlyph` interface and `Staff.fingering_glyphs?`
10. **`LayoutRenderer.tsx`** — Add `<text>` rendering loop for `fingering_glyphs`

### 3. Write tests before step 2 (test-first, Principle V)

Create `backend/tests/fingering_layout_test.rs` with failing tests **before** implementing step 2:

```bash
# Create empty test file and run — tests will fail (as expected)
touch backend/tests/fingering_layout_test.rs
cat >> backend/tests/fingering_layout_test.rs << 'EOF'
// Test bodies are in contracts/fingering-glyph.rust.md
EOF
cd backend && cargo test fingering 2>&1
```

### 4. Verify at each seam

After step 4 (converter), test the parser produces fingering on the domain Note:

```bash
cd backend && cargo test parse_fingering 2>&1
```

After step 8 (mod.rs), test the full pipeline produces FingeringGlyphs in layout output:

```bash
cd backend && cargo test fingering_layout 2>&1
```

### 5. Build WASM and verify frontend

```bash
cd backend && wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg

cd ../frontend && npm run build
# Open the app and load Chopin_NocturneOp9No2.mxl
# Verify fingering numerals appear in the score
```

---

## Key test fixtures

| Fixture | Location | Content |
|---------|----------|---------|
| `Les Fleurs Sauvages.musicxml` | `backend/music/` | Has `<fingering placement="below">5</fingering>` — primary parser test |
| `Chopin_NocturneOp9No2.mxl` | `scores/` | Extensive fingering in treble + bass staves — acceptance test |

---

## Acceptance checklist

- [ ] `cargo test` passes — zero regressions on existing tests
- [ ] `cargo test fingering` passes — parser extracts fingering from Les Fleurs Sauvages
- [ ] `cargo test fingering_layout` passes — layout output contains correct FingeringGlyphs
- [ ] Visual check: Chopin Nocturne displays finger numerals at the correct noteheads
- [ ] Visual check: scores without `<fingering>` render identically to before
- [ ] `npm run test` passes — frontend unit tests (if written)

---

## Key design references

| Document | Purpose |
|----------|---------|
| `research.md` | All design decisions with rationale |
| `data-model.md` | Entity relationships and positioning formulas |
| `contracts/fingering-glyph.rust.md` | Exact Rust struct definitions to implement |
| `contracts/fingering-glyph.ts.md` | Exact TypeScript interfaces and rendering code |

---

## Constitution compliance notes

- **Principle V (Test-First)**: Write `fingering_layout_test.rs` with failing tests before implementing the parser change.
- **Principle VI (Layout Engine Authority)**: All `(x, y)` position computation is in `render_fingering_glyphs()` (Rust). `LayoutRenderer.tsx` only reads pre-computed values.
- **Principle VII (Regression Prevention)**: The zero-regression test (SC-003) must be included in `fingering_layout_test.rs` to prevent future spacing regressions.
