# Research: Fix Tempo Display on Metronome Slider (Feature 093)

## Open Question

During a Free Practice session, why does the metronome's tempo slider change the beat rate but the numeric BPM readout in the toolbar stay unchanged?

## Investigation

### Where the readout comes from (trace)

1. `practiceToolbar.tsx:434-436` renders the readout from the `bpm` prop:
   ```tsx
   {bpm > 0 && <span className="practice-plugin__toolbar-bpm">{bpm}</span>}
   ```
2. `PracticeViewPlugin.tsx:794` supplies that prop:
   ```tsx
   bpm={freePractice.isFreePractice ? freePractice.freeStaffBpm : playerState.bpm}
   ```
   So **in free practice the readout is unconditionally `useFreePractice.freeStaffBpm`** — it ignores `tempoMultiplier` entirely.
3. `useFreePractice.ts` writes `freeStaffBpm` (via `setFreeStaffBpm`) in exactly four places, all at **session boundaries**:
   - `handleFreePractice` (enter free mode) — seeds from metronome BPM or 120
   - `handleFreeToggle` (session start) — reseeds from metronome BPM or 120
   - `handleFreeRepractice` — reseeds from metronome BPM or 120
   - `handleFreeReplay` — restores the recorded `FreeMidiRecord.bpm`
4. The slider's change handler (`PracticeViewPlugin.tsx:526-532`) does NOT touch free-practice state:
   ```tsx
   const handleTempoChange = useCallback((m: number) => {
     setTempoMultiplier(m);
     context.scorePlayer.setTempoMultiplier(m);
   }, [context.scorePlayer]);
   ```

**Root cause**: A state-propagation gap. In a score-based session the readout follows `playerState.bpm`, which the score player recomputes (`scoreTempo × multiplier`) whenever the slider moves — so number, metronome, and playback stay in sync. Free practice has **no score**, so `playerState.bpm` never updates from the slider, and `freeStaffBpm` (the readout's actual source) is only ever written at session boundaries. The slider's multiplier is applied to the *audio* path (`scorePlayer.setTempoMultiplier`, which the metronome's BPM bridge `useMetronomeBridge` follows), but the *displayed* value never changes — exactly the reported symptom.

### Secondary impact (same root cause)

`freeStaffBpm` / `freeStaffBpmRef` also drive the free-practice **measure clock** (quantization interval, `useFreePractice.ts:192`) and the **saved tempo** (`FreeMidiRecord.bpm`, `useFreePractice.ts:281`). Because the slider never updates `freeStaffBpmRef`, the quantization grid and the recorded tempo also stay at the stale value while the metronome runs ahead. Any fix must therefore keep these consumers consistent, not just the readout.

## Decisions

- **Decision (single source of truth)**: Introduce an **effective free-practice BPM** computed as `baseFreeBpm × tempoMultiplier`, owned by `useFreePractice`. `freeStaffBpm` remains the *base* tempo (seeded at session start, fixed on replay); all live consumers (toolbar readout, staff renderer `bpm`, measure-clock interval) read the effective value; the saved `FreeMidiRecord.bpm` is the effective BPM at stop time.
- **Rationale**: Preserves the existing behaviour that the slider writes into `tempoMultiplier` + `scorePlayer` (keeps the metronome following as today — FR-007a path), while making the number, the metronome, and the recording agree 1:1. Minimal blast radius: only `handleTempoChange` (orchestrator) and `useFreePractice` (domain hook) change.
- **Alternatives considered**:
  - *A. Cosmetic fix* — render `Math.round(freeStaffBpm × tempoMultiplier)` in the toolbar only. Rejected: leaves the measure clock and saved `record.bpm` stale, so replay/staff layout would still disagree with what the user heard (violates FR-002).
  - *B. Bounce the multiplier into `freeStaffBpm` at session boundaries only* (re-seed on toggle start). Rejected: does not cover mid-session slider changes — the user's exact scenario.
  - *C. Route free-practice tempo through `scorePlayer.setTempoMultiplier` alone and read `playerState.bpm`*. Rejected: free practice has no score, so `playerState` BPM is not guaranteed to update; fragile and out of the plugin's domain control.

- **Decision (rounding)**: Effective BPM is rounded to the nearest whole number for display and for `FreeMidiRecord.bpm`, matching the existing whole-number BPM convention (Principle IV). The measure-clock interval is derived from the unrounded effective value to avoid cumulative drift — the same "exactBpm for timing, rounded for display" split already used by `useMetronomeBridge`.

## Best-Practice Notes (from codebase)

- `useMetronomeBridge` already separates *timing BPM* (`s.exactBpm`, unrounded) from *display BPM* (`s.bpm`, rounded) — `metronomeContext.ts:213-218`. The free-practice fix should mirror this split.
- `computeEffectiveMinMultiplier` / `MIN_TEMPO_MULTIPLIER` / `ABSOLUTE_BPM_FLOOR` (plugin-api) already govern the slider's dynamic minimum; the fix must not bypass the 10 BPM floor.
- Tests for free practice live in `PracticeViewPlugin.test.tsx` (orchestrator integration with a mocked `PluginContext`) and should be extended with the regression scenario; a dedicated `useFreePractice.test.ts` is warranted for the new tempo-transform logic.
- Validation commands: `cd frontend && npm test` (Vitest) and `npm run typecheck`.