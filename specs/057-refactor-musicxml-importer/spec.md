# Feature Specification: Refactor MusicXML Importer

**Feature Branch**: `057-refactor-musicxml-importer`  
**Created**: 2025-03-25  
**Status**: Draft  
**Input**: User description: "Refactor MusicXML importer. This critical piece of code has huge files with lots of responsibilities inside. It is time to do a first refactor of it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain Identical Import Results After Refactor (Priority: P1)

As a user importing a MusicXML score, I expect the refactored importer to produce exactly the same results as the current importer — the same notes, voices, staves, timing, articulations, metadata, warnings, and statistics — so that my experience is completely unaffected by internal changes.

**Why this priority**: The entire value of this refactor hinges on zero behavioral regressions. If any import output changes, the refactor has failed regardless of how clean the code becomes.

**Independent Test**: Import every existing test fixture and real-world score through both the old and new code paths, comparing outputs byte-for-byte or structurally. All 70+ existing integration tests must pass without modification.

**Acceptance Scenarios**:

1. **Given** a single-staff MusicXML file, **When** imported through the refactored importer, **Then** the resulting score, metadata, statistics, and warnings are identical to the pre-refactor output.
2. **Given** a multi-staff piano MusicXML file with repeats, voltas, octave shifts, and articulations, **When** imported through the refactored importer, **Then** all musical elements are preserved identically.
3. **Given** a malformed or partially valid MusicXML file, **When** imported through the refactored importer, **Then** the same warnings and errors are produced with the same severity and context.
4. **Given** a compressed .mxl file, **When** imported through the refactored importer, **Then** decompression and import produce identical results.

---

### User Story 2 - Easier Maintenance for Developers (Priority: P2)

As a developer working on the importer, I want each source file to have a single, clear responsibility so that when I need to fix a bug or add support for a new MusicXML element, I can quickly find the relevant code and make changes with confidence.

**Why this priority**: The primary motivation for the refactor is developer productivity. Large files with mixed responsibilities slow down onboarding, debugging, and feature development.

**Independent Test**: A new developer (or reviewer) can locate the code responsible for parsing a specific MusicXML element (e.g., note articulations, barline types, octave shifts) within a single, clearly-named module without needing to search through 1,000+ line files.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** a developer searches for note-parsing logic, **Then** it is contained in a dedicated, focused module rather than scattered in a large monolithic file.
2. **Given** the refactored codebase, **When** a developer searches for voice distribution logic, **Then** it is in its own module separate from measure conversion and timing calculations.
3. **Given** the refactored codebase, **When** a developer needs to add a new articulation type, **Then** they can do so by modifying a single focused module without risk of affecting unrelated parsing or conversion logic.

---

### User Story 3 - Improved Test Isolation (Priority: P3)

As a developer writing tests, I want the importer's internal components to be independently testable so that I can write targeted unit tests for specific behaviors (voice distribution, timing calculation, note parsing) without needing full end-to-end import fixtures.

**Why this priority**: Currently, most testing is done via integration tests. Smaller, focused modules enable unit tests that are faster, more precise, and easier to debug when they fail.

**Independent Test**: New unit tests can be written for individual sub-modules (e.g., voice distributor, timing context, note parser) using minimal test inputs rather than full MusicXML documents.

**Acceptance Scenarios**:

1. **Given** the voice distribution logic as a standalone component, **When** tested with overlapping note data, **Then** it correctly assigns voices without requiring a full MusicXML parse.
2. **Given** the timing calculation logic as a standalone component, **When** tested with various time signatures and note durations, **Then** it produces correct tick values without requiring measure or part context.
3. **Given** individual parsing sub-modules, **When** tested with minimal XML fragments, **Then** they correctly parse their specific element types.

---

### Edge Cases

