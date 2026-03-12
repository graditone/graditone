# Quickstart: Volta Bracket Playback (Feature 047)

**Branch**: `047-repeat-volta-playback`  
**Date**: 2026-03-12

---

## Prerequisites

- Rust toolchain (stable, 2024 edition) — `rustup update stable`
- wasm-pack — `cargo install wasm-pack`
- Node.js 22+ — `nvm use 22`
- Dependencies installed — `npm install` inside `frontend/`

---

## Building

### Rust backend + WASM

```bash
# From repo root — runs all Rust tests (native, ~10s)
cd backend && cargo test

# Run only the new volta bracket integration tests
cargo test --test volta_brackets_integration

# Build WASM for the frontend
cd .. && ./build-wasm.sh   # or: cd backend && wasm-pack build --target web
```

### Frontend

```bash
cd frontend
npm run build        # production build
npm run test         # runs all Vitest unit tests
npm run test -- RepeatNoteExpander  # run only volta-bracket unit tests
```

---

## Verifying the Feature End-to-End

### 1. Rust — MusicXML import test

After implementation, this test should pass:

```bash
cd backend
cargo test --test volta_brackets_integration test_lacandeur_volta_brackets
```

Expected: La Candeur parses 1 volta bracket — number=1, measure_index=15, start_tick=57600, end_tick=61440, end_type=Stop.

### 2. TypeScript — Playback expander unit test

```bash
cd frontend
npm run test -- RepeatNoteExpander
```

Expected: All tests in `RepeatNoteExpander.test.ts` pass, including:
- `volta bracket - first ending skipped on second pass`
- `volta bracket - second ending plays on second pass`
- `no change without volta brackets` (regression guard)

### 3. Browser — manual play test

1. `npm run dev` in `frontend/`
2. Open the app at `http://localhost:3000`
3. Upload `scores/Burgmuller_LaCandeur.mxl`
4. Press Play — observe that playback follows the repeat and measure 16 is not replayed

After the render implementation (FR-008):
5. Upload `scores/Burgmuller_Arabesque.mxl`  
6. Verify "1." and "2." bracket lines appear above measures 10 and 11 in the notation view

---

## Key Files Changed

| File | Change |
|------|--------|
| `backend/src/domain/repeat.rs` | Add `VoltaBracket`, `VoltaEndType` |
| `backend/src/domain/score.rs` | Add `volta_brackets: Vec<VoltaBracket>` |
| `backend/src/domain/importers/musicxml/parser.rs` | Parse `<ending>` in `parse_barline_content` |
| `backend/src/domain/importers/musicxml/mapper.rs` | Accumulate and emit `VoltaBracket` values |
| `backend/src/adapters/dtos.rs` | Add `volta_brackets` field, bump schema to v7 |
| `backend/src/layout/types.rs` | Add `VoltaBracketLayout`, add to `System` |
| `backend/src/layout/mod.rs` | Compute and output `VoltaBracketLayout` elements |
| `backend/tests/volta_brackets_integration.rs` | New integration tests |
| `frontend/src/types/score.ts` | Add `VoltaBracket`, `VoltaEndType`, add to `Score` |
| `frontend/src/wasm/layout.ts` | Add `VoltaBracketLayout`, add to `System` |
| `frontend/src/services/playback/RepeatNoteExpander.ts` | Skip first-ending on second pass |
| `frontend/src/services/playback/RepeatNoteExpander.test.ts` | New unit tests |
| `frontend/src/components/notation/NotationRenderer.tsx` | Render volta brackets |

---

## Acceptance Check (SC-001 to SC-005 fast verification)

```bash
# SC-001 / SC-002 / SC-003 / SC-004 — playback correctness
cd frontend && npm run test -- RepeatNoteExpander

# SC-001 (Rust import) — La Candeur volta bracket count
cd backend && cargo test test_lacandeur_volta_brackets

# SC-002 (Rust import) — Arabesque volta bracket count
cd backend && cargo test test_arabesque_volta_brackets

# SC-004 — regression guard: no volta brackets = no change
cd frontend && npm run test -- "no change without volta brackets"
```

Visual SC-005 (bracket rendering) is verified manually in the browser.
