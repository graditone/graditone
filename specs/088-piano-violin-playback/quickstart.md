# Quickstart — Feature 088: Piano and Violin Playback Support

**Branch**: `088-piano-violin-playback`

---

## Prerequisites

- Rust toolchain (latest stable) + `wasm-pack` installed
- Node.js 20+ with `npm`
- Docker (for backend WASM build if needed)

---

## 1. Build the WASM module (after backend changes)

The backend Rust code must be compiled to WASM whenever `backend/src/` changes:

```bash
# From repo root
cd backend
wasm-pack build --target web --out-dir ../frontend/public/wasm
```

Or using the project script:

```bash
./backend/scripts/build-wasm.sh
```

> **Note**: This feature modifies `backend/src/domain/instrument.rs` and `backend/src/domain/importers/musicxml/converter/mod.rs`. Always rebuild WASM after those changes before testing playback.

---

## 2. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## 3. Run the development server

```bash
cd frontend
npm run dev
```

The app is available at `http://localhost:5173`.

---

## 4. Test multi-instrument playback manually

1. Open the app in the browser.
2. Load one of the bundled scores that contains multiple instruments — the Pachelbel Canon (`Pachelbel_CanonD.mxl`) has multiple string parts and is ideal.
3. Navigate to **Play Score**.
4. Verify:
   - Each instrument part plays with a distinct timbre.
   - Mute toggles appear at the left of each instrument name label.
   - Toggling mute silences/unsimplences the part immediately.
   - Volume sliders adjust per-instrument loudness.
   - Reloading the page restores the previously set volume levels.

---

## 5. Run unit tests

```bash
# Frontend unit tests (Vitest)
cd frontend
npm run test

# Backend Rust tests
cd backend
cargo test
```

### Key test files for this feature

| File | What it tests |
|------|---------------|
| `frontend/src/services/playback/PlaybackChannel.test.ts` | Synth config, mute/volume, timbre structure |
| `frontend/src/services/playback/ToneAdapter.test.ts` | Multi-channel routing, channel lifecycle |
| `frontend/src/services/hooks/useInstrumentMixer.test.ts` | Mute toggle, volume persistence, initMixer |
| `frontend/src/services/playback/InstrumentTimbres.test.ts` | Timbre registry, piano vs violin config |
| `backend/src/domain/instrument.rs` (inline tests) | `classify_instrument_type()` name + program mapping |

### Critical test: SC-002 (timbre distinction)

The `InstrumentTimbres.test.ts` file must include a test asserting:
- Piano → `source: 'sampler'`
- Violin → `source: 'polysynth'` with `oscillatorType: 'triangle'` and distinct ADSR

```typescript
it('piano uses sampler and violin uses polysynth with distinct configuration', () => {
  const pianoTimbre = getTimbre('piano');
  const violinTimbre = getTimbre('violin');
  expect(pianoTimbre.source).toBe('sampler');
  expect(violinTimbre.source).toBe('polysynth');
  expect(violinTimbre.oscillatorType).toBe('triangle');
  expect(violinTimbre.envelope?.attack).toBeGreaterThan(0.05); // bowed attack
});
```

---

## 6. Run end-to-end tests

```bash
cd frontend
npx playwright test
```

E2E tests for this feature are in `frontend/e2e/playback-multi-instrument.spec.ts`.

---

## 7. Rust WASM unit tests (instrument classification)

```bash
cd backend
cargo test classify_instrument
```

---

## Troubleshooting

### Piano samples don't load in dev

Piano samples are served from `public/audio/salamander/`. If the dev server returns 404s for `.mp3` files, check that the `public/audio/salamander/` directory is present. It is bundled in the repo and served statically by Vite.

### Violin sounds like piano

If the violin part still plays with piano timbre, check:
1. The WASM module was rebuilt after `instrument.rs` changes (`wasm-pack build` in `backend/`).
2. `score.instruments[1].instrument_type` is `"violin"` (not `"piano"`) in the parsed score — open browser DevTools → Application → Sources → inspect the loaded score JSON.
3. `ToneAdapter.initChannel(1, violinTimbre)` was called before `scheduleNotes` — set a breakpoint in `ToneAdapter.ts`.

### Volume not persisted after reload

Check the active profile. `scopedSetItem` is a no-op when no profile is active. Open DevTools → Application → Local Storage and confirm `graditone-active-profile` is set.
