# Documentation Update Checklist

Follow this checklist after completing any feature spec to keep project documentation current.

## When to Use

Run through this checklist as the final step of the [speckit workflow](../specs/ONBOARDING.md) — after implementation is complete and before merging.

## Checklist

### 1. Update README.md Feature Highlights

**Condition**: Feature adds or changes a user-visible capability

- [ ] Add or update the feature entry in the **Feature Highlights** section of [README.md](../README.md)
- [ ] Keep the entry concise (one line + link to detail page)

### 2. Update FEATURES.md

**Condition**: Feature adds or changes a user-visible capability

- [ ] Add or update the feature entry in [FEATURES.md](../FEATURES.md)

### 3. Update Subsystem Architecture Page

**Condition**: Feature modifies system architecture (new component, changed data flow, new module)

- [ ] Update the relevant subsystem page in `docs/`:
  - [Frontend PWA](frontend-pwa.md) — React components, services, PWA infrastructure
  - [Rust/WASM Engine](wasm-engine.md) — domain model, ports, adapters
  - [Layout Engine](layout-engine.md) — layout pipeline stages
  - [SVG Renderer](svg-renderer.md) — rendering pipeline, highlight system
  - [Plugin System](plugin-system.md) — plugin API, built-in plugins
  - [MusicXML Importer](musicxml-importer.md) — import pipeline
- [ ] If adding a new subsystem, create a new page following the [subsystem template](#subsystem-page-template)

### 4. Update Architecture Overview

**Condition**: Feature adds a new subsystem or major component

- [ ] Update the Mermaid diagram in [docs/architecture.md](architecture.md)
- [ ] Add a link to the new subsystem page in the Components table
- [ ] Update the simplified diagram in [README.md](../README.md) if the high-level structure changed

### 5. Update Plugin System Page

**Condition**: Feature adds a new plugin or changes the Plugin API

- [ ] Update [docs/plugin-system.md](plugin-system.md) with new plugin entry or API changes

### 6. Verify Mermaid Diagrams

**Condition**: Any documentation change includes Mermaid diagrams

- [ ] Push the branch to GitHub
- [ ] Open each changed markdown file on GitHub and verify the Mermaid diagram renders correctly
- [ ] Ensure diagrams stay under 30 nodes for reliable rendering

### 7. Verify Cross-References

**Condition**: Feature is fully complete and merged

- [ ] Check that all links between docs/ pages resolve correctly
- [ ] Verify links from README.md to docs/ pages work
- [ ] Confirm navigation: README.md → docs/architecture.md → docs/{subsystem}.md (≤ 3 clicks)

## Subsystem Page Template

When creating a new subsystem page, follow this structure:

```markdown
# {Subsystem Name}

## Overview
[One paragraph: what this subsystem does, its role in the system]

## Architecture
[Mermaid diagram at module-level detail]

## Modules
[Table describing each named module in the diagram]

## Data Flow
[Description of input → processing → output with types]

## Key Files
[Table mapping module names to file paths]

## See Also
[Links to related subsystem pages and architecture overview]
```

## Tips

- **Mermaid preview**: Push to a branch and view on GitHub — Mermaid renders natively in markdown files
- **Broken link check**: Manually verify links or use `markdown-link-check` if available
- **Diagram complexity**: If a diagram exceeds 30 nodes, split into an overview section and a detail section on the same page
