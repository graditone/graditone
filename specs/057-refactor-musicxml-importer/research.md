# Research: Refactor MusicXML Importer

**Feature**: 057-refactor-musicxml-importer  
**Date**: 2025-03-25

## 1. Parser Decomposition Strategy

### Decision: Split parser.rs into 5 sub-modules using a parser/ directory

### Rationale

The parser has a clean tree-shaped call hierarchy with clear leaf clusters. The `Reader<B>` mutable reference threads linearly through the tree — each function consumes XML events sequentially, making it safe to split by responsibility while passing the reader reference. Each cluster uses a disjoint set of output types.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Single file with regions/comments | Does not improve testability or navigability at 1,395 lines |
| Trait-based sub-parsers | Over-engineered: no runtime polymorphism needed; simple function calls sufficient |
| Parsing combinators (nom-style) | Would require rewriting the entire parser; out of scope |

### Proposed Sub-modules

| Sub-module | Functions | Lines | Responsibility |
|------------|----------|-------|----------------|
| `parser/mod.rs` | `parse`, `parse_score_partwise`, `parse_part_list`, `parse_work`, `parse_identification`, `parse_part` | ~270 | Parser entry point and document-level orchestration |
| `parser/measure.rs` | `parse_measure` | ~137 | Central measure hub — routes to element-specific parsers |
| `parser/note.rs` | `parse_note`, `parse_notations`, `parse_technical`, `parse_articulations`, `parse_pitch`, `parse_duration_element` | ~442 | Note/rest element parsing with articulations and pitch |
| `parser/attributes.rs` | `parse_attributes`, `parse_key`, `parse_time_signature`, `parse_clef` | ~200 | Notation context parsing (key, clef, time signature) |
| `parser/structure.rs` | `parse_barline_content`, `parse_direction` | ~198 | Barline/repeat and direction/octave-shift parsing |

**Total**: 5 files, largest ~442 lines (note.rs — acceptable given high cohesion of note sub-parsing functions).

### Cross-Module Dependencies

All sub-modules need:
- `&mut Reader<B: BufRead>` — the streaming XML reader (passed as parameter)
- Types from `types.rs` — intermediate data structures (imported)
- `ImportError` from `errors.rs` — for Result return types

No circular dependencies: the call graph is a strict tree from `mod.rs` → `measure.rs` → `{note, attributes, structure}.rs`.

### Visibility Pattern

- `parser/mod.rs` exposes `pub fn parse(xml: &str) -> Result<MusicXMLDocument, ImportError>`
- Internal sub-module functions are `pub(super)` — visible within `parser/` but not exposed outside
- Re-exports in `parser/mod.rs` maintain the existing public API surface

---

## 2. Converter Decomposition Strategy

### Decision: Split converter.rs into 6 sub-modules using a converter/ directory

### Rationale

The converter has 10 distinct responsibility clusters with ~1,645 lines total. The `TimingContext` struct and `measure_end_ticks` array are the primary shared state, but they're passed as parameters rather than stored as mutable global state. Each cluster's functions share internal data patterns but are loosely coupled to other clusters.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Keep as single file with doc sections | Same problem: hard to navigate, test, and review |
| Extract traits for each concern | Over-engineered: functions are internal, not polymorphic |
| Merge VoiceDistributor into note collection | VoiceDistributor is a clean, self-contained component with independent testability |

### Proposed Sub-modules

| Sub-module | Clusters | Lines | Responsibility |
|------------|----------|-------|----------------|
| `converter/mod.rs` | Orchestrator + helpers | ~170 | `convert()` entry point, `convert_part()`, measure tick helpers (`measure_start_tick`, `measure_end_tick`, `actual_measure_start`, `actual_measure_end`) |
| `converter/staff.rs` | Staff Routing + Key/Clef Changes | ~310 | `convert_multi_staff()`, `convert_staff_for_single_staff()`, `add_key_changes_from_measures()`, `add_clef_changes_from_measures()` |
| `converter/notes.rs` | Note Collection + Note Conversion + Rest Distribution | ~400 | `collect_notes()`, `collect_notes_for_staff()`, `distribute_rests()`, `convert_note()` |
| `converter/ties.rs` | Tie & Slur Resolution | ~90 | `resolve_tie_chains()`, `resolve_slur_chains()` |
| `converter/structure.rs` | Structural Markers + Pickup Detection | ~290 | `detect_pickup_ticks()`, `compute_measure_end_ticks()`, `collect_repeat_barlines()`, `collect_volta_brackets()`, `collect_octave_shift_regions()` |
| `converter/voice.rs` | Voice Distribution | ~110 | `VoiceDistributor` struct and its implementation |

**Total**: 6 files, largest ~400 lines (notes.rs — contains tightly coupled collection + conversion logic).

### Shared State Threading

