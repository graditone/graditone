# Quick Start: Documentation Architecture

**Feature**: 059-doc-architecture  
**Date**: 2026-03-26

---

## What This Feature Does

This feature reorganizes and creates project documentation:

1. **Cleans the root folder** — removes 9 orphaned files (PR descriptions, commit drafts)
2. **Creates architecture documentation** — 7 new pages in `docs/` with Mermaid diagrams
3. **Updates README.md** — tablet-first messaging, architecture diagram, feature highlights, PWA update process
4. **Establishes documentation maintenance process** — post-spec checklist for keeping docs current

---

## Implementation Order

### Step 1: Root Folder Cleanup

```bash
# Delete orphaned files
git rm PR-015-description.md PR-021-description.md PR-023-description.md \
       PR-033-description.md PR-037-description.md PR-050-description.md \
       PR-350-description.md commit-msg-008-plan.txt commit-test-analysis.txt

# Move script to correct location
git mv generate_dense_fixture.py scripts/generate_dense_fixture.py
```

**Verify**: `ls *.md` should show only `README.md`, `FEATURES.md`, `PLUGINS.md`, `VERSIONING.md`, `LICENSE`.

### Step 2: Create Architecture Overview

Create `docs/architecture.md` with:
- High-level Mermaid diagram (see [architecture-overview contract](contracts/architecture-overview.md))
- Brief description of each subsystem
- Links to all 6 subsystem pages

### Step 3: Create Subsystem Pages

Create all 6 subsystem pages in `docs/`:
1. `docs/frontend-pwa.md`
2. `docs/wasm-engine.md`
3. `docs/layout-engine.md`
4. `docs/svg-renderer.md`
5. `docs/plugin-system.md`
6. `docs/musicxml-importer.md`

Each page follows the template in [subsystem-pages contract](contracts/subsystem-pages.md).

### Step 4: Create Documentation Checklist

Create `docs/doc-update-checklist.md` following the [checklist contract](contracts/doc-update-checklist.md).

### Step 5: Update README.md

Apply all changes defined in the [README.md contract](contracts/subsystem-pages.md#readmemd-contract):
1. Replace "tablet-native" → "tablet-first"
2. Add simplified Mermaid architecture diagram
3. Rewrite feature highlights section with concise entries + links
4. Remove "Implementation Progress" section
5. Add iOS Safari MIDI limitation note
6. Add PWA update process documentation
7. Update Constitutional Principles to include all 7
8. Add link to `docs/architecture.md` in Documentation section

### Step 6: Verify

- [ ] Root folder contains no `PR-*-description.md` or `commit-*.txt` files
- [ ] `docs/` contains 8+ files (7 new + LOCAL-VALIDATION.md)
- [ ] All Mermaid diagrams render on GitHub (push branch, check rendered markdown)
- [ ] All links between pages resolve correctly
- [ ] README.md has no mention of "tablet-native"
- [ ] README.md has no "Implementation Progress" section
- [ ] Navigate from README → any subsystem page in ≤ 3 clicks

---

## Diagram Authoring Tips

- Use ` ```mermaid ` fenced code blocks (GitHub renders natively)
- Keep diagrams under 30 nodes for reliable rendering
- Use `flowchart TD` for top-down architecture diagrams
- Use `flowchart LR` for pipeline/data-flow diagrams
- Test rendering by pushing to a branch and viewing on GitHub
- If a diagram is too complex, split into overview + detail sections on the same page

---

## Files Changed

| Action | File | Description |
|--------|------|-------------|
| DELETE | `PR-*-description.md` (7 files) | Orphaned PR descriptions |
| DELETE | `commit-msg-008-plan.txt` | Orphaned commit draft |
| DELETE | `commit-test-analysis.txt` | Orphaned test analysis |
| MOVE | `generate_dense_fixture.py` → `scripts/` | Development utility |
| CREATE | `docs/architecture.md` | Architecture overview |
| CREATE | `docs/frontend-pwa.md` | Frontend PWA subsystem |
| CREATE | `docs/wasm-engine.md` | Rust/WASM Engine subsystem |
| CREATE | `docs/layout-engine.md` | Layout Engine subsystem |
| CREATE | `docs/svg-renderer.md` | SVG Renderer subsystem |
| CREATE | `docs/plugin-system.md` | Plugin System subsystem |
| CREATE | `docs/musicxml-importer.md` | MusicXML Importer subsystem |
| CREATE | `docs/doc-update-checklist.md` | Post-spec checklist |
| UPDATE | `README.md` | Tablet-first, diagram, highlights, cleanup |
