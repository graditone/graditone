# Contract: Free-Practice Effective Tempo (Feature 093)

**Status**: Internal contract within `frontend/plugins/practice-view-plugin/`. No public Plugin API surface changes (`pluginApiVersion` 6 unchanged). Extends the internal tempo contract established by Feature 092.

## Problem statement

`practiceToolbar` renders the numeric BPM readout from a `bpm` prop. In free practice the orchestrator passed a value (`freeStaffBpm`) that was only written at session boundaries, so slider changes never reached the readout.

## Contract

### 1. `useFreePractice` — owned tempo values

| Return | Type | Semantics |
|--------|------|-----------|
| `freeEffectiveBpm` | `number` | **Effective** BPM for free practice = `round(baseFreeBpm × tempoMultiplier)`, clamped to `≥ ABSOLUTE_BPM_FLOOR`. Single source of truth for display and timing. |
| `freeStaffBpm` / `freeStaffBpmRef` | `number` / ref | **Base** BPM, seeded at session boundaries, fixed on replay. Consumers that today read this for live timing MUST read `freeEffectiveBpm` (or the unrounded effective value behind it) instead. |
| `freeStaffBpm` MAY additionally be repurposed/kept for replay layout (`StaffViewer` `bpm` during replay = stored record BPM). |

New API on the hook:
| Method | Signature | Behaviour |
|--------|-----------|-----------|
| `setFreeTempo(multiplier)` | `(m: number) => void` | Recomputes the effective BPM from the current base and publishes it. Called by the orchestrator's `handleTempoChange` whenever free practice is active. |

### 2. Orchestrator (`PracticeViewPlugin`) — slider wiring

- `handleTempoChange(m)` MUST keep the existing score-based path (`setTempoMultiplier(m)` + `context.scorePlayer.setTempoMultiplier(m)`).
- When `freePractice.isFreePractice` is active, `handleTempoChange` MUST ALSO call `freePractice.setFreeTempo(m)` in the same handler so the readout, staff renderer, measure clock, and saved `record.bpm` update in the same render pass.
- The toolbar `bpm` prop for free practice MUST be `freePractice.freeEffectiveBpm` (not the bare base), so the readout equals what the metronome/heard beat rate is.

### 3. `practiceToolbar` — readout

- No change required: it already renders the `bpm` prop verbatim. Its contract is: *display the `bpm` the orchestrator provides*; it never derives tempo.

### 4. Timing vs. display BPM (mirrors `useMetronomeBridge`)

- **Display** and **`FreeMidiRecord.bpm`**: whole-number effective BPM (`round`).
- **Measure-clock interval** (quantization grid): derived from the *unrounded* effective BPM to avoid accumulated drift, matching the `exactBpm`/`rounded` split in `metronomeContext.ts:213-218`.

### 5. Boundaries / invariants

- The metronome's beat rate continues to follow `scorePlayer.setTempoMultiplier` (existing `useMetronomeBridge` FR-007a path). The fix guarantees the *display* tracks the same value — it does not re-implement metronome tempo control.
- No changes to `PLUGINS.md` Plugin API surface. No changes to `ScoreSelectorPlugin`, saved-practice storage, or replay. `FreeMidiRecord.bpm` semantics change only in what the orchestrator writes at stop time.
- Slider bounds (`computeEffectiveMinMultiplier`, `MIN_TEMPO_MULTIPLIER`, `ABSOLUTE_BPM_FLOOR`) are untouched; the effective BPM must respect the floor.

## Verification

- Component test (`PracticeViewPlugin.test.tsx`): enter free practice → `fireEvent.change` on the tempo slider → assert the toolbar BPM text equals the round(base × multiplier) at rest and during/after the change.
- Unit test (`useFreePractice.test.ts`): `setFreeTempo` recomputes `freeEffectiveBpm` from base × multiplier, clamps at the floor, and `record.bpm` written at stop equals the effective value.