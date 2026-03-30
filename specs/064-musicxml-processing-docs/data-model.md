# Data Model: MusicXML Processing Reference Document Structure

**Feature**: 064-musicxml-processing-docs  
**Date**: 2026-03-29

## Document Entity: `docs/musicxml-processing.md`

This is a documentation-only feature. The "data model" describes the structure of the reference document to be created.

## Document Outline

### Section 1: Overview
- Purpose statement (decision-support reference for the MusicXML processing pipeline)
- High-level data flow diagram (Mermaid): MusicXML → Import → Domain Model → Layout → Rendering + Playback
- Cross-reference links to existing docs
- Maintenance note referencing `docs/doc-update-checklist.md`

### Section 2: MusicXML Import Pipeline
- Three-layer architecture: Compression → Parser → Converter
- Module reference table (compression.rs, parser/mod.rs, converter/mod.rs, mapper.rs, timing.rs, errors.rs)
- Key intermediate type: `MusicXMLDocument`
- Import result: `WasmImportResult` (score, metadata, statistics, warnings, partial_import)
- Link to: `docs/musicxml-importer.md`

### Section 3: Domain Model
- Hierarchy diagram: Score → Instrument → Staff → Voice → Note
- Inline Rust struct excerpts for: Score, Instrument, Staff, Voice, Note, NoteSpelling
- Key value objects: Tick (960 PPQ), Pitch (MIDI 0–127), BPM, Clef, KeySignature
- Structural data: RepeatBarline, VoltaBracket, OctaveShiftRegion, PhraseRegion
- Dynamics data: DynamicLevel, DynamicMarking, GradualDynamic
- DTO layer: ScoreDto, schema versioning (v1–v12), cache invalidation
- Link to: `docs/wasm-engine.md`

### Section 4: WASM Bridge
- Exported function table (12 functions with signatures)
- JSON serialization: Score ↔ CompiledScore JSON, LayoutConfig → GlobalLayout JSON
- Schema version constant and cache invalidation flow
- WASM loader initialization (lazy import, deduplication)
- Link to: `docs/wasm-engine.md`

### Section 5: Layout Engine
- 11-stage pipeline table (extraction → assembly)
- Input: CompiledScore JSON + LayoutConfig
- Output: GlobalLayout JSON structure (System → StaffGroup → Staff → GlyphRun → Glyph)
- Coordinate system: logical units, Y-downward, origin top-left
- GlyphRun batching optimization (80–90% DOM reduction)
- SMuFL font standard (Bravura)
- Link to: `docs/layout-engine.md`

### Section 6: SVG Rendering
- Two-tier model: Full Render Pass + Incremental Highlight Pass
- Viewport virtualization (binary search on system bounding boxes)
- GlyphRun → SVG `<text>` + `<rect>` hit overlay
- Click-to-note interaction flow
- Link to: `docs/svg-renderer.md`

### Section 7: Playback Pipeline
- Pipeline flow: Score → Repeat Expansion → Tie Resolution → Windowed Scheduling → Audio
- Timing conversion: ticks → seconds formula (960 PPQ)
- Staccato duration halving (0.5×, minimum 50ms)
- Velocity handling: DynamicMarking → Note.velocity → Tone.Sampler gain
- Gradual dynamics: linear interpolation between tick ranges
- Audio source: Salamander Grand Piano samples with PolySynth fallback

### Section 8: Musical Feature Focus — Accidentals
- MusicXML parsing: `<pitch><step>D</step><alter>1</alter></pitch>` + `<accidental>sharp</accidental>`
- Domain storage: `Note.pitch` (MIDI), `Note.spelling` (NoteSpelling: step + alter), `Note.has_explicit_accidental`
- Layout: SMuFL codepoints (U+E260 flat, U+E261 natural, U+E262 sharp) positioned left of notehead
- Rendering: standard glyph rendering via GlyphRun
- Playback: accidentals affect pitch (already encoded in MIDI pitch value)

### Section 9: Musical Feature Focus — Dynamics & Velocity
- MusicXML parsing: `<direction><dynamics><mf/></dynamics></direction>`, `<wedge type="crescendo"/>`
- Domain storage: `DynamicMarking` (level + velocity + tick + staff), `GradualDynamic` (direction + tick range)
- Velocity computation: DynamicLevel → MIDI velocity (PPP=16, PP=33, ..., FFF=127)
- Gradual interpolation: linear between start_tick and stop_tick
- Playback: `Note.velocity` passed to Tone.Sampler gain

### Section 10: Implementation Status Matrix
- Feature × Pipeline stage matrix (Parsed | Rendered | Played Back)
- Status indicators: ✅ Implemented, ⚠️ Partial, ❌ Not implemented, N/A
- Covers all 18 musical features from research

### Section 11: Key Files Reference
- Backend files table (module → file path → purpose)
- Frontend files table (module → file path → purpose)

## Cross-Reference Links (Outgoing)

| From Section | To Document | Purpose |
|-------------|-------------|---------|
| Overview | `docs/architecture.md` | System context |
| Import Pipeline | `docs/musicxml-importer.md` | Deep dive |
| Layout Engine | `docs/layout-engine.md` | Deep dive |
| SVG Rendering | `docs/svg-renderer.md` | Deep dive |
| WASM Bridge | `docs/wasm-engine.md` | Deep dive |
| Maintenance | `docs/doc-update-checklist.md` | Update trigger |

## Cross-Reference Links (Incoming — requires edit)

| From Document | Section | Edit Required |
|---------------|---------|---------------|
| `docs/architecture.md` | Components table | Add row for "MusicXML Processing Pipeline" |
| `docs/architecture.md` | See Also | Add link to `musicxml-processing.md` |
