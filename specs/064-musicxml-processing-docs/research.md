# Research: MusicXML Processing Reference Documentation

**Feature**: 064-musicxml-processing-docs  
**Date**: 2026-03-29  
**Status**: Complete

## Research Tasks & Findings

### RT-1: Exact Rust Domain Model Struct Definitions

**Task**: Extract verbatim struct definitions for documentation inline excerpts (per Clarification Q1: Option A).

**Decision**: All key structs verified from current source. Excerpts will be included inline in the reference document.

**Findings**:

| Struct | File | Key Fields |
|--------|------|------------|
| `Score` | `backend/src/domain/score.rs` | instruments, global_structural_events, repeat_barlines, volta_brackets, pickup_ticks, octave_shift_regions, difficulty_rating, phrases, dynamics, gradual_dynamics |
| `Instrument` | `backend/src/domain/instrument.rs` | id, name, instrument_type, staves |
| `Staff` | `backend/src/domain/staff.rs` | id, staff_structural_events, voices |
| `Voice` | `backend/src/domain/voice.rs` | id, interval_events (Vec<Note>), rest_events |
| `Note` | `backend/src/domain/events/note.rs` | id, start_tick, duration_ticks, pitch, spelling, beams, staccato, dot_count, tie_next, is_tie_continuation, slur_next, is_grace, has_explicit_accidental, stem_down, fingering, velocity |
| `NoteSpelling` | `backend/src/domain/value_objects.rs` | step (char), alter (i8: -1/0/1) |
| `DynamicLevel` | `backend/src/domain/events/dynamics.rs` | PPP, PP, P, MP, MF, F, FF, FFF |
| `DynamicMarking` | `backend/src/domain/events/dynamics.rs` | marking, velocity, start_tick, staff |
| `GradualDynamic` | `backend/src/domain/events/dynamics.rs` | direction, start_tick, stop_tick, staff, number |
| `RepeatBarline` | `backend/src/domain/repeat.rs` | measure_index, start_tick, end_tick, barline_type |
| `VoltaBracket` | `backend/src/domain/repeat.rs` | number, start/end_measure_index, start/end_tick, end_type |
| `OctaveShiftRegion` | `backend/src/domain/score.rs` | start_tick, end_tick, display_shift, staff_index |
| `PhraseRegion` | `backend/src/domain/phrases.rs` | instrument_index, start/end_measure, start/end_tick |

### RT-2: WASM Bridge Exported Functions

**Task**: Document all `#[wasm_bindgen]` exports for the WASM bridge section.

**Decision**: 12+ exported functions found in `backend/src/adapters/wasm/bindings.rs`.

**Key exports**:

| Function | Input → Output |
|----------|----------------|
| `parse_musicxml(xml_content: &str)` | MusicXML string → `ImportResult` (Score + metadata + warnings) |
| `compute_layout_wasm(score_json, config_json)` | CompiledScore JSON + LayoutConfig → GlobalLayout JSON |
| `get_schema_version()` | — → u32 (current: 12) |
| `create_score()` | — → empty Score (120 BPM, 4/4) |
| `add_instrument(score_js, name)` | Score + name → updated Score |
| `add_staff(score_js, instrument_id)` | Score + instrument UUID → updated Score |
| `add_voice(score_js, staff_id)` | Score + staff UUID → updated Score |
| `add_note(score_js, voice_id, note_js)` | Score + voice UUID + Note → updated Score |
| `add_tempo_event(score_js, tick, bpm)` | Score + position + BPM → updated Score |
| `add_time_signature_event(score_js, tick, num, den)` | Score + position + signature → updated Score |
| `add_clef_event(score_js, staff_id, tick, clef_type)` | Score + staff + clef → updated Score |
| `add_key_signature_event(score_js, staff_id, tick, key)` | Score + staff + key → updated Score |

### RT-3: Frontend Playback Pipeline

**Task**: Document how notes flow from Score to audio output.

**Decision**: Playback uses a windowed scheduling architecture with tie resolution and dynamics-based velocity.

**Findings**:

- **Tie Resolution**: `TieResolver.ts` merges `is_tie_continuation` notes into single playback events with accumulated duration
- **Repeat Expansion**: `RepeatNoteExpander.ts` expands flat Note[] into repeat-stretched sequence before scheduling
- **Windowed Scheduling**: 10-second lookahead + 4-second refill loop prevents Tone.js timeline bloat
- **Timing Formula**: `seconds = ticks / (tempo/60 × 960)`
- **Staccato**: Duration halved (0.5×) with minimum 50ms floor
- **Velocity**: `Note.velocity` (1–127) from DynamicsResolver; default 80 (mf) if absent
- **Audio**: Salamander Grand Piano samples via Tone.Sampler; PolySynth fallback

