# Feature Specification: Documentation Architecture

**Feature Branch**: `059-doc-architecture`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Update and organize doc: Propose a doc architecture for the project that must be updated after the end of each spec. Clean all PR-xxxx.md from root folder, reorganize doc folder with mermaid architecture diagrams, update README.md with high-level features and architectural diagram, fix tablet-native messaging to tablet-first, remove Implementation progress, add PWA update process."

## Clarifications

### Session 2026-03-26

- Q: At what level of detail should subsystem architecture diagrams operate? → A: Module-level — show named modules/services and data flow between them with input/output types

## User Scenarios & Testing

### User Story 1 - Developer Finds Architecture Documentation Quickly (Priority: P1)

A developer new to the project opens the repository and wants to understand how Graditone is structured. They open README.md and see a concise high-level overview with an architecture diagram (Mermaid) that shows how the frontend, WASM engine, backend, and plugin system relate. From there, they follow links into the `docs/` folder for detailed component-level diagrams.

**Why this priority**: Understanding the architecture is the first thing any contributor needs. A clean, navigable doc structure reduces onboarding time and prevents incorrect assumptions about the codebase.

**Independent Test**: A contributor with no prior Graditone experience can navigate from README.md to a specific component's architecture diagram in 3 clicks or fewer and understand the high-level data flow.

**Acceptance Scenarios**:

1. **Given** a new developer opens the repository root, **When** they read README.md, **Then** they see a Mermaid architecture diagram showing the main system components and their relationships.
2. **Given** a developer wants to understand the layout engine, **When** they follow the link from the architecture overview in `docs/`, **Then** they find a dedicated page with a detailed Mermaid diagram for that component.
3. **Given** the developer is browsing the root folder, **When** they list files, **Then** they see only essential project files (README.md, LICENSE, FEATURES.md, PLUGINS.md, VERSIONING.md, docker-compose.yml, and standard config files) — no PR description files, commit message drafts, or ad-hoc scripts.

---

### User Story 2 - Contributor Updates Docs After Completing a Feature (Priority: P2)

A contributor finishes implementing a new feature spec. As the last step of the spec workflow, they update the documentation to reflect the new capability: they add a feature highlight to README.md and update or add the relevant architecture diagram in `docs/`.

**Why this priority**: Documentation that drifts from reality is worse than no documentation. Establishing a clear post-spec update process ensures docs stay current.

**Independent Test**: After completing a hypothetical feature, a contributor can follow the documented process to update README.md and the relevant `docs/` page and verify the changes render correctly.

**Acceptance Scenarios**:

1. **Given** a feature spec is marked complete, **When** the contributor follows the documentation update checklist, **Then** README.md reflects the new feature in the highlights section.
2. **Given** a feature touches an existing component, **When** the contributor updates the corresponding architecture diagram in `docs/`, **Then** the Mermaid diagram renders correctly in GitHub and shows the new or changed relationships.
3. **Given** a feature introduces a new subsystem, **When** the contributor creates a new page in `docs/`, **Then** the page is linked from the base architecture page (`docs/architecture.md`).

---

### User Story 3 - User Understands What Graditone Runs On (Priority: P2)

A potential user visits the README to understand if Graditone works on their device. They see a clear "tablet-first" description that explains the app works across desktops, laptops, tablets, and mobile phones, with a note about platform-specific limitations (e.g., MIDI not available on iOS).

**Why this priority**: Accurate platform messaging prevents user frustration and sets correct expectations. The current "tablet-native" wording is misleading for desktop and mobile users.

**Independent Test**: A user reading the README can determine within 10 seconds whether their device is supported and what limitations apply.

**Acceptance Scenarios**:

1. **Given** a user reads the README overview, **When** they look for device support, **Then** they see that Graditone is "tablet-first" but works on desktop, laptop, and mobile browsers.
2. **Given** a user has an iOS device, **When** they read the platform support section, **Then** they see a clear note that MIDI input is not supported on iOS Safari.
3. **Given** a user wants to install the app, **When** they read the update process section, **Then** they understand updates are delivered through PWA (refresh the app) rather than app store downloads.

---

### User Story 4 - Root Folder is Clean and Navigable (Priority: P1)

A developer clones the repository and lists the root directory. They see a clean set of essential files without orphaned PR descriptions, commit message drafts, or ad-hoc utility scripts that belong elsewhere.

**Why this priority**: A cluttered root folder creates confusion about which files are authoritative. Cleaning it is a prerequisite for the new doc structure.

**Independent Test**: After cleanup, listing the root directory shows only files that serve a clear ongoing purpose (config, docs, license, build files).

**Acceptance Scenarios**:

