# Feature Specification: Refactor Layout Engine

**Feature Branch**: `052-refactor-layout-engine`  
**Created**: 2025-03-18  
**Status**: Draft  
**Input**: User description: "Refactor Layout engine. Explore the current status of the layout engine and update the README.md and create a mermaid diagram with it. Define the responsibilities included in mod.rs and modularize it in different files based on them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modularize Layout Orchestrator (Priority: P1)

As a developer working on the layout engine, I need the monolithic `mod.rs` (~3,750 lines) decomposed into focused, single-responsibility modules so I can understand, navigate, maintain, and extend the layout engine without needing to comprehend the entire file at once.

**Why this priority**: The current `mod.rs` contains at least 8 distinct responsibilities (data extraction, note positioning, structural elements, barlines, multi-staff layout, annotations, assembly, and orchestration) in a single file. This is the primary maintainability bottleneck. Splitting it is the core deliverable that unlocks all other improvements.

**Independent Test**: Can be fully tested by running all existing layout engine tests after the split. Every test that passes before the refactor must still pass after — zero regressions. Delivers immediate value through improved code navigability and ownership clarity.

**Acceptance Scenarios**:

1. **Given** the current layout engine with all logic in `mod.rs`, **When** the refactoring is complete, **Then** `mod.rs` contains only the top-level orchestration logic (the `compute_layout` function and module declarations) and each extracted responsibility exists in its own dedicated file.
2. **Given** the refactored module structure, **When** a developer opens the layout directory, **Then** each file name clearly communicates what category of layout logic it contains (e.g., extraction, barlines, annotations).
3. **Given** the refactored codebase, **When** the full test suite is executed, **Then** all existing tests pass with no regressions — the layout output is byte-for-byte identical to the pre-refactor version.
4. **Given** the refactored codebase, **When** a developer needs to modify barline rendering, **Then** they can locate the relevant code in a dedicated barlines module without searching through thousands of lines.

---

### User Story 2 - Update Layout Engine Documentation (Priority: P2)

As a developer onboarding to the project, I need the layout engine README to accurately reflect the current architecture — including a visual diagram of how modules interact — so I can understand the system without reading every source file.

**Why this priority**: Documentation becomes even more critical after a structural refactoring. Without updated docs, the modularization itself can become confusing for new contributors. A mermaid diagram provides an at-a-glance understanding of the module dependency graph.

**Independent Test**: Can be tested by reviewing the README against the actual file structure. Every module listed in the README must correspond to a real file, and the mermaid diagram must reflect actual module dependencies.

**Acceptance Scenarios**:

1. **Given** the refactored layout engine, **When** a developer reads the README, **Then** they find a complete list of all layout modules with a one-line description of each module's responsibility.
2. **Given** the layout README, **When** a developer views the mermaid architecture diagram, **Then** the diagram shows all layout modules and their dependency/call relationships.
3. **Given** the documentation, **When** compared against the actual codebase, **Then** every module file in the layout directory is documented in the README and represented in the mermaid diagram.

---

### User Story 3 - Preserve Internal Data Structures (Priority: P3)

As a layout engine consumer (the WASM interface and frontend renderer), I need the refactoring to preserve all existing public types, function signatures, and output structures so the rendering pipeline continues to work without any changes.

**Why this priority**: This is a pure internal refactoring. No consumer-facing changes should be introduced. The public API surface (`compute_layout`, `GlobalLayout`, all types in `types.rs`) must remain stable.

**Independent Test**: Can be tested by compiling the WASM module and running the frontend integration tests. The WASM interface and all downstream consumers must work identically.

**Acceptance Scenarios**:

1. **Given** the refactored layout engine, **When** the WASM module is compiled, **Then** the compilation succeeds with no errors and the public API surface is unchanged.
2. **Given** the refactored layout engine, **When** a score is rendered end-to-end, **Then** the visual output is identical to the pre-refactor rendering.

---

### Edge Cases