### RT-4: Layout Engine Pipeline Stages

**Task**: Document the 11-stage Rust layout pipeline for the layout section.

**Decision**: Stages verified from `backend/src/layout/mod.rs`.

**Stages**: extraction → spacing → breaking → positioning → note_layout → structural → beams → stems → annotations → barlines → batching → assembly

**Key output**: `GlobalLayout` JSON with systems → staff_groups → staves → glyph_runs → glyphs (SMuFL codepoints with x,y positions and source_references back to Note IDs)

### RT-5: SVG Rendering Architecture

**Task**: Document the two-tier rendering model and viewport virtualization.

**Findings**:

- **Full Render Pass**: `RenderingPipeline.renderAll()` — rebuilds SVG DOM; triggered on layout/config changes
- **Incremental Highlight Pass**: `HighlightController` — rAF loop updating fill/opacity on `data-note-id` elements for playback cursor
- **Viewport Virtualization**: `getVisibleSystems()` binary-searches system bounding boxes; only visible systems get SVG elements
- **GlyphRun Rendering**: `<g>` element per GlyphRun → `<text>` elements with SMuFL codepoints + transparent `<rect>` hit overlays

### RT-6: Implementation Status Matrix

**Task**: Determine parsing/rendering/playback status for each musical feature (per Clarification Q2: Option B).

**Decision**: Consolidated status matrix with exact implementation state.

| Feature | Parsed | Rendered | Played Back | Notes |
|---------|--------|----------|-------------|-------|
| Notes (pitch/duration) | ✅ | ✅ | ✅ | Complete |
| Accidentals (♯/♭/♮) | ✅ | ✅ | ✅ (via pitch) | Enharmonic spelling preserved in NoteSpelling |
| Staccato | ✅ | ✅ | ✅ (0.5× duration) | Complete |
| Ties | ✅ | ✅ (TieArc) | ✅ (merged) | TieResolver merges into single event |
| Slurs | ✅ | ✅ (SlurArc) | ❌ | No phrasing effect on playback |
| Beams | ✅ | ✅ | N/A | Display-only (grouping indicator) |
| Grace notes | ✅ | ✅ (smaller glyph) | ❓ Undocumented | Layout respects; playback behavior TBD |
| Dynamics (pp–fff) | ✅ | ❌ (no text glyph) | ✅ (velocity) | Feature 063: velocity mapping |
| Crescendo/Diminuendo | ✅ | ❌ (no wedge glyph) | ✅ (interpolated) | Feature 063: linear interpolation |
| Repeat barlines | ✅ | ✅ | ✅ | RepeatNoteExpander handles playback |
| Volta brackets | ✅ | ✅ | ✅ | Volta-aware repeat expansion |
| Octave shifts (8va/8vb) | ✅ | ✅ | ❌ | Display-only; no playback transposition |
| Key signatures | ✅ | ✅ | N/A | No playback effect |
| Time signatures | ✅ | ✅ | N/A | Used in layout only |
| Tempo markings | ✅ | ❌ (no glyph) | ✅ | TempoEvent drives Transport |
| Fingering | ✅ | ✅ | N/A | Display-only annotation |
| Phrases | Backend-detected | ✅ (color bands) | ❌ | Feature 062: structural detection |
| Rests | ✅ | ✅ | N/A | Silence (no sound scheduled) |

### RT-7: Schema Versioning & Cache Invalidation

**Task**: Document how frontend validates cached scores.

**Findings**:

- `SCORE_SCHEMA_VERSION` constant in `dtos.rs` = 12 (current)
- `get_schema_version()` WASM export returns this value
- Frontend compares cached `score.schema_version` against WASM value
- If cached < current → invalidate cache, re-import from MXL
- Version history: v2 (clef) → v4 (repeats) → v5 (rests) → v6 (pickup) → v7 (volta) → v8 (octave shifts) → v9 (fingering) → v10 (difficulty) → v11 (phrases) → v12 (dynamics)

### RT-8: Existing Documentation Integration Points

**Task**: Identify cross-reference targets in existing docs.

**Findings**:

| Existing Doc | Covers | Cross-reference From |
|-------------|--------|---------------------|
| `docs/architecture.md` | High-level system overview | New doc's introduction |
| `docs/musicxml-importer.md` | Three-layer import pipeline detail | Import section deep dive |
| `docs/layout-engine.md` | 11-stage layout pipeline detail | Layout section deep dive |
| `docs/svg-renderer.md` | SVG rendering detail | Rendering section deep dive |
| `docs/wasm-engine.md` | WASM bridge detail | WASM section deep dive |
| `docs/frontend-pwa.md` | PWA shell, offline, caching | Cache/offline context |

**architecture.md update needed**: Add row to Components table and/or See Also link for the new document.
