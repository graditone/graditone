# Data Model: Documentation Architecture

**Feature**: 059-doc-architecture  
**Date**: 2026-03-26

---

## Entities

### 1. Architecture Page

A markdown document in `docs/` describing a system component's structure and data flow.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title (e.g., "Layout Engine Architecture") |
| `path` | string | File path relative to repo root (e.g., `docs/layout-engine.md`) |
| `scope` | enum | `overview` or `subsystem` |
| `diagrams` | Diagram[] | One or more Mermaid diagrams |
| `sections` | Section[] | Narrative sections with headings |
| `links_to` | string[] | Paths of pages this page links to |
| `linked_from` | string[] | Paths of pages that link to this page |

**Validation rules**:
- Every subsystem page MUST be linked from `docs/architecture.md`
- Every page MUST have at least one Mermaid diagram
- Diagram node count SHOULD be ≤ 30 for GitHub rendering reliability

### 2. Diagram

A Mermaid diagram embedded within an architecture page.

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `flowchart`, `sequence`, `graph` |
| `direction` | enum | `TD` (top-down), `LR` (left-right) |
| `title` | string | Descriptive caption above diagram |
| `nodes` | Node[] | Named modules/services |
| `edges` | Edge[] | Data flow between nodes with input/output types |

### 3. Feature Highlight

A concise entry in README.md summarizing a capability.

| Field | Type | Description |
|-------|------|-------------|
| `emoji` | string | Category emoji (e.g., 🎼, ▶️, 📱) |
| `title` | string | Feature name (e.g., "Score Display") |
| `description` | string | One-line summary |
| `link` | string | Path to detailed page (FEATURES.md, PLUGINS.md, or docs/) |

### 4. Documentation Update Checklist

A step-by-step guide for post-spec documentation maintenance.

| Field | Type | Description |
|-------|------|-------------|
| `step_number` | int | Ordered step (1-based) |
| `action` | string | What to do |
| `condition` | string | When this step applies |
| `target_file` | string | Which file to update |

---

## Relationships

```
README.md
  ├── links to → docs/architecture.md (overview)
  ├── links to → FEATURES.md
  ├── links to → PLUGINS.md
  └── contains → simplified Mermaid diagram

docs/architecture.md (overview)
  ├── links to → docs/frontend-pwa.md
  ├── links to → docs/wasm-engine.md
  ├── links to → docs/layout-engine.md
  ├── links to → docs/svg-renderer.md
  ├── links to → docs/plugin-system.md
  ├── links to → docs/musicxml-importer.md
  ├── links to → docs/LOCAL-VALIDATION.md
  └── links to → docs/doc-update-checklist.md

docs/doc-update-checklist.md
  └── referenced from → .specify/ templates (future integration)
```

---

## Navigation Structure

```
Click 1: README.md → docs/architecture.md
Click 2: docs/architecture.md → docs/{subsystem}.md
Result: Any subsystem reachable in 2 clicks (≤ 3 click requirement)
```

---

## Page Inventory

| # | File | Scope | Primary Diagram |
|---|------|-------|-----------------|
| 1 | `docs/architecture.md` | Overview | High-level system components + data flow |
| 2 | `docs/frontend-pwa.md` | Subsystem | React component hierarchy + service layer |
| 3 | `docs/wasm-engine.md` | Subsystem | Hexagonal architecture + WASM deployment |
| 4 | `docs/layout-engine.md` | Subsystem | Pipeline: extraction → spacing → breaking → positioning → batching |
| 5 | `docs/svg-renderer.md` | Subsystem | Two-tier render model + virtualization |
| 6 | `docs/plugin-system.md` | Subsystem | Plugin API v4 lifecycle + event communication |
| 7 | `docs/musicxml-importer.md` | Subsystem | Three-layer import pipeline |
| 8 | `docs/doc-update-checklist.md` | Process | N/A (checklist, no diagram) |
| 9 | `docs/LOCAL-VALIDATION.md` | Existing | Preserved as-is |

---

## File Operations Summary

### Deletions (root cleanup)
| File | Reason |
|------|--------|
| `PR-015-description.md` | Orphaned PR description |
| `PR-021-description.md` | Orphaned PR description |
| `PR-023-description.md` | Orphaned PR description |
| `PR-033-description.md` | Orphaned PR description |
| `PR-037-description.md` | Orphaned PR description |
| `PR-050-description.md` | Orphaned PR description |
| `PR-350-description.md` | Orphaned PR description |
| `commit-msg-008-plan.txt` | Orphaned commit draft |
| `commit-test-analysis.txt` | Orphaned test analysis |

### Moves
| From | To |
|------|----|
| `generate_dense_fixture.py` | `scripts/generate_dense_fixture.py` |

### Creates
| File | Type |
|------|----|
| `docs/architecture.md` | Architecture overview |
| `docs/frontend-pwa.md` | Subsystem page |
| `docs/wasm-engine.md` | Subsystem page |
| `docs/layout-engine.md` | Subsystem page |
| `docs/svg-renderer.md` | Subsystem page |
| `docs/plugin-system.md` | Subsystem page |
| `docs/musicxml-importer.md` | Subsystem page |
| `docs/doc-update-checklist.md` | Process checklist |

### Updates
| File | Changes |
|------|----|
| `README.md` | Tablet-first messaging, architecture diagram, feature highlights, remove Impl Progress, PWA update, iOS MIDI note |