| State | Generated In | Consumed In | Thread Via |
|-------|-------------|-------------|-----------|
| `measure_end_ticks: Vec<u32>` | `structure.rs` (`compute_measure_end_ticks`) | `mod.rs`, `structure.rs`, `staff.rs` | Parameter |
| `pickup_ticks: u32` | `structure.rs` (`detect_pickup_ticks`) | `mod.rs`, `structure.rs`, `staff.rs` | Parameter |
| `TimingContext` | `notes.rs` (local per call) | `notes.rs`, `structure.rs` | Local construction |
| `ImportContext` | `mod.rs` | All sub-modules | `&mut ImportContext` parameter |

No global mutable state. All sharing is through explicit parameter passing.

### Visibility Pattern

- `converter/mod.rs` exposes `pub struct MusicXMLConverter` and `pub fn convert()`
- Internal functions are `pub(super)` within `converter/`
- `TimingContext` moves to `converter/mod.rs` or stays in dedicated file (used by multiple sub-modules)
- `VoiceDistributor` is `pub(super)` — exposed for unit testing via `#[cfg(test)]` if needed

---

## 3. Rust Module Pattern: File → Directory Migration

### Decision: Use the standard Rust `mod/` directory pattern

### Rationale

Rust's module system natively supports converting a file `foo.rs` into a directory `foo/mod.rs` without changing any external imports. The compiler treats both identically. This is the standard approach for decomposing large modules.

### Migration Steps

1. Rename `parser.rs` → `parser/mod.rs` (git move preserves history)
2. Create `parser/note.rs`, `parser/measure.rs`, etc.
3. Add `mod note; mod measure;` declarations in `parser/mod.rs`
4. Move functions to their target sub-modules
5. Repeat for converter
6. Run `cargo test` after each step to catch regressions

### Risk Mitigation

- **Git history**: Use `git mv` to create the directory, then extract functions. This preserves blame for the mod.rs file.
- **Compilation**: Each sub-module addition can be verified independently with `cargo check`.
- **Tests**: All 70+ integration tests run on each step as regression guard.

---

## 4. TimingContext Placement

### Decision: Keep TimingContext in converter/mod.rs (re-exported to sub-modules)

### Rationale

`TimingContext` is used by `notes.rs`, `structure.rs`, and could be used by future sub-modules. Placing it in `converter/mod.rs` makes it importable as `super::TimingContext` from any converter sub-module. It's small (~40 lines) and doesn't warrant its own file.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Keep in timing.rs (existing module) | Wrong ownership: `timing.rs` has fraction math, not converter-specific state |
| Create converter/timing_context.rs | Over-splitting: 40 lines is too small for a standalone file |

---

## 5. NoteData Type Reorganization

### Decision: Keep NoteData as a flat struct in types.rs; do not split into sub-structs

### Rationale

The 17 fields on `NoteData` are all consumed together in `convert_note()`. Splitting into sub-structs (e.g., `NoteArticulations { staccato, beams, slurs }`) would add indirection without reducing complexity — the parser populates all fields in one pass, and the converter reads all fields in one pass. The type is an intermediate data transfer object, not a domain entity with behavioral invariants.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Group into `NoteTimingData`, `NoteArticulationData`, etc. | Adds 3-4 new types with no consumer benefit; all fields read together |
| Use builder pattern | Over-engineered for a struct populated once and consumed once |

---

## 6. Test Strategy for Refactored Code

### Decision: Three-tier testing approach

### Rationale

The refactor enables new unit tests while preserving existing integration coverage. The three tiers complement each other.

### Tiers

1. **Existing Integration Tests (unchanged)**: 70+ tests in `musicxml_import_test.rs` validate full pipeline correctness. These are the primary regression safety net.

2. **New Unit Tests for Extracted Components**: 
   - `VoiceDistributor`: Test with handcrafted `Note` vectors (overlapping, edge cases)
   - `TimingContext`: Test `advance_by_duration()` with various fractions and divisions
   - `resolve_tie_chains()` / `resolve_slur_chains()`: Test with minimal note lists
   - `parse_barline_content()` / `parse_direction()`: Test with XML fragments via `quick-xml::Reader::from_str()`

3. **Compilation Check**: `cargo check` after each file move verifies all imports and visibility are correct.

---

## 7. Performance Verification Approach

### Decision: Use existing cargo bench infrastructure if available; otherwise compare test suite wall-clock time

### Rationale

Per SC-006, the refactored importer must be within 5% of pre-refactor performance. Since this is a pure code reorganization with no algorithmic changes, performance should be identical — Rust inlines across module boundaries, and module structure has zero runtime cost.

### Verification Steps

1. Before refactoring: run `cargo test` 3 times, record average wall-clock time
2. After refactoring: run `cargo test` 3 times, compare
3. If benchmarks exist in `backend/benches/`: run before and after

---

## Summary: All NEEDS CLARIFICATION Resolved

No unknowns remain. The Technical Context section in plan.md has no NEEDS CLARIFICATION markers. All research decisions are backed by codebase analysis of the actual function signatures, call graphs, and type usage patterns.
