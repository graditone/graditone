# Quickstart: Strict Tempo Mode

**Feature**: `101-strict-tempo-mode`  
**Branch**: `101-strict-tempo-mode`

This quickstart is for validating the feature after implementation. It covers the focused automated suites first, then manual scenarios for the timing rules, stop flow, results overlay, loops, Free Practice, and saved partials.

---

## Prerequisites

- Node.js 20+ and npm (the versions already used by the repository).
- Dependencies installed: `cd frontend && npm install` (already installed in a normal dev checkout).
- A MIDI keyboard for the manual scenarios, or the existing development input path used by the plugin tests. The strict rules themselves are fully covered by automated tests and need no hardware.
- No backend is required. The feature is frontend-only.

---

## Automated checks

Run from the `frontend/` directory:

```bash
cd frontend

# Focused suites (new and directly affected)
npm test -- --run \
  src/plugin-api/computePracticeScore.test.ts \
  src/i18n/locales.test.ts \
  plugins/practice-view-plugin/strictTempo.test.ts \
  plugins/practice-view-plugin/practiceEngine.test.ts \
  plugins/practice-view-plugin/PracticeTimingDetails.test.tsx \
  plugins/practice-view-plugin/ResultsOverlay.test.tsx \
  plugins/practice-view-plugin/practiceToolbar.test.tsx \
  plugins/practice-view-plugin/PracticeViewPlugin.test.tsx

# Type and lint gates
npm run typecheck
npm run lint

# Full regression (same as CI's frontend validation)
npm test -- --run
```

`npm run validate` runs typecheck, lint, and the full Vitest suite in one command.

**Expected**: all suites green, zero TypeScript errors, zero lint errors. The new `strictTempo.test.ts` and `PracticeTimingDetails.test.tsx` files must exist before the focused command is meaningful; the tasks phase creates them.

---

## Manual validation

Start the app:

```bash
cd frontend
npm run dev
```

Open the printed local URL, load a score that contains both short notes and at least one sustained note, and connect a MIDI keyboard.

### 1. Baseline — metronome off (regression)

1. Leave the metronome off.
2. Start Score Practice.
3. Play a note more than 500 ms from its expected time, then continue.

**Expected**
- No strict badge in the toolbar.
- The note is marked `correct-late` (legacy behavior); practice continues.
- No tempo stop and no tempo banner.

### 2. Activate strict mode from the metronome

1. Turn the metronome on (armed or running).
2. Start Score Practice.

**Expected**
- The toolbar shows the `Strict tempo` badge as soon as practice starts.
- The first accepted note is a grace note: it is not judged and the failure count stays at zero.
- The metronome starts from the deferred state as it does today (feature 097).

### 3. Three consecutive off-beat notes (120 BPM)

At 120 BPM a quarter-note gap is 500 ms, so the window is 200 ms.

1. Play the first note in time (grace).
2. Play the next three notes roughly 250–300 ms late, keeping a steady interval.

**Expected**
- The badge escalates (neutral → caution → danger) as misses accumulate; the third failure stops the session.
- The score player stops; the metronome stops and is re-armed if it was enabled.
- The Practice Results window opens with the **Tempo not followed** banner, a hint that practice stopped after 3 consecutive misses, and exactly three failure items with note numbers and signed delays (for example `Note 12: +280 ms`).
- The partial results include the timing table and delay chart, with the three failures marked.
- A `Tempo fails` stat shows `3`; the score gives those notes zero credit.
- **Repractice** starts a new strict session with the count reset to zero; **Save** persists the partial; **Session** returns to the originating session when applicable.

### 4. In-time note resets the streak

1. Start strict practice.
2. Play two off-beat notes (two accumulated failures).
3. Play one note in time.
4. Play two off-beat notes.

**Expected**
- The failure count returns to zero (neutral badge) after the in-time note.
- No stop occurs after the later two failures (the streak is only two).

### 5. Wrong pitches do not count or reset

1. Accumulate two timing failures.
2. Play a wrong pitch.
3. Play an in-time note.
4. Play two more off-beat notes.

**Expected**
- The wrong pitch does not change the count (still two failures).
- The in-time note resets it to zero.
- The later two off-beat notes do not stop the session.

### 6. Early release counts, retry is grace

At a slow tempo (for example 40 BPM) the window is 300 ms and held notes are longer.

1. Start strict practice and reach a sustained note.
2. Release it clearly before the required hold completes.
3. Complete the retry in time.
4. Repeat the early release on later sustained notes until three failures accumulate.

**Expected**
- Each early release increments the count and is marked `strictFailure` with the early-release amount.
- The retry of the same note does **not** add a second failure for being late; it is a grace note for onset timing.
- A successful retry does not reset the count; only a later in-time judged note does.
- Three early releases (with no in-time judged note between them) stop the session; the results list `Released X ms early`.

### 7. Slow and fast tempo windows