1. **Given** the root folder currently contains PR-xxx-description.md files, **When** the cleanup is performed, **Then** no PR-xxx-description.md files remain in the root.
2. **Given** the root folder contains commit-msg-008-plan.txt and commit-test-analysis.txt, **When** cleanup is performed, **Then** these files are removed.
3. **Given** the root folder contains generate_dense_fixture.py, **When** cleanup is performed, **Then** the script is either moved to an appropriate directory (e.g., `scripts/`) or removed if no longer needed.

---

### Edge Cases

- What happens when a Mermaid diagram is too complex for a single view? The diagram should be split into a high-level overview and linked detail pages.
- What happens when a feature spec doesn't change the architecture? The contributor still updates README.md feature highlights but can skip the architecture diagram update if no structural changes occurred.
- What happens when GitHub's Mermaid rendering has limitations? Diagrams should be tested in GitHub's Mermaid preview; complex diagrams may need simplified versions.

## Requirements

### Functional Requirements

- **FR-001**: Root folder cleanup MUST remove all `PR-*-description.md` files (PR-015, PR-021, PR-023, PR-033, PR-037, PR-050, PR-350)
- **FR-002**: Root folder cleanup MUST remove `commit-msg-008-plan.txt` and `commit-test-analysis.txt`
- **FR-003**: Root folder cleanup MUST relocate `generate_dense_fixture.py` to `scripts/` directory
- **FR-004**: `docs/` folder MUST contain a base architecture page (`docs/architecture.md`) with a high-level Mermaid diagram showing all major system components
- **FR-005**: `docs/` folder MUST contain dedicated architecture pages for each major subsystem: Frontend (React PWA), Rust/WASM Engine, Layout Engine, SVG Renderer, Plugin System, and MusicXML Importer
- **FR-006**: Each subsystem architecture page MUST include at least one Mermaid diagram at module-level detail: showing named modules/services, data flow between them, and input/output types (e.g., for Layout Engine: Breaker → Spacer → Positioner → Batcher pipeline)
- **FR-007**: `docs/architecture.md` MUST link to all subsystem architecture pages
- **FR-008**: README.md MUST replace "tablet-native" with "tablet-first" messaging and clearly state the app works on desktop, laptop, tablet, and mobile browsers
- **FR-009**: README.md MUST include a note that MIDI input is not available on iOS Safari
- **FR-010**: README.md MUST include a high-level Mermaid architecture diagram (simplified version of the one in `docs/architecture.md`)
- **FR-011**: README.md MUST include a feature highlights section with concise descriptions and links to detailed pages (FEATURES.md, PLUGINS.md)
- **FR-012**: README.md MUST remove the "Implementation Progress" section entirely
- **FR-013**: README.md MUST document that updates are delivered through PWA (refresh to update), not app store downloads
- **FR-014**: A documentation update checklist MUST be created that spec contributors follow after completing each feature, covering README.md feature highlights and architecture diagram updates
- **FR-015**: The existing `docs/LOCAL-VALIDATION.md` file MUST be preserved and linked from the new docs structure

### Key Entities

- **Architecture Page**: A markdown document in `docs/` containing Mermaid diagrams and narrative describing a system component's structure and data flow
- **Feature Highlight**: A concise entry in README.md summarizing a capability with a link to a detailed page
- **Documentation Update Checklist**: A step-by-step guide contributors follow post-spec to keep docs current

## Success Criteria

### Measurable Outcomes

- **SC-001**: Root folder contains zero `PR-*-description.md` files, zero `.txt` commit/test files
- **SC-002**: `docs/` folder contains at least 7 pages (1 architecture overview + 6 subsystem pages)
- **SC-003**: All Mermaid diagrams render correctly when viewed on GitHub
- **SC-004**: A new contributor can navigate from README.md to any subsystem architecture diagram in 3 clicks or fewer
- **SC-005**: README.md contains no mention of "tablet-native" — replaced with "tablet-first" and multi-device messaging
- **SC-006**: README.md no longer contains an "Implementation Progress" section
- **SC-007**: A documentation update checklist exists and is referenced from the spec workflow documentation
- **SC-008**: README.md includes a working Mermaid architecture diagram visible on GitHub

## Assumptions

- PR-description files and commit message text files in the root are no longer needed and can be safely deleted (their content is preserved in git history)
- `generate_dense_fixture.py` is a development utility that belongs in `scripts/`
- GitHub natively renders Mermaid diagrams in markdown — no external tooling needed
- The existing `docs/LOCAL-VALIDATION.md` file is still relevant and should be preserved
- `docker-compose.yml` is still actively used and should remain in the root
- FEATURES.md, PLUGINS.md, and VERSIONING.md serve distinct purposes and should remain as root-level files
- The documentation update checklist will be integrated into the existing spec workflow (e.g., referenced in `.specify/` templates or constitution)