- What happens if the refactored module structure is imported by external callers (CLI, REST API, WASM)? All public entry points must remain stable.
- How does the refactor handle any in-flight feature branches that modify the importer? Merge conflicts should be minimized by preserving function signatures where possible.
- What happens if a sub-module introduces a new error type? The warning/error collection system must continue to work uniformly across all sub-modules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The refactored importer MUST produce identical import results (score, metadata, statistics, warnings) for all existing test fixtures and real-world scores.
- **FR-002**: The parser module (~1,100 lines) MUST be decomposed into smaller, focused sub-modules organized by the MusicXML element types they handle (e.g., notes, measures, barlines, directions).
- **FR-003**: The converter module (~1,300 lines) MUST be decomposed into smaller, focused sub-modules organized by conversion concern (e.g., voice distribution, timing, structural markers, clef/key changes).
- **FR-004**: Each sub-module MUST have a single, clearly defined responsibility that can be described in one sentence.
- **FR-005**: The public interface of the importer (the trait and its methods) MUST remain unchanged so that all callers (REST API, CLI, library) continue to work without modification.
- **FR-006**: All existing integration tests (70+ tests) MUST pass without modification after the refactor.
- **FR-007**: The intermediate data types MUST remain in a dedicated types module, but large compound types (e.g., `NoteData` with 15+ fields) SHOULD be reorganized into logical groupings where beneficial.
- **FR-008**: The warning and error collection system MUST continue to provide measure-level, instrument-level, and staff-level context across all sub-modules.
- **FR-009**: The module structure MUST allow new unit tests to be written for individual sub-modules in isolation.
- **FR-010**: The refactored code MUST maintain the existing streaming parsing approach for memory efficiency.

### Key Entities

- **Parser Sub-modules**: Focused units that each handle parsing of a specific set of MusicXML elements (notes, measures, attributes, barlines, directions) from raw XML into intermediate types.
- **Converter Sub-modules**: Focused units that each handle a specific conversion concern (voice distribution, timing calculation, structural markers, staff routing) from intermediate types to domain score entities.
- **Import Context**: The warning/error accumulator that threads through all sub-modules, collecting diagnostics with positional context.
- **Intermediate Types**: The data structures (NoteData, MeasureData, etc.) that bridge parsing and conversion, potentially reorganized into logical sub-groupings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No source file in the importer module exceeds 400 lines (down from the current 1,100 and 1,300 line files).
- **SC-002**: 100% of existing integration tests pass without any test modifications.
- **SC-003**: Each sub-module has a single responsibility describable in one sentence, verified by code review.
- **SC-004**: A developer unfamiliar with the codebase can locate the code for any specific MusicXML feature (e.g., octave shifts, volta brackets, voice distribution) within 2 minutes by reading module names and their top-level documentation.
- **SC-005**: New unit tests can be written for at least 3 previously untestable-in-isolation components (voice distribution, timing calculation, and one parsing sub-module).
- **SC-006**: The refactored importer processes the existing benchmark scores with no measurable performance degradation (within 5% of pre-refactor timing).

## Assumptions

- The refactor is purely structural — no new MusicXML features or elements will be added in this scope.
- The existing 70+ integration tests provide sufficient coverage to detect behavioral regressions.
- The public trait `IMusicXMLImporter` and its result types (`ImportResult`, `ImportMetadata`, `ImportStatistics`, `ImportWarning`) will not change their signatures or semantics.
- The current streaming XML parsing approach (quick-xml) is retained; no parser library changes.
- The 400-line-per-file target is a guideline, not an absolute rule — files may slightly exceed this if splitting would harm cohesion.
- Voice distribution logic, timing calculation, and structural marker collection are the primary candidates for extraction from the converter module.
- Note parsing, measure parsing, barline parsing, and direction parsing are the primary candidates for extraction from the parser module.

## Scope Boundaries

### In Scope

- Decomposing `parser.rs` into focused sub-modules
- Decomposing `converter.rs` into focused sub-modules
- Reorganizing `NoteData` and related types into logical sub-groupings if beneficial
- Adding module-level documentation to each new sub-module
- Ensuring all existing tests pass unchanged

### Out of Scope

- Adding support for new MusicXML elements or features
- Changing the public API or trait interface
- Migrating to a different XML parsing library
- Adding WASM support for .mxl compression
- Performance optimization beyond maintaining current levels
- Rewriting the test suite (tests should run as-is)