- **Slow (about 40 BPM)**: the expected gap is 1500 ms, so the window is capped at 300 ms. Play 10–20 notes within ±200 ms of the grid; no false stop. A note 350 ms off should fail.
- **Fast (about 120 BPM)**: the window is 200 ms. A consistent 300 ms lag must fail by the third consecutive note; an on-time sequence must not.
- **Very fast (about 240 BPM)**: the gap is 250 ms and the window is the 120 ms floor. Verify the metronome's own click error does not cause false stops.

This is the key regression against the reported behavior: slow-tempo short notes and fast-tempo late notes must be caught by the absolute grid.

### 8. Metronome on/off mid-session

1. Start Score Practice with the metronome off.
2. Play a few notes, then turn the metronome on.

**Expected**: the badge appears with the count at zero; the next accepted note is a grace note; strict counting starts after it.

3. Accumulate two failures, then turn the metronome off.

**Expected**: strict mode ends immediately, the badge hides, and the count clears. No tempo stop occurs even with two recorded failures. The session continues with the legacy 500 ms behavior. Earlier strict failures remain marked/scored in the results.

### 9. Tempo change

1. Start strict practice, accumulate one or two failures.
2. Change the tempo (slider or tempo menu).
3. Play the next note, then a few more.

**Expected**
- The failure count is preserved.
- The first note whose onset occurs after the change is a grace note.
- If the tempo is changed while a sustained note is held, that note is judged on the grid it started on; the following note is the grace note.
- No spurious failure appears from the re-scaled expected times.

### 10. Loop practice

1. Set a loop region and a loop count greater than one (via the existing task/repractice flow).
2. At the end of a loop iteration, accumulate two failures, then let the loop restart.

**Expected**
- The first note of the new iteration is a grace note.
- The failure count carries across the iteration (it is not reset by the loop restart).
- A third failure at a loop boundary stops the session instead of auto-restarting the loop.
- On the final iteration, an accepted final note with the third failure shows **complete** results (no tempo banner; the note is marked off-beat). An early release on the final note that is the third failure shows the **tempo-stop partial** results.

### 11. Free Practice is unchanged

1. Enter Free Practice.
2. Turn the metronome on.
3. Play notes.

**Expected**
- No strict badge and no tempo-stop behavior.
- The existing Free Practice recording, metronome, and results flow are unchanged.

### 12. Saved tempo-stop partial

1. Trigger a tempo stop.
2. Choose **Save**.
3. Close the results and reopen the saved practice from the saved-practice list.

**Expected**
- The saved record loads with `stopReason: 'tempo'`.
- The tempo banner, the three failing notes, the timing table/chart, and the `Tempo fails` stat are still shown.
- The score reflects the zero-credit strict failures.
- An old saved partial without `stopReason` still shows the normal “Stopped at note X of Y” presentation.

### 13. Manual stop with one or two failures

1. Accumulate one or two strict failures.
2. Press Stop (or leave the practice via the normal stop control).

**Expected**
- Normal partial results, not a tempo stop.
- No tempo banner and no tempo-stop action row.
- The strict rows are still marked and scored as errors.

### 14. Accessibility and responsiveness

- The toolbar badge updates with `aria-live="polite"` and does not take focus.
- The tempo banner is announced (`role="status"`); the three failure items are list items.
- The table communicates status with text, not color alone; the chart has its accessible label and the table is its text alternative.
- The buttons have localized accessible names.
- At tablet width the stats wrap and the table scrolls horizontally; the sheet remains usable.

---

## Expected failures and troubleshooting

| Symptom | Likely cause / check |
|---------|----------------------|
| Badge never appears | Metronome was off at `START` and not turned on mid-session; check `START.strictTempo` and the metronome mock/state. |
| First note counts as a failure | The anchor was not null at the first accepted note; verify `START`/`STRICT_ENABLE`/`LOOP_RESTART`/`SEEK` clear `strictAnchor`. |
| Constant lag never fails | The anchor is being updated on successful notes; it must only change at grace points. |
| A tempo change causes a false failure | `REANCHOR` was not dispatched, or the in-progress hold did not defer the re-anchor; check `strictReanchorPending`. |
| The 3rd failure restarts a loop | The engine used `complete` instead of `tempo-stopped`, or the orchestrator loop hook ran first. |
| The tempo banner is missing after reopening | `stopReason` was not copied through `SavedPerformanceData` / `PartialPerformanceRecord`. |
| The old complete record masks the tempo partial | The overlay `showComplete` condition lacks the `!partialPerformanceRecord` guard. |
| A partial overlay has no table/chart | `PracticeTimingDetails` was not wired into the partial branch. |
| Early release retry fails again for being late | The retry did not get a grace anchor (`strictAnchor` was not cleared on early release or not set on retry completion). |

If a test is flaky around timing, use `vi.setSystemTime`/fake timers as the existing feature 096/100 tests do; do not introduce real sleeps. The pure helper tests should remain deterministic without timers.