- What happens when internal helper functions are moved to new modules but referenced from multiple places? All cross-module dependencies must use explicit `pub(crate)` visibility to maintain encapsulation.
- What happens if the refactoring changes struct field ordering? Serialization output must remain identical — field order must be preserved.
- How does the system handle module circular dependencies? The refactored modules must form a DAG (directed acyclic graph) with no circular imports.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The monolithic `mod.rs` MUST be decomposed into focused modules, each handling a single category of layout responsibility.
- **FR-002**: A dedicated data extraction module MUST be created containing `extract_measures()` and `extract_instruments()` and their supporting types (`InstrumentData`, `StaffData`, `VoiceData`, `NoteEvent`, `RestLayoutEvent`).
- **FR-003**: A dedicated barlines module MUST be created containing `create_bar_lines()`, `create_bar_line_segments()`, and `compute_repeat_dots()`.
- **FR-004**: A dedicated annotations module MUST be created containing tie arc logic, slur arc logic, notation dot logic (augmentation and staccato), and ledger line logic.
- **FR-005**: A dedicated structural glyphs module MUST be created containing clef positioning, key signature positioning, time signature positioning, and mid-system clef/key changes.
- **FR-006**: A dedicated staff groups module MUST be created containing multi-staff vertical spacing, collision detection, and bracket/brace positioning (`create_bracket_glyph`).
- **FR-007**: The note positioning logic (`position_glyphs_for_staff`, `compute_unified_note_positions`) MUST be placed in a dedicated module, with chord displacement, accidental positioning, and beam/stem generation as internal concerns.
- **FR-008**: The `mod.rs` file, after refactoring, MUST contain only the `compute_layout` orchestration function and module declarations, acting as a thin coordinator. The `compute_layout` body MUST delegate each processing phase (per-system processing, staff positioning, barline joining, annotation placement, bounding-box computation, etc.) to named functions defined in the extracted modules, keeping the orchestrator under 600 lines.
- **FR-009**: All existing public types and function signatures MUST be preserved — no breaking changes to the layout engine's public API.
- **FR-010**: All existing tests MUST pass with zero regressions after the refactoring.
- **FR-011**: The layout README MUST be updated with a complete module listing and responsibility descriptions.
- **FR-012**: A mermaid architecture diagram MUST be created showing all layout modules with call-flow arrows (orchestrator → modules) and a single shared `types.rs` dependency. Per-module type-import arrows SHOULD be omitted for readability.
- **FR-013**: Internal helper functions (`shift_dot_to_space`, `create_staff_lines`, `compute_staff_note_extents`) MUST be placed in the module most aligned with their responsibility.
- **FR-014**: The tick-to-measure conversion helpers (`measure_start_tick`, `measure_end_tick`, `tick_to_measure_index`, `actual_start`, `actual_end`, `actual_tick_to_measure`) MUST be placed in a dedicated utility or extraction module.
- **FR-015**: Existing tests in `mod.rs` MUST be distributed into per-module `#[cfg(test)]` blocks, so each extracted module owns the tests relevant to its responsibility.
- **FR-016**: The `LayoutConfig` struct MUST be moved to `types.rs` so all extracted modules can import it from the shared types module without introducing circular dependencies.

### Key Entities

- **Layout Module**: A source file within the layout directory that owns a specific category of layout computation. Each module has clear inputs, outputs, and a defined responsibility boundary.
- **Orchestrator (mod.rs)**: The central coordinator that calls into each module in sequence to produce the final `GlobalLayout`. After refactoring, it should contain only high-level flow control.
- **Data Extraction Types**: Internal structs (`InstrumentData`, `StaffData`, `VoiceData`, `NoteEvent`, `RestLayoutEvent`) that represent parsed score data used as input to positioning algorithms.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `mod.rs` file is reduced from ~3,750 lines to under 600 lines, containing only orchestration logic.
- **SC-002**: At least 7 new focused modules are created from the extracted responsibilities.
- **SC-003**: 100% of existing layout engine tests pass after the refactoring with no modifications to test assertions.
- **SC-004**: The layout README contains a module-by-module description and a rendered mermaid diagram that matches the actual codebase structure.
- **SC-005**: No new public API surfaces are introduced — the refactoring is purely internal.
- **SC-006**: A developer unfamiliar with the layout engine can identify which file to modify for a given task (e.g., "fix barline rendering") by reading only the README and file names, without needing to search through the orchestrator.

## Clarifications

### Session 2026-03-18

- Q: How should the ~1,600-line `compute_layout` body be decomposed to meet the SC-001 target of <600 lines in `mod.rs`? → A: Break `compute_layout` into delegating calls to functions in the new modules; `mod.rs` calls them sequentially while each phase lives in its extracted module.
- Q: Should existing tests in `mod.rs` be kept together or distributed across new modules? → A: Distribute tests into per-module `#[cfg(test)]` blocks so each module is self-contained and testable in isolation (Rust convention).
- Q: Where should `LayoutConfig` live after the refactoring, given all extracted modules need it? → A: Move `LayoutConfig` into `types.rs` alongside the other shared data structures (`GlobalLayout`, `System`, `Glyph`, etc.) to avoid circular dependencies.
- Q: What level of detail should the mermaid architecture diagram capture? → A: Show call-flow arrows (orchestrator → modules) and a single shared types dependency; omit per-module type import arrows to keep the diagram readable at a glance.
- Q: Should the annotations module (ties, slurs, dots, ledger lines) be one file or split further? → A: Keep them in a single `annotations.rs` with separate functions per concern; each is 50–120 lines, so splitting further would create unnecessary fragmentation.

## Assumptions

- The existing module decomposition (`types.rs`, `spacer.rs`, `breaker.rs`, `positioner.rs`, `batcher.rs`, `beams.rs`, `stems.rs`, `metrics.rs`, `wasm.rs`) is well-structured and does not need further splitting.
- The refactoring is a pure structural change — no behavioral changes, performance optimizations, or bug fixes are included in scope.
- The mermaid diagram will be embedded within the README as a fenced code block so it renders natively on GitHub.
- Internal visibility (`pub(crate)`) is preferred over fully public visibility for extracted functions to maintain encapsulation.

