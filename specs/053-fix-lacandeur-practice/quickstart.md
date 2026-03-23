# Quickstart: Fix Practice Issues in La Candeur

**Feature**: 053-fix-lacandeur-practice  
**Date**: 2026-03-23

---

## Prerequisites

- Node.js 18+ with pnpm/npm
- Rust toolchain (for WASM — only if rebuilding backend)
- A MIDI keyboard or the on-screen virtual keyboard

---

## Running the Frontend Dev Server

```bash
cd frontend
npm install        # first time only
npm run dev        # starts Vite dev server at http://localhost:5173
```

Open in Chrome or Firefox on a tablet or desktop with a wide viewport.

---

## Loading La Candeur for Practice Testing

1. Open the app at `http://localhost:5173`
2. Navigate to **La Candeur** (Burgmuller)
3. Click the **Practice** button in the toolbar
4. Select **Both Hands** mode from the staff selector
5. Press **Start** to begin the session

---

## Testing Each Bug Fix

### Bug 1 & 2: LH chord highlighting duration + M3-M4 chord duration

1. Load La Candeur, Both Hands mode, Start practice
2. Play the opening LH chords in M1-M2 — verify they stay green for the full half-note duration (not cut short)
3. Progress to M3-M4 — play and hold the LH chords — verify they remain green through M4 (not cut at the M3 barline)
4. Compare: repeat in **Left Hand Only** mode — durations must match BH mode exactly

**Unit test target**: `mergePracticeNotesByTick.test.ts` — assert that merged entry `durationTicks` equals the per-staff truncated value (not cross-staff truncated)

---

### Bug 3: Green dot on system line break

1. Load La Candeur, Both Hands mode, play continuously
2. When the score scrolls past system 1 into system 2, verify the green highlight dot appears on the first note of system 2 **and remains visible**
3. Continue to next system break — verify same behaviour

**Test target**: `LayoutRenderer.test.tsx` — mock a system-change scenario and verify `updateExpectedHighlights()` is called with non-empty set after the SVG rebuild

---

### Bug 4: M15 expected notes

1. Load La Candeur, Both Hands mode
2. Skip/seek to measure 15
3. Play **only** the RH G4 — it should be accepted without needing to hold any LH notes
4. Verify LH half-notes from M15 are treated as "sustained" (pre-pinned) if already held, not as freshly required

**Test target**: `mergePracticeNotesByTick.test.ts` — assert that an LH note at tick T with duration>240 appears in `sustainedPitches` of a subsequent RH-only entry at tick T+240, not in `midiPitches`

---

### Bug 5: M17 rest not accepted

1. Load La Candeur, Both Hands mode  
2. Progress to M17
3. When the RH half-rest is active, press any key — verify a WRONG note event is registered (the session does not advance)
4. Verify LH notes at the same time window are not causing an unintended advance

**Test target**: `practiceEngine.test.ts` — construct a state with a gap between entries, simulate a key press during the gap, assert `WRONG_MIDI` action is dispatched and `currentIndex` is unchanged

---

### Bug 6: Position lock during practice

1. Load La Candeur, Both Hands, Start practice
2. Attempt to click a different measure in the score — verify nothing happens (no SEEK, no scroll)
3. Attempt to press the Return-to-Start arrow — verify it is visually disabled and non-functional
4. Press Stop — verify navigation controls re-enable

**Test target**: `PracticeViewPlugin.test.tsx` — assert `handleNoteShortTap` does not dispatch `SEEK` when `mode === 'active'`; assert navigation button has `disabled` attribute during active practice

---

### Bug 7: Partial results on Stop

1. Load La Candeur, Both Hands, Start practice
2. Play a few measures (at least 1 correct note)
3. Press **Stop**
4. Verify a results summary appears showing:
   - A score percentage
   - A "Stopped at Measure X of Y" label (e.g., "M5 of 32")
5. Press Stop immediately on Start (0 notes played) — verify a graceful "no notes played" message appears

**Test target**: `PracticeViewPlugin.test.tsx` — assert that after STOP with non-empty `noteResults`, `partialPerformanceRecord` is set; assert the results overlay renders with the partial badge

---

## Running Tests

```bash
cd frontend
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E (requires dev server running)
```

**Relevant test files** (new or modified in this feature):

```
frontend/
├── plugins/practice-view-plugin/
│   ├── practiceEngine.test.ts              # Bugs 1, 2, 5 (engine unit tests)
│   ├── mergePracticeNotesByTick.test.ts    # Bugs 1, 2, 4 (merge unit tests)
│   └── PracticeViewPlugin.test.tsx         # Bugs 6, 7 (component tests)
└── src/components/
    └── LayoutRenderer.test.tsx             # Bug 3 (highlight persistence)
```

---

## Key Constants / Configuration

| Constant | Value | Location |
|---|---|---|
| Hold threshold | 90% of `requiredHoldMs` | `PracticeViewPlugin.tsx` |
| MIDI chord window | 80ms | `ChordDetector.ts` |
| Auto-scroll duration | 400ms ease-out | `ScoreViewer.tsx` |
| Score resolution | 960 PPQ | Constitution / Principle IV |

---

## Regression Test for Other Scores

After fixing, verify the following scores are unaffected in Both Hands mode:

- **Arabesque** (Burgmuller) — multi-system, varied chord patterns
- **Für Elise** — cross-barline tied notes

Run the full Vitest suite and manually spot-check the above scores before PR.
