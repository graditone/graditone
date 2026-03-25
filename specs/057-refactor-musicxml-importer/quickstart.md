# Quickstart: Refactor MusicXML Importer

**Feature**: 057-refactor-musicxml-importer  
**Date**: 2025-03-25

## Prerequisites

- Rust toolchain (latest stable)
- Working `cargo test` in `backend/`

## Before Starting

```bash
cd backend
cargo test -- musicxml 2>&1 | tail -5   # Record baseline: all 70+ tests pass
```

## Implementation Order

### Step 1: Decompose parser.rs → parser/ directory

```bash
# Create directory structure
mkdir -p src/domain/importers/musicxml/parser

# Move file to directory module
git mv src/domain/importers/musicxml/parser.rs src/domain/importers/musicxml/parser/mod.rs

# Verify compilation
cargo check

# Create sub-modules (empty initially, then extract functions)
touch src/domain/importers/musicxml/parser/{measure,note,attributes,structure}.rs
```

For each sub-module:
1. Add `mod measure;` declaration in `parser/mod.rs`
2. Move target functions from `parser/mod.rs` → sub-module
3. Add necessary `use` imports in the sub-module
4. Make moved functions `pub(super)` visibility
5. Run `cargo check` to verify
6. Run `cargo test -- musicxml` to verify regression

### Step 2: Decompose converter.rs → converter/ directory

```bash
# Create directory structure
mkdir -p src/domain/importers/musicxml/converter

# Move file to directory module
git mv src/domain/importers/musicxml/converter.rs src/domain/importers/musicxml/converter/mod.rs

# Verify compilation
cargo check

# Create sub-modules
touch src/domain/importers/musicxml/converter/{staff,notes,ties,structure,voice}.rs
```

Same extraction process as parser: move functions, adjust visibility, check, test.

### Step 3: Verify everything

```bash
cargo test -- musicxml           # All 70+ tests pass
cargo clippy                      # No new warnings
cargo check --target wasm32-unknown-unknown  # WASM still compiles (if applicable)
```

## Key Decisions Reference

- **TimingContext** stays in `converter/mod.rs` (small, used by multiple sub-modules)
- **NoteData** stays flat in `types.rs` (no sub-struct splitting)
- **VoiceDistributor** moves to `converter/voice.rs`
- All functions moved to sub-modules use `pub(super)` visibility
- Re-exports in parent `mod.rs` ensure external imports unchanged

## Verification Checklist

- [ ] `cargo test` passes (all 70+ musicxml tests)
- [ ] `cargo clippy` clean
- [ ] No file exceeds 450 lines
- [ ] Each sub-module has a module-level doc comment describing its responsibility
- [ ] `git diff --stat` shows only the musicxml/ directory changed
