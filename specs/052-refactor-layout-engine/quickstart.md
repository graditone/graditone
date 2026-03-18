# Quickstart: Refactor Layout Engine

**Branch**: `052-refactor-layout-engine`

## Overview

This is a pure structural refactoring of `backend/src/layout/mod.rs`. No new features, no behavior changes. The goal is to split the 5,012-line monolith into 7 focused sibling modules.

## Prerequisites

- Rust 1.93.0 (stable)  
- Working directory: `backend/`

## Baseline Verification

Before starting any work, confirm all tests pass:

```bash
cd backend
cargo test
# Expected: All tests pass (160+ tests, 0 failed)
```

## Incremental Extraction Order

Perform extractions one module at a time. After each step, run `cargo test` to confirm zero regressions.

### Step 1: Move `LayoutConfig` to `types.rs`

1. Copy `LayoutConfig` struct + `Default` impl from `mod.rs` into `types.rs`
2. Add `pub use types::LayoutConfig;` to `mod.rs` re-exports
3. Delete `LayoutConfig` definition from `mod.rs`
4. Run `cargo test` → must pass

### Step 2: Create `extraction.rs`

1. Create `backend/src/layout/extraction.rs`
2. Move into it: tick helpers (6 functions) + data types (`InstrumentData`, `StaffData`, `VoiceData`, `NoteEvent`, `RestLayoutEvent`, `NoteData`) + `extract_measures` + `extract_instruments`
3. Change visibility of all moved items to `pub(crate)` (except `NoteData` which stays `pub`)
4. Add `pub mod extraction;` to `mod.rs`
5. Update `compute_layout` in `mod.rs` to use `extraction::*`
6. Move relevant tests to `extraction.rs #[cfg(test)]`
7. Run `cargo test` → must pass

### Step 3: Create `assembly.rs`

1. Create `backend/src/layout/assembly.rs`
2. Move `create_staff_lines` (and extracted inline helpers for bounding box + volta + measure numbers)
3. Add `pub(crate) mod assembly;` to `mod.rs`
4. Move staff lines tests to `assembly.rs #[cfg(test)]`
5. Run `cargo test` → must pass

### Step 4: Create `barlines.rs`

1. Create `backend/src/layout/barlines.rs`
2. Move `create_bar_lines`, `create_bar_line_segments`, `compute_repeat_dots`
3. Extract inline barline-joining logic from `compute_layout` into `render_system_barlines`
4. Add `pub(crate) mod barlines;` to `mod.rs`
5. Run `cargo test` → must pass

### Step 5: Create `staff_groups.rs`

1. Create `backend/src/layout/staff_groups.rs`
2. Move `create_bracket_glyph`
3. Extract inline collision + assembly logic from `compute_layout` into `compute_collision_gap`, `assemble_staff_groups`
4. Add `pub(crate) mod staff_groups;` to `mod.rs`
5. Move bracket tests to `staff_groups.rs #[cfg(test)]`
6. Run `cargo test` → must pass

### Step 6: Create `structural.rs`

1. Create `backend/src/layout/structural.rs`
2. Extract inline structural glyph blocks from `compute_layout` into `render_system_start_glyphs`, `render_mid_system_changes`
3. Add `pub(crate) mod structural;` to `mod.rs`
4. Move time signature tests to `structural.rs #[cfg(test)]`
5. Run `cargo test` → must pass

### Step 7: Create `annotations.rs`

1. Create `backend/src/layout/annotations.rs`
2. Extract inline tie/slur/dot blocks from `compute_layout` into `render_ties`, `render_slurs`, `render_notation_dots`
3. Add `pub(crate) mod annotations;` to `mod.rs`
4. Run `cargo test` → must pass

### Step 8: Create `note_layout.rs`

1. Create `backend/src/layout/note_layout.rs`
2. Move `compute_unified_note_positions`, `position_glyphs_for_staff`, `compute_staff_note_extents`, `shift_dot_to_space`
3. Add `pub(crate) mod note_layout;` to `mod.rs`
4. Move note-positioning and beaming tests to `note_layout.rs #[cfg(test)]`
5. Run `cargo test` → must pass

### Step 9: Update README + Verify Final State

1. Update `backend/src/layout/README.md`:
   - Add full module listing with one-line descriptions
   - Add mermaid flowchart diagram
2. Run `cargo clippy -- -D warnings` → must pass (no new warnings)
3. Run `cargo test` → final verification (must still be 0 failures)
4. Check `wc -l backend/src/layout/mod.rs` → must be ≤ 600 lines

## Verifying Success

```bash
# 1. Zero regressions
cargo test 2>&1 | grep "test result"

# 2. Clean Clippy
cargo clippy -- -D warnings

# 3. Orchestrator size
wc -l backend/src/layout/mod.rs   # expect ≤ 600

# 4. Seven new modules exist
ls backend/src/layout/*.rs

# 5. README has mermaid
grep -l "mermaid" backend/src/layout/README.md
```

## Key Principles

- **One module at a time** — compile and test after every file move
- **No logic changes** — copy code verbatim, only adjust `use` paths and visibility
- **`pub(crate)` by default** — all moved functions use `pub(crate)` unless already `pub`
- **Tests follow functions** — each test moves to the module that owns the function it tests
