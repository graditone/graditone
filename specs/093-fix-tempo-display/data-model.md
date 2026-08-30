# Data Model: Fix Tempo Display on Metronome Slider (Feature 093)

This feature touches no storage schema. `FreeMidiRecord` (Feature 092) is the only persisted entity, and only the **semantics** of one field change (`bpm` now records the effective tempo at stop time). The main model below is the in-memory free-practice tempo state.

## Free-Practice Tempo State

The free-practice domain (`useFreePractice`) owns three tempo-related values:

| Field | Type | Role |
|-------|------|------|
| `baseFreeBpm` | whole number | **Base tempo** seeded at session start / repractice (from metronome BPM or the 80 BPM default) and fixed on replay (`FreeMidiRecord.bpm`). This is today's `freeStaffBpm`, unchanged in role. |
| `tempoMultiplier` | number in [0.1, 2.0] | User-selected speed factor, owned by the orchestrator (`PracticeViewPlugin`), already pushed to `scorePlayer.setTempoMultiplier`. The slider's value. |
| `effectiveFreeBpm` | whole number (= round(base × multiplier), floored at `ABSOLUTE_BPM_FLOOR`) | **Single source of truth** for live consumers: toolbar readout, staff renderer `bpm`, measure-clock interval, and the value persisted as `FreeMidiRecord.bpm`. |

### State transitions

- **Enter free practice** (`handleFreePractice` / `handleFreeRepractice`):
  - `baseFreeBpm` ← metronome BPM if `> 0`, else default
  - `effectiveFreeBpm` ← round(base × current multiplier)
- **Mid-session slider change** (`handleTempoChange` while free practice active):
  - `tempoMultiplier` ← new slider value
  - `effectiveFreeBpm` ← round(base × new multiplier), clamped to floor
  - Published immediately — the readout, staff renderer, and measure clock all re-render/re-derive from it on this same render pass (no timer).
- **Replay** (`handleFreeReplay`):
  - `baseFreeBpm` ← stored `FreeMidiRecord.bpm`; `effectiveFreeBpm` ← that value (multiplier stays), so replay layout matches the original recording.
- **Session stop** (`handleFreeToggle` stop / partial finalize):
  - `FreeMidiRecord.bpm` ← `effectiveFreeBpm` (i.e., base × multiplier at stop time), replacing today's write of the stale base.

### Validation rules

- Effective BPM MUST be a whole number (round), per existing BPM display convention (Principle IV).
- Effective BPM MUST NOT fall below `ABSOLUTE_BPM_FLOOR` (10 BPM) and MUST NOT exceed the slider ceiling (`base × 2.0`), consistent with slider bounds and clampBpm semantics.
- `tempoMultiplier` MUST stay within the slider's [effectiveMin, 2.0] range; the plugin must not clamp it separately.

## Persisted Entity (unchanged schema, changed semantics)

**`FreeMidiRecord`** (Feature 092 — IndexedDB `practices`, profile-scoped):

| Field | Type | Semantic after this feature |
|-------|------|-----------------------------|
| `bpm` | whole number | **Effective** tempo at stop time (base × multiplier when stopped), not the base. |
| `events` | `FreeMidiEvent[]` | Unchanged — raw MIDI attacks/releases with timestamps. |
| `elapsedMs` | number | Unchanged. |
| `noteCount` | number | Unchanged. |

**Why no migration**: Older saved records carry whatever tempo was captured at start; that value was already the "captured at start" BPM, and replay treats it as a base. Loading a pre-fix record remains valid — its `bpm` is simply treated as the effective tempo, which is correct for replay fidelity.