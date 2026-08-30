# Quickstart: Fix Tempo Display on Metronome Slider (Feature 093)

Validation guide for the free-practice tempo readout fix. Details in [contracts/free-practice-tempo-contract.md](contracts/free-practice-tempo-contract.md) and [data-model.md](data-model.md).

## Prerequisites

- `cd frontend && npm install` (already present in a dev environment)
- A Web MIDI device or virtual MIDI loopback for the manual end-to-end check (Practice button requires `midiConnected === true`; see manual step below)

## Automated validation (R / regression tests)

```sh
cd frontend
npm run typecheck                       # tsc -b — no type regressions
npm test -- plugins/practice-view-plugin    # Vitest suite for the plugin
```

**Required tests (written first — Constitution VII regression prevention):**

1. `PracticeViewPlugin.test.tsx` — **free-practice slider regression**:
   - Enter free practice (click Free Practice in the mocked `ScoreSelector`).
   - `fireEvent.change` the tempo slider (multiplier 1.0 → 1.25).
   - Assert toolbar BPM text shows `round(base × 1.25)`, and it was different from the initial `round(base × 1.0)` value.
2. `useFreePractice.test.ts` (new) — **effective-BPM unit tests**:
   - `setFreeTempo(1.25)` with base 80 → `freeEffectiveBpm` = 100; base 40 → floor clamp at 10 for `multiplier 0.25`.
   - Stopping a session writes `record.bpm` = effective (base × multiplier at stop), not the base.
3. `practiceToolbar.test.tsx` — existing `bpm`-prop render test still passes unchanged.

## Manual end-to-end validation

1. Launch the app (`npm run dev` in `frontend/`, target a tablet viewport).
2. Open the **Practice** plugin → score selection dialog.
3. Click **🎹 Free Practice** → practice view opens with default tempo (80 BPM) on the toolbar readout.
4. **Start** practice (Practice button) so the metronome is armed/running; if no MIDI device exists, instead verify with the metronome toggled directly.
5. Drag the **tempo slider** right and left:
   - The numeric BPM readout MUST track the slider in real time (e.g., 80 → 100 → 120 → back).
   - The metronome's beat rate MUST match the number shown before and after every change.
   - The staff canvas (`StaffViewer`) scroll/note spacing MUST follow the new tempo.
6. Stop the session → results overlay → **Replay**: replay layout must use the tempo that was shown at stop time (record `bpm`), and **Save** must persist it.
7. Back → re-open **Free Practice** → the readout returns to the default base tempo (session-boundary reset).

## Expected outcomes (mapped to success criteria)

| Check | SC | Pass condition |
|-------|----|----------------|
| Readout tracks slider end-to-end with no lag/stale value | SC-001 | Final display = slider final position, 100% of runs |
| Number equals audible beat rate | SC-002 | No divergence between readout and metronome |
| Whole-number, in-range readout | SC-003 | No out-of-range / missing / stale values in any run |