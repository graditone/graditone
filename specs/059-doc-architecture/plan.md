# Implementation Plan: Documentation Architecture

**Branch**: `059-doc-architecture` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/059-doc-architecture/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Reorganize and create project documentation: clean root folder of orphaned PR/commit files, create `docs/` architecture pages with Mermaid diagrams (1 overview + 6 subsystem pages), update README.md (tablet-first messaging, architecture diagram, feature highlights, PWA update process, remove Implementation Progress), and establish a post-spec documentation update checklist. This is a documentation-only feature with no code changes.

## Technical Context

**Language/Version**: Markdown + Mermaid (GitHub-native rendering)
**Primary Dependencies**: None (documentation-only; GitHub Mermaid renderer)
**Storage**: N/A (filesystem — markdown files in `docs/`)
**Testing**: Manual validation (Mermaid renders on GitHub, links resolve, root is clean)
**Target Platform**: GitHub repository (rendered markdown)
**Project Type**: Documentation restructuring (no application code changes)
**Performance Goals**: N/A
**Constraints**: All Mermaid diagrams must render in GitHub's native Mermaid preview; navigation from README to any subsystem page in ≤ 3 clicks
**Scale/Scope**: 7 new docs pages, 1 updated README.md, 1 checklist, ~10 file deletions/moves

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|-------------|--------|-------|
| I. Domain-Driven Design | ✅ Yes | ✅ PASS | Documentation uses ubiquitous language (Score, Timeline, Glyph, System, etc.) |
| II. Hexagonal Architecture | ✅ Yes | ✅ PASS | Architecture diagrams reflect ports & adapters boundaries |
| III. Progressive Web Application | ✅ Yes | ✅ PASS | README updated with PWA messaging, update process, offline-first |
| IV. Precision & Fidelity | ⬜ N/A | — | No timing/PPQ changes |
| V. Test-First Development | ⬜ N/A | — | Documentation-only feature; no testable code |
| VI. Layout Engine Authority | ✅ Yes | ✅ PASS | Architecture diagrams correctly show Rust/WASM as sole layout authority |
| VII. Regression Prevention | ⬜ N/A | — | No bug fixes in this feature |

**Gate result**: ✅ PASS — no violations. Documentation accurately reflects all constitutional principles.

## Project Structure

### Documentation (this feature)

```text
specs/059-doc-architecture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (documentation structure model)
├── quickstart.md        # Phase 1 output (contributor guide)
├── contracts/           # Phase 1 output (page templates)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Files to DELETE from root:
#   PR-015-description.md, PR-021-description.md, PR-023-description.md,
#   PR-033-description.md, PR-037-description.md, PR-050-description.md,
#   PR-350-description.md, commit-msg-008-plan.txt, commit-test-analysis.txt

# File to MOVE:
#   generate_dense_fixture.py → scripts/generate_dense_fixture.py

# New/updated documentation structure:
docs/
├── architecture.md              # High-level architecture overview + Mermaid
├── frontend-pwa.md              # Frontend (React PWA) subsystem
├── wasm-engine.md               # Rust/WASM Engine subsystem
├── layout-engine.md             # Layout Engine subsystem
├── svg-renderer.md              # SVG Renderer subsystem
├── plugin-system.md             # Plugin System subsystem
├── musicxml-importer.md         # MusicXML Importer subsystem
├── doc-update-checklist.md      # Post-spec documentation update process
└── LOCAL-VALIDATION.md          # Existing file (preserved)

README.md                        # Updated (tablet-first, diagram, highlights, no Impl Progress)
```

**Structure Decision**: Documentation-only feature. All changes are markdown files in `docs/` and root. No `backend/` or `frontend/` code changes. Existing `docs/LOCAL-VALIDATION.md` preserved and linked from new structure.

## Complexity Tracking

No violations — documentation-only feature with no architectural complexity.
