# Quickstart: Developing & Testing Feature 083

**Branch**: `083-tempo-metronome-practice`  
**Worktree**: `/Users/alvaro.delcastillo/devel/graditone/.worktrees/feature/083-tempo-metronome-practice`

---

## Prerequisites

```bash
cd /Users/alvaro.delcastillo/devel/graditone/.worktrees/feature/083-tempo-metronome-practice/frontend
npm install
```

---

## Running Unit Tests

```bash
# All unit tests
cd frontend && npm run test

# Watch mode (during development)
npm run test -- --watch

# Specific test files relevant to this feature
npm run test -- src/utils/tempoCalculations.test.ts
npm run test -- src/services/metronome/MetronomeEngine.test.ts
npm run test -- plugins/practice-view-plugin/practiceToolbar.test.tsx
npm run test -- plugins/practice-view-plugin/practiceEngine.test.ts
npm run test -- plugins/play-score/playbackToolbar.test.tsx
```

---

## Running E2E Tests

```bash
# Start dev server (required for E2E)
npm run dev &

# Run full E2E suite
npm run test:e2e

# Run only metronome E2E tests (includes new T024, T025)
npm run test:e2e -- --grep "metronome"

# Run with UI for debugging
npm run test:e2e -- --ui
```

---

## Development Workflow (TDD)

Follow the red-green-refactor cycle for each task (Principle V):

### Step 1 — Tempo Calculations (tempoCalculations.ts)

1. Update `tempoCalculations.test.ts`: add tests for `MIN_TEMPO_MULTIPLIER = 0.1`, `ABSOLUTE_BPM_FLOOR = 10`, `computeEffectiveMinMultiplier()`
2. Run tests → they fail (red)
3. Update `tempoCalculations.ts`: change `MIN_TEMPO_MULTIPLIER`, add `ABSOLUTE_BPM_FLOOR` and `computeEffectiveMinMultiplier()`
4. Run tests → they pass (green)
5. Run `clampTempoMultiplier` tests — they pass unchanged (regression check)

### Step 2 — Slider UI (practiceToolbar.tsx + playbackToolbar.tsx)

1. Update `practiceToolbar.test.tsx`: test that slider renders `min={effectiveMin}`, `step=0.01`, datalist tick at 100%
2. Update `playbackToolbar.test.tsx`: same slider tests
3. Run → fail (red)
4. Update both toolbar files: change slider attributes, add datalist, update snap condition
5. Run → pass (green)

### Step 3 — Metronome Armed State (PracticeViewPlugin.tsx + practiceToolbar.tsx)

1. Update `practiceToolbar.test.tsx`: add test for `metronomeArmed=true` → button has `--armed` class
2. Run → fail (red)
3. Add `metronomeArmed` prop to `PracticeToolbarProps`; add CSS class logic
4. Run → pass (green)
5. Update `PracticeViewPlugin.tsx`: add `metronomeArmed` state + modified `handleMetronomeToggle`
6. Pass `metronomeArmed` prop to `<PracticeToolbar />`

### Step 4 — Deferred Start (usePracticeMidi.ts)

1. Update `PracticeViewPlugin.test.tsx` (or write an integration test): when metronome is armed and first attack fires, `context.metronome.toggle` is called and `metronomeArmed` becomes false
2. Run → fail (red)
3. Add `onFirstNoteAttack` param to `usePracticeMidi`; wire it in `PracticeViewPlugin`
4. Run → pass (green)

### Step 5 — E2E Tests

1. Write T024, T025 test cases in `e2e/metronome.spec.ts` → fail (red)
2. No further code changes needed if steps 1–4 are complete
3. Run E2E → pass (green)

---

## Manual Verification Checklist

### Tempo Slider

- [ ] Open any score in the play-score view → drag slider to leftmost position → display reads **10%**
- [ ] Drag slider to rightmost position → display reads **200%**
- [ ] Drag near 97%–103% → slider snaps to exactly **100%**
- [ ] A tick mark is visible at the 100% position on the slider track
- [ ] Open a slow score (e.g., a piece with Largo ≈40 BPM) → slider minimum is higher than 10% → tooltip visible explaining the BPM floor

### Metronome Deferred Start

- [ ] Enter practice view, load a score
- [ ] Enable the metronome → button shows **pulsing amber** (armed state) — NO audio clicks
- [ ] Wait 5+ seconds → still no clicks (metronome silent while armed)
- [ ] Play any note on MIDI keyboard → metronome **starts immediately** on that beat
- [ ] Stop practice → reload → enable metronome again → armed state resets correctly
- [ ] **Outside practice mode** (play-score view): enable metronome → clicks start **immediately** (no deferred start)
- [ ] In practice mode, arm metronome, then toggle it off → metronome remains silent (disarmed)

### Regression

- [ ] Existing metronome E2E tests T021–T023 pass
- [ ] Playback toolbar tempo slider still snaps to 100% correctly
- [ ] Previously saved practice sessions load without errors (tempo clamped if needed)

---

## Key Files Reference

| File | Change |
|------|--------|
| `frontend/src/utils/tempoCalculations.ts` | `MIN_TEMPO_MULTIPLIER` 0.5→0.1, add `ABSOLUTE_BPM_FLOOR`, `computeEffectiveMinMultiplier()` |
| `frontend/src/utils/tempoCalculations.test.ts` | New/updated tests for above |
| `frontend/plugins/play-score/playbackToolbar.tsx` | Slider: min dynamic, step 0.01, snap ±0.03, datalist |
| `frontend/plugins/play-score/playbackToolbar.test.tsx` | Snap zone test update |
| `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` | Slider: same as play-score + `metronomeArmed` prop → `--armed` class |
| `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx` | Armed state rendering test |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | `metronomeArmed` state, modified toggle, `onFirstNoteAttack` wiring |
| `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` | `onFirstNoteAttack?: () => void` parameter |
| `frontend/e2e/metronome.spec.ts` | T024 deferred start, T025 armed visual |

---

## CSS Location

Armed-state styles go in the same CSS file as the existing `practice-plugin__metro-btn--active` rule. Search for `metro-btn` in the frontend `src/` or `plugins/practice-view-plugin/` directories to find the file.

```bash
grep -r "metro-btn--active" frontend/src frontend/plugins --include="*.css" -l
```
