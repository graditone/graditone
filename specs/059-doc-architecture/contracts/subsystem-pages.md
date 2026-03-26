# Contract: Subsystem Architecture Pages

**Feature**: 059-doc-architecture

---

## Common Template

Every subsystem page MUST follow this structure:

```markdown
# {Subsystem Name}

## Overview
[One paragraph: what this subsystem does, its role in the system]

## Architecture
[Mermaid diagram at module-level detail]

## Modules
[Table or sections describing each named module in the diagram]

## Data Flow
[Description of input → processing → output with types]

## Key Files
[Table mapping module names to file paths]

## See Also
[Links to related subsystem pages and architecture overview]
```

---

## Page Specifications

### 1. Frontend PWA (`docs/frontend-pwa.md`)

**Diagram focus**: React component hierarchy + service layer + PWA infrastructure

**Required nodes**:
- App (entry point)
- Pages: LandingScreen, ScoreViewer (LayoutView)
- Components: LayoutRenderer, StaffNotation, ScoreViewer controls
- Services: PlaybackScheduler, MusicXMLImportService, WASM loader
- Hooks: useScore, usePlayback
- PWA: Service Worker, IndexedDB, Manifest
- Plugin Host: PluginStaffViewer

**Data flow**: User action → React component → Service → WASM/Storage → Component update

**Key files**: `frontend/src/App.tsx`, `frontend/src/pages/`, `frontend/src/services/`, `frontend/src/components/`

---

### 2. Rust/WASM Engine (`docs/wasm-engine.md`)

**Diagram focus**: Hexagonal architecture (ports & adapters) + WASM compilation

**Required nodes**:
- Core Domain: Score, Instrument, Staff, Voice, Note, Events
- Ports: IMusicXMLImporter, IRepository
- Adapters: REST API (Axum), CLI, WASM bindings
- Layout Module (reference to detail page)
- Importer Module (reference to detail page)

**Data flow**: External input → Adapter → Port → Domain logic → Port → Adapter → External output

**Key files**: `backend/src/domain/`, `backend/src/ports/`, `backend/src/adapters/`, `backend/src/layout/wasm.rs`

---

### 3. Layout Engine (`docs/layout-engine.md`)

**Diagram focus**: Processing pipeline stages

**Required nodes**:
- Extraction (extraction.rs): Score JSON → typed internal data
- Spacing (spacer.rs): Time-proportional horizontal spacing
- Breaking (breaker.rs): Line-breaking into systems
- Positioning (positioner.rs): Absolute (x,y) coordinates
- NoteLayout (note_layout.rs): Notehead, accidental, dot, stem glyphs
- Structural (structural.rs): Clefs, key signatures, time signatures
- Annotations (annotations.rs): Ties, slurs, ledger lines
- Barlines (barlines.rs): Barline positioning
- Batching (batcher.rs): GlyphRun optimization
- Assembly (assembly.rs): Staff lines, bounding boxes

**Data flow**: `CompiledScore JSON` → extraction → spacing → breaking → positioning → structural → annotations → barlines → batching → assembly → `GlobalLayout JSON`

**Key files**: `backend/src/layout/` (all modules)

---

### 4. SVG Renderer (`docs/svg-renderer.md`)

**Diagram focus**: Two-tier render model + virtualization strategy

**Required nodes**:
- LayoutRenderer (main orchestrator)
- RenderingPipeline (SVG generation)
- HighlightController (incremental highlight updates via rAF)
- InteractionHandler (click delegation, note selection)
- LoopOverlayRenderer (loop region rendering)
- renderUtils (viewport queries, SVG helpers)
- RenderConfig (theme configuration)

**Data flow**: `GlobalLayout JSON` → viewport query → system virtualization → SVG DOM generation → highlight patching → browser rendering

**Key files**: `frontend/src/components/LayoutRenderer.tsx`, `frontend/src/components/renderer/`, `frontend/src/utils/renderUtils.ts`

---

### 5. Plugin System (`docs/plugin-system.md`)

**Diagram focus**: Plugin API v4 lifecycle + built-in plugin examples

**Required nodes**:
- Plugin Host (PluginStaffViewer)
- Plugin API v4 (types.ts, index.ts)
- ScorePlayerContext (score data provider)
- MetronomeContext (timing provider)
- Built-in plugins: play-score, virtual-keyboard, train-view, guide, practice-view-plugin
- Plugin ZIP distribution (importable plugins)

**Data flow**: Host loads plugin → Plugin registers via API → Host provides score data and events → Plugin renders custom view

**Key files**: `frontend/src/plugin-api/`, `frontend/plugins/`

---

### 6. MusicXML Importer (`docs/musicxml-importer.md`)

**Diagram focus**: Three-layer import pipeline (parser → converter → domain)

**Required nodes**:
- CompressionHandler (compression.rs): .mxl/.xml detection
- MusicXMLParser (parser.rs): XML → MusicXMLDocument
- MusicXMLConverter (converter.rs): MusicXMLDocument → Score
- Mapper (mapper.rs): MusicXML values → domain enums
- Timing (timing.rs): Lossless fraction-based PPQ conversion
- Errors (errors.rs): Warning/error categorization
- ImportContext (mod.rs): Warning accumulation
- VoiceDistributor: Overlapping note resolution

**Data flow**: `.mxl/.xml` → decompress → parse XML → intermediate `MusicXMLDocument` → convert → `Score` (domain entity) + `ImportResult` (metadata, warnings, statistics)

**Key files**: `backend/src/domain/importers/musicxml/`

---

## README.md Contract

### Required Changes

1. **Replace "tablet-native"** with "tablet-first" in all occurrences (overview paragraph, badges area)
2. **Add Mermaid diagram** — simplified version of `docs/architecture.md` overview diagram (≤ 8 nodes)
3. **Add feature highlights section** — concise bullets linking to FEATURES.md and PLUGINS.md
4. **Remove "Implementation Progress" section** entirely
5. **Add iOS Safari MIDI note** — in Quick Start or Platform Support area
6. **Add PWA update process** — explain that users refresh browser to get updates
7. **Move play view gestures** — below overview section (not at very top)
8. **Add link to `docs/architecture.md`** — in Documentation section
9. **Update "Constitutional Principles"** — include Principle VI (Layout Engine Authority) and VII (Regression Prevention)
