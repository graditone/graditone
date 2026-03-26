# Research: Documentation Architecture

**Feature**: 059-doc-architecture  
**Date**: 2026-03-26  
**Status**: Complete

---

## R1: GitHub Mermaid Rendering Capabilities

**Decision**: Use GitHub-native Mermaid fenced code blocks (` ```mermaid `) for all architecture diagrams.

**Rationale**: GitHub has supported Mermaid rendering since February 2022. Diagrams render directly in markdown files without external tools. Supports flowcharts, sequence diagrams, class diagrams, and C4 context diagrams. No build step or image generation required.

**Alternatives considered**:
- **PlantUML**: Requires server-side rendering or CI pipelines; doesn't render natively on GitHub.
- **draw.io/diagrams.net**: Requires separate `.drawio` files and exported PNGs; not inline-editable.
- **ASCII art**: Limited expressiveness; hard to maintain for complex diagrams.

**Limitations discovered**:
- GitHub Mermaid has a node/edge limit (~100 nodes before rendering degrades).
- Complex diagrams should be split into overview + detail pages.
- Some advanced Mermaid features (e.g., `classDiagram` with methods) render inconsistently.
- **Recommendation**: Use `flowchart` (graph TD/LR) for architecture diagrams; keep each diagram under 30 nodes.

---

## R2: Root Folder Files — Safe to Delete

**Decision**: All `PR-*-description.md` and `commit-*.txt` files are safe to delete. Content is preserved in git history.

**Rationale**: Checked git log for each file:
- `PR-015-description.md` through `PR-350-description.md` — PR description drafts, merged long ago.
- `commit-msg-008-plan.txt` — commit message draft, already committed.
- `commit-test-analysis.txt` — one-time test analysis, no ongoing reference value.

None of these files are referenced by any source code, CI pipeline, or build configuration.

**Alternatives considered**:
- **Move to `docs/archive/`**: Adds clutter to docs; git history serves same purpose.
- **Keep as-is**: Violates FR-001/FR-002/SC-001; clutters root.

---

## R3: `generate_dense_fixture.py` Disposition

**Decision**: Move to `scripts/generate_dense_fixture.py`.

**Rationale**: The script generates dense test fixture data for performance testing. It follows the same pattern as other utility scripts already in `scripts/` (e.g., `check_m2_staccato.py`, `generate_scales.py`, `inspect_m2_slurs.py`). Moving it maintains consistency with the existing project convention.

**Alternatives considered**:
- **Delete**: Script may still be useful for future performance benchmarking.
- **Move to `backend/scripts/`**: Less discoverable; `scripts/` at root is the established convention.

---

## R4: Architecture Diagram Content — Subsystem Inventory

**Decision**: Six subsystem pages covering the major components.

**Rationale**: Based on codebase analysis, the following subsystems have distinct boundaries and sufficient complexity to warrant dedicated architecture pages:

| Subsystem | Source Location | Key Modules | Diagram Focus |
|-----------|----------------|-------------|---------------|
| **Frontend (React PWA)** | `frontend/src/` | Components, Pages, Services, Hooks, Plugin API | Component hierarchy, service layer, WASM integration, PWA infrastructure |
| **Rust/WASM Engine** | `backend/src/` | Domain (DDD), Ports, Adapters, WASM bindings | Hexagonal architecture, domain model, WASM compilation & deployment |
| **Layout Engine** | `backend/src/layout/` | Breaker, Spacer, Positioner, Batcher, NoteLayout, Structural, Annotations | Pipeline: extraction → spacing → breaking → positioning → batching |
| **SVG Renderer** | `frontend/src/components/renderer/`, `LayoutRenderer.tsx` | RenderingPipeline, HighlightController, InteractionHandler, LoopOverlayRenderer | Two-tier render model, virtualization, highlight system |
| **Plugin System** | `frontend/plugins/`, `frontend/src/plugin-api/` | Plugin API v4, Built-in plugins (train, virtual-keyboard, play-score, guide) | Plugin lifecycle, API surface, event communication |
| **MusicXML Importer** | `backend/src/domain/importers/musicxml/` | Parser, Converter, Mapper, Timing, Compression, Errors | Three-layer import pipeline, data flow, error handling |

**Alternatives considered**:
- **Fewer pages (3-4)**: Would require cramming too much into each page; defeats navigability goal.
- **More pages (8+)**: Playback, Storage, and Themes are not complex enough for standalone pages; can be covered within Frontend PWA.

---

## R5: README.md Structure — Best Practices

**Decision**: Restructure README.md with: hero section → overview → architecture diagram → feature highlights → quick start → project structure → contributing → docs links.

**Rationale**: Analysis of high-quality open-source project READMEs (React, Rust, Vite, Tauri) shows a consistent pattern:
1. **Title + badges** — quick identity and status
2. **One-paragraph overview** — what it is, who it's for
3. **Visual diagram** — architecture or workflow (Mermaid or image)
4. **Feature highlights** — concise bullet list with links to detail pages
5. **Quick start** — fewest steps to get running
6. **Project structure** — directory layout
7. **Contributing** — how to help
8. **Links** — documentation, license, etc.

**Key changes from current README**:
- Replace "tablet-native" with "tablet-first" (3 occurrences in current README + FEATURES.md)
- Add Mermaid architecture diagram (simplified from `docs/architecture.md`)
- Add iOS Safari MIDI limitation note
- Add PWA update process documentation
- Remove "Implementation Progress" section entirely (outdated, specific test counts become stale)
- Keep play view gestures table (currently at top — move below overview for better flow)

---

## R6: Documentation Update Checklist — Integration Point

**Decision**: Create `docs/doc-update-checklist.md` as a standalone checklist. Reference it from `.specify/` templates so spec contributors find it naturally.

**Rationale**: The checklist must be discoverable at two moments:
1. When a contributor completes a spec (end of workflow)
2. When a contributor creates a new spec (planning phase)

Placing it in `docs/` keeps it with other documentation. A reference from the constitution or spec templates ensures it's not forgotten.

**Checklist items** (from spec requirements):
1. Update `README.md` feature highlights if a user-visible feature was added
2. Update or create subsystem architecture page in `docs/` if architecture changed
3. Update `docs/architecture.md` overview diagram if new components were added
4. Verify all Mermaid diagrams render on GitHub
5. Update `FEATURES.md` if a new user-facing capability was added

**Alternatives considered**:
- **Embed in constitution**: Constitution is for principles, not operational checklists.
- **Add to spec template**: Would add noise to every spec; better as a linked reference.
- **GitHub PR template**: Good complement, but doesn't help during planning.
