# Feature Specification: MusicXML Processing Reference Documentation

**Feature Branch**: `064-musicxml-processing-docs`  
**Created**: 2025-03-29  
**Status**: Draft  
**Input**: User description: "Document how the MusicXML processing works. The goal is to create a document in the docs folder, following the current ones about architecture, describing how the score visualization and score playback is generated from the MusicXML path. It is a reference document that will be used to take future decisions like specific notes, accidentals, and music reproduction."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Looks Up Processing Pipeline for Decision-Making (Priority: P1)

A developer needs to understand how MusicXML data flows from file input through parsing, layout, rendering, and playback in order to make an informed decision about a new feature (e.g., adding accidental rendering rules, changing note articulation playback behavior, or adjusting dynamics). They open the reference document and trace the entire pipeline stage by stage.

**Why this priority**: This is the core purpose of the documentation — enabling faster, better-informed development decisions by providing a single authoritative reference for the MusicXML processing pipeline.

**Independent Test**: Verified by having a developer who is unfamiliar with the pipeline read the document and correctly identify which modules and data structures are involved in a given processing stage (e.g., "Where are accidentals stored?" or "How does staccato affect playback duration?").

**Acceptance Scenarios**:

1. **Given** the reference document exists in the docs folder, **When** a developer searches for how accidentals are handled, **Then** they can find the relevant parsing, domain model, layout, and rendering details in a single document
2. **Given** the reference document exists, **When** a developer needs to modify playback behavior for a specific articulation, **Then** they can trace the data flow from MusicXML element through domain model to the playback scheduler

---

### User Story 2 - Developer Navigates from Architecture Overview to Processing Detail (Priority: P2)

A developer reads the existing architecture.md document and wants deeper detail on the MusicXML processing pipeline. They follow a link from the architecture overview to the new reference document and find comprehensive detail on each processing stage without needing to read source code.

**Why this priority**: The documentation must integrate with the existing doc structure so developers discover it naturally.

**Independent Test**: Verified by confirming the architecture.md document links to the new document, and the new document links back to the relevant component detail pages.

**Acceptance Scenarios**:

1. **Given** the architecture.md overview page, **When** a developer clicks the link to the processing reference, **Then** they arrive at a document that covers the full end-to-end pipeline
2. **Given** the new reference document, **When** a developer wants detail on a specific component (e.g., Layout Engine), **Then** they find a cross-reference link to the existing component-specific doc

---

### User Story 3 - Developer Uses Document for Accidentals or Reproduction Decision (Priority: P3)

A developer is specifically tasked with improving how accidentals are displayed or how music is reproduced (e.g., velocity, dynamics, articulation effects). They consult the reference document to understand the current state — what data is parsed, how it is stored, how it flows to rendering and playback — then use that knowledge to plan their implementation.

**Why this priority**: This is the explicit use case mentioned by the user and validates that the document serves its stated purpose as a decision-support reference.

**Independent Test**: Verified by having a developer use only the reference document (without reading source code) to correctly describe: (a) how accidental data flows from MusicXML to the rendered SVG, and (b) how note velocity is computed from dynamics markings and delivered to the audio output.

**Acceptance Scenarios**:

1. **Given** the reference document, **When** a developer looks up accidental handling, **Then** they find: the MusicXML elements parsed, the domain fields that store accidental data (pitch, spelling, explicit accidental flag), the SMuFL codepoints used for rendering, and the layout positioning logic
2. **Given** the reference document, **When** a developer looks up dynamics/velocity handling, **Then** they find: the MusicXML direction elements parsed, the domain model for DynamicMarking and GradualDynamic, the velocity computation pipeline, and how velocity reaches the audio sampler

---

### Edge Cases

- What happens when a developer looks for a feature that is not yet implemented (e.g., repeat playback)? — The document should clearly indicate which features have "rendering only" or "playback not yet implemented" status.
- What happens when the processing pipeline changes in a future feature? — The document should include a maintenance note referencing the doc-update-checklist.md so future features trigger an update.

