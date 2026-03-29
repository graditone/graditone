# Quickstart: MIDI Volume Control (Feature 063)

**Branch**: `063-midi-volume-control`

## Prerequisites

- Rust toolchain (stable) + wasm-pack
- Node.js 18+ with pnpm/npm
- A MIDI keyboard (optional, for MIDI CC testing)

## Build & Run

```bash
# 1. Build backend WASM module
cd backend
wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg
cd ..

# 2. Start frontend dev server
cd frontend
npm install
npm run dev
```

## Verify Dynamics Playback (P1)

1. Open the app in a browser: `http://localhost:5173`
2. Load `scores/Chopin_NocturneOp9No2.mxl` (richest dynamics: p, pp, f, crescendo, diminuendo)
3. Press **Play**
4. Listen for volume variation — soft passages (pp) should be clearly quieter than loud passages (f)
5. Verify: notes within crescendo wedges gradually increase in volume

**Regression check**: Load `scores/Pachelbel_CanonD.mxl` (no dynamics). All notes should play at uniform moderate volume (mf default), same as before this feature.

## Verify MIDI Touch Response (P2)

1. Connect a MIDI keyboard
2. Play a note very softly → should produce a quiet sound
3. Play a note very hard → should produce a loud sound
4. If your keyboard has a volume knob (CC7) → adjusting it should change overall volume
5. If your keyboard has an expression pedal (CC11) → adjusting it should change volume independently

## Verify Master Volume (P3)

1. While playing back a score, locate the vertical volume slider in the playback toolbar
2. Drag it down → sound should get quieter smoothly
3. Drag it to minimum → sound should be silent
4. Drag it to maximum → sound should be at full level with no distortion
5. Refresh the page → volume slider should be at the same position you left it

## Run Tests

```bash
# Backend unit tests (dynamics parsing)
cd backend
cargo test dynamics

# Frontend unit tests
cd frontend
npm run test -- --run

# E2E tests
cd frontend
npx playwright test dynamics-playback
```

## Key Files (Quick Reference)

| Layer | File | What Changed |
|-------|------|-------------|
| Rust domain | `backend/src/domain/events/dynamics.rs` | NEW: DynamicMarking, GradualDynamic types |
| Rust parser | `backend/src/domain/importers/musicxml/parser/structure.rs` | Extended: parse `<dynamics>`, `<wedge>`, `<sound dynamics>` |
| Rust types | `backend/src/domain/importers/musicxml/types.rs` | Extended: Dynamics/Wedge variants in MeasureElement |
| Rust WASM | `backend/src/adapters/wasm/bindings.rs` | Extended: ScoreDto includes dynamics arrays |
| TS types | `frontend/src/types/score.ts` | Extended: Note.velocity, DynamicMarking, GradualDynamic |
| TS playback | `frontend/src/services/playback/ToneAdapter.ts` | Extended: playNote() accepts velocity; master volume |
| TS scheduler | `frontend/src/services/playback/PlaybackScheduler.ts` | Extended: forwards velocity to playNote() |
| TS dynamics | `frontend/src/services/playback/DynamicsResolver.ts` | NEW: resolves velocity at any tick |
| TS volume | `frontend/src/services/playback/volumeUtils.ts` | NEW: logarithmic curve, CC scaling |
| TS MIDI | `frontend/src/services/recording/midiUtils.ts` | Extended: parseMidiCC() |
| TS MIDI hook | `frontend/src/services/recording/useMidiInput.ts` | Extended: CC7/CC11 callbacks |
| UI | `frontend/src/components/ScoreViewer.tsx` | Extended: vertical volume slider in toolbar |