## Clarifications

### Session 2026-03-29

- Q: How deep should the document go with code-level detail? → A: Include key struct/type excerpts inline (e.g., `Note { pitch, spelling, staccato, velocity, ... }`) alongside narrative descriptions
- Q: How should implementation status be presented for partially-implemented features? → A: Consolidated status matrix table listing all features with columns: Feature, Parsing, Layout/Rendering, Playback

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Document MUST describe the complete MusicXML processing pipeline from file input to score visualization and playback output
- **FR-002**: Document MUST be placed in the `docs/` folder following the naming and formatting conventions of existing documentation files (e.g., architecture.md, musicxml-importer.md)
- **FR-003**: Document MUST include a high-level data flow diagram showing all processing stages and their inputs/outputs
- **FR-004**: Document MUST cover the three-layer MusicXML import pipeline (compression, parsing, conversion) with references to the relevant modules
- **FR-005**: Document MUST describe the domain model hierarchy (Score → Instrument → Staff → Voice → Note) and key fields relevant to rendering and playback decisions, including inline Rust struct excerpts and TypeScript type definitions for quick reference
- **FR-006**: Document MUST explain how accidentals are parsed, stored (pitch + spelling + explicit flag), laid out, and rendered
- **FR-007**: Document MUST explain how dynamics and velocity are extracted from MusicXML, stored in the domain model, and delivered to playback
- **FR-008**: Document MUST explain how articulations (staccato, ties, slurs, grace notes) affect both rendering and playback
- **FR-009**: Document MUST describe the WASM bridge — exported functions, JSON serialization, and cache invalidation via schema versioning
- **FR-010**: Document MUST describe the layout engine stages and how laid-out data (GlobalLayout JSON) is consumed by the SVG renderer
- **FR-011**: Document MUST describe the playback pipeline — note extraction, tie resolution, timing conversion, windowed scheduling, and audio output
- **FR-012**: Document MUST include a key files reference table mapping each processing stage to its source files
- **FR-013**: Document MUST include a consolidated implementation status matrix table listing all musical features with columns for Feature, Parsing, Layout/Rendering, and Playback status (e.g., ✅ Implemented, ⚠️ Partial, ❌ Not implemented) to prevent incorrect assumptions
- **FR-014**: Document MUST cross-reference existing docs (architecture.md, musicxml-importer.md, layout-engine.md, svg-renderer.md, wasm-engine.md) for component-specific deep dives
- **FR-015**: The architecture.md file MUST be updated to include a link to the new reference document in its components table or see-also section

### Key Entities

- **MusicXMLDocument**: Intermediate XML representation produced by the parser, preserving MusicXML's structure (parts, measures, note elements)
- **Score**: Domain aggregate root containing instruments, structural events, repeat barlines, volta brackets, octave shifts, phrases, and difficulty rating
- **Note**: Core domain event with pitch, spelling, articulations, beams, ties, slurs, fingering, velocity, and duration
- **CompiledScore**: Serialized JSON form of the Score with computed fields (active_clef) and schema versioning for cache invalidation
- **GlobalLayout**: JSON output of the layout engine containing systems, staff groups, glyph runs, barlines, and bounding boxes
- **GlyphRun**: Batched set of SMuFL glyphs sharing font, size, and color — the primary rendering unit for SVG generation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer unfamiliar with the codebase can read the document and correctly identify the module responsible for any given processing stage within 5 minutes
- **SC-002**: The document covers 100% of the processing stages from MusicXML input to both SVG rendering output and audio playback output
- **SC-003**: All cross-references to existing documentation are valid links that resolve to actual files in the docs/ folder
- **SC-004**: The document correctly reflects the current codebase state — no outdated module names, field names, or pipeline stages
- **SC-005**: Future feature developers can use the document to determine where their changes fit in the pipeline without reading more than 2 source files for orientation

