# Research: Metronome for Play and Practice Views

**Feature**: 035-metronome  
**Date**: 2026-03-02  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## R-001: Metronome Click Synthesis

**Unknown**: How to synthesize distinct downbeat / upbeat metronome clicks using Tone.js without piano samples.

**Decision**: Use `Tone.MembraneSynth` for the downbeat and a `Tone.Synth` with near-zero ADSR (attack ≈ 0, decay ≈ 0.05 s, sustain 0, release ≈ 0) for upbeats. Both are driven by `Tone.Transport.scheduleRepeat()` — the same mechanism already used by `ToneAdapter.scheduleRepeat()` for windowed note scheduling. Audio unlock (browser autoplay) is handled by the existing `ToneAdapter.init()` / `Tone.start()` call triggered on first user interaction.

**Rationale**:
- `MembraneSynth` produces the canonical percussive "tock" suited to a metronome (pitched sine with fast exponential pitch drop).
- Scheduling via Tone.js Transport is **sample-accurate** — immune to rAF frame jitter and JavaScript GC pauses. This is essential because the SC-002 timing accuracy requirement is ±10 ms.
- Stays inside the Tone.js audio graph so it respects `Tone.Destination.mute` and any app-level volume controls.
- No raw Web Audio API plumbing needed.

**Alternatives considered**:
- *`Tone.MetalSynth`*: Good for hi-hat-style ticks but noisier than needed and more complex to configure.
- *`Tone.context.rawContext.createOscillator()`*: Functional but bypasses Transport scheduling → timing drift relative to notes during playback.
- *Extend `ToneAdapter` with metronome methods*: Mixes concerns. A standalone `MetronomeEngine` service is architecturally cleaner (hexagonal principle).

**Key code paths**:
- `frontend/src/services/playback/ToneAdapter.ts` — `scheduleRepeat()`, `updateTempo()`, `setMuted()`
- `frontend/package.json` — `"tone": "^14.9.17"`

---

## R-002: Playback Clock Precision

**Unknown**: Is the 60 Hz rAF `currentTick` loop precise enough for phase-locked beat scheduling?

**Decision**: Use **two separate mechanisms** depending on concern:

| Concern | Mechanism | Why |
|---|---|---|
| **Audio click scheduling** | `Tone.Transport.scheduleRepeat()` (ahead-of-time) | Sample-accurate; immune to rAF jitter; SC-002 requires ±10 ms |
| **Visual beat pulse** | rAF via `context.scorePlayer.getCurrentTickLive()` | 60 Hz resolution; ≈7 samples/beat at 300 BPM; ±16.7 ms for visuals is imperceptible |

**rAF tick resolution at 300 BPM**:
- Ticks/second = (300/60) × 960 = 8 000
- Ticks/frame at 60 Hz ≈ 133
- Samples/beat = 960 / 133 ≈ 7.2 — beat crossings are never skipped

**Phase-lock strategy when playback is running**:
Because Tone.js Transport is already started (by `ToneAdapter.startTransport()`) during playback, the metronome's `scheduleRepeat` events are naturally Transport-synchronized — there is no additional phase-alignment needed. The metronome computes its next click time as `transportTime + beatIntervalSeconds` inside the repeat callback.

**Standalone mode** (no playback active):
- `MetronomeEngine.start(bpm, timeSignatureNumerator)` calls `ToneAdapter.init()`, then `Tone.Transport.start()` if the Transport is not already running.
- Beat counter resets to 0 (beat 1) on every `start()`.
- `Tone.Transport.stop()` is called when the metronome stops (standalone only — must not interfere with playback Transport when both are active).

**Key code paths**:
- `frontend/src/services/playback/MusicTimeline.ts` — rAF loop, `tickSourceRef`, 100 ms React throttle
- `frontend/src/plugin-api/scorePlayerContext.ts` — `getCurrentTickLive()` reads `tickSourceRef.current` directly
- `frontend/src/types/playback.ts` — `ITickSource { currentTick: number; status: PlaybackStatus }`

---

## R-003: Time Signature Data Path

**Unknown**: What time signature data is available from the Score model, and how to expose it to the metronome?

**Decision**: Extend `ScorePlayerState` with a `timeSignature` field. Add a private `extractTimeSignature()` helper in `scorePlayerContext.ts`, mirroring the existing `extractTempo()` pattern.

**Rationale**:
- `bpm` is already a scalar field in `ScorePlayerState` computed at load time from `global_structural_events`. `timeSignature` is structurally identical — one value extracted at load, broadcast to all subscribers.
- The metronome plugin reads state via `context.scorePlayer.subscribe()`; adding a field requires no new subscription channel.
- A separate `context.scorePlayer.extractTimeSignature()` method would force plugins to handle not-loaded edge cases separately — worse ergonomics for no benefit.

**Score model data**:
- `TimeSignatureEvent { tick: Tick, numerator: number, denominator: number }` — defined in `frontend/src/types/score.ts`
- Always present at tick 0 in every score (backend `Score::new()` inserts 4/4; MusicXML import sets from file)
- Default when absent: `{ numerator: 4, denominator: 4 }`

**`ScorePlayerState` extension**:
```typescript
readonly timeSignature: { readonly numerator: number; readonly denominator: number };
```

**`extractTimeSignature()` implementation** (private, in `scorePlayerContext.ts`):
```typescript
function extractTimeSignature(score: Score): { numerator: number; denominator: number } {
  for (const event of score.global_structural_events) {
    if ('TimeSignature' in event && event.TimeSignature.tick === 0) {
      return { numerator: event.TimeSignature.numerator, denominator: event.TimeSignature.denominator };
    }
  }
  return { numerator: 4, denominator: 4 };
}
```

**Beat interval in ticks** (used by MetronomeEngine):
```
beatIntervalTicks = PPQ * (4 / timeSignature.denominator)
// 4/4 → 960 ticks/beat
// 3/8 → 480 ticks/beat
```

---

## R-004: Audio Unlock Flow

**Unknown**: How does browser autoplay policy interact with the metronome? Who unlocks the AudioContext?

**Decision**: `MetronomeEngine.start()` calls `await ToneAdapter.getInstance().init()` before scheduling any Transport events. `ToneAdapter.init()` calls `Tone.start()` which resumes the Web Audio `AudioContext`. This is idempotent — if audio is already unlocked (user previously clicked Play, for example), it's a no-op.

**The first click on the metronome button IS a user gesture**, which satisfies browser autoplay policy. So in normal use the request to unlock will succeed synchronously. The FR-012 "inline message" UX is needed only if the user somehow bypasses the autoplay gate (headless testing, unusual browser config). Implementation: catch the `NotAllowedError` from `Tone.start()` and set an `audioBlocked: true` state that renders the inline message; as soon as the next user interaction fires (document `pointerdown`), re-call `MetronomeEngine.start()`.

**Key code paths**:
- `frontend/src/services/playback/ToneAdapter.ts` — `init()` method, `Tone.start()` call

---

## R-005: Plugin API Versioning Pattern (T006 Proxy)

**Unknown**: What is the minimum change set to add a new `context.metronome` namespace?

**Decision**: Follow the T006 proxy pattern used for `scorePlayer` (v3) and `recording` (v2). Create one new file (`metronomeContext.ts`) and update four existing files.

**Files to update**:

| File | Change |
|---|---|
| `frontend/src/plugin-api/types.ts` | Add `PluginMetronomeContext` interface; add `MetronomeState` type; add `readonly metronome: PluginMetronomeContext` to `PluginContext`; extend `ScorePlayerState` with `timeSignature`; bump `PLUGIN_API_VERSION` `'4'` → `'5'` |
| `frontend/src/plugin-api/index.ts` | Export `PluginMetronomeContext`, `MetronomeState` |
| `frontend/src/plugin-api/metronomeContext.ts` | **NEW** — `useMetronomeBridge()`, `createNoOpMetronome()`, `createMetronomeProxy()` |
| `frontend/src/plugin-api/scorePlayerContext.ts` | Add `extractTimeSignature()`, `timeSignature` state, populate in `ScorePlayerState` snapshot |
| `frontend/src/components/plugins/PluginView.tsx` | Add `metronomeRef` to `V3ProxyRefs`; call `useMetronomeBridge()` in `V3PluginWrapper`; write `proxyRefs.metronomeRef.current = api` |
| `frontend/src/App.tsx` | Create `metronomeRef` per plugin in `loadPlugins()`; add to proxy refs map; inject `metronome: createMetronomeProxy(metronomeRef)` into `PluginContext` |

**Backward compatibility**: All existing v1–v4 plugins receive `context.metronome` (the no-op stub) but never call it. The `pluginApiVersion >= 3` render gate in `App.tsx` already activates `V3PluginWrapper` for all v3+. No new version gate needed — extending `V3PluginWrapper` with the new bridge hook covers all existing built-in plugins.

---

## R-006: Transport.bpm as Authoritative Tempo Source (FR-007c)

**Unknown**: How does the metronome stay in sync with practice tempo modifiers without a cancel-and-reschedule cycle after every BPM change?

**Decision**: Make `Tone.Transport.bpm` the single source of truth for tempo for all Transport-scheduled events (playback notes AND metronome beats). Two coordinated changes achieve this:

1. **Playback engine writes `Transport.bpm`**: `PlaybackScheduler.scheduleNotes(notes, tempo, startTick, tempoMultiplier)` must call `adapter.updateTempo(tempo * tempoMultiplier)` before starting the refill loop. Currently this method only stores `scheduleTempoMultiplier` internally and divides note times manually — it does **not** update `Transport.bpm`. `ToneAdapter.updateTempo()` was added in feature 008 but is currently dead code. Wiring it here makes `Transport.bpm` reflect `effectiveBpm = scoreBpm × multiplier` throughout playback.

2. **Metronome uses musical-time notation**: `MetronomeEngine.start()` calls `adapter.scheduleRepeat(callback, timeSignature.denominator + "N")` (e.g., `"4N"` for quarter-note beat in 4/4 or 3/4, `"8N"` for eighth-note beat in 6/8). Tone.js automatically converts this notation to absolute seconds using the current `Transport.bpm`. When `Transport.bpm` changes (because the playback engine called `updateTempo`), all existing `scheduleRepeat` events with musical-time notation automatically get the correct spacing on the next cycle — no explicit rescheduling needed.

**Impact on T019 — `updateBpm()`**: With musical-time notation, `updateBpm()` only needs to call `adapter.updateTempo(bpm)`. The next beat fires at the original scheduled time; all beats thereafter fire at the new interval. No cancel-and-reschedule → no audio glitch → SC-003 satisfied cleanly.

**Rationale**:
- `scheduleRepeat` with a fixed seconds interval breaks phase-lock whenever the BPM changes, because future events are already queued at the old interval. Musical-time notation delegates the seconds/musical-unit conversion to the Transport at fire time.
- This is the canonical Tone.js pattern for tempo-following repeating events (see Tone.js docs: `Transport.scheduleRepeat("4n", ...)` is explicitly recommended for beat-locked patterns).
- Keeping `Transport.bpm` authoritative also means external tooling (Tone.js DevTools, test assertions on `Transport.bpm`) gives correct readings.

**Changes required**:

| File | What changes |
|---|---|
| `ToneAdapter.ts` | Overload `scheduleRepeat` to accept `string \| number` interval; annotate that string values are Tone.js time notation |
| `PlaybackScheduler.scheduleNotes()` | Add `adapter.updateTempo(tempo * tempoMultiplier)` call before starting the refill loop |
| `MetronomeEngine.start()` | Use `adapter.scheduleRepeat(cb, denominator + "N")` instead of seconds; call `adapter.updateTempo(bpm)` in standalone mode |
| `MetronomeEngine.updateBpm()` | Simplify to `adapter.updateTempo(clampBpm(bpm))`; remove cancel/reschedule |
| `useMetronomeBridge` | No change — still subscribes to bpm changes and calls `engine.updateBpm()`; the engine now handles it correctly |

**Alternatives rejected**:
- *Keep seconds-based scheduling + cancel/reschedule*: Each `updateBpm()` call causes a silent gap (up to one full beat) between the last click before the tempo change and the first click after, violating SC-003 ("within one beat" = no silence within the same beat).
- *Read `scorePlayerState.bpm` and compute seconds independently*: Works at startup, but any mid-flight BPM change requires a manual cancel/reschedule cycle and can cause the metronome to drift if the event fires before the reschedule is applied.

**Key code paths**:
- `frontend/src/services/playback/ToneAdapter.ts` — `scheduleRepeat()`, `updateTempo()`
- `frontend/src/services/playback/PlaybackScheduler.ts` — `scheduleNotes()`, `scheduleTempoMultiplier`
- `frontend/src/services/metronome/MetronomeEngine.ts` — `start()`, `updateBpm()`

---

## Summary of Decisions

| Research | Decision |
|---|---|
| R-001 Click synthesis | `Tone.MembraneSynth` (downbeat) + `Tone.Synth` short ADSR (upbeat), via `Tone.Transport.scheduleRepeat()` |
| R-002 Clock precision | Audio clicks via Transport (sample-accurate); visual flash via rAF `getCurrentTickLive()` |
| R-003 Time signature | Extend `ScorePlayerState.timeSignature`; add `extractTimeSignature()` in scorePlayerContext.ts |
| R-004 Audio unlock | Piggyback on `ToneAdapter.init()` / `Tone.start()`; catch `NotAllowedError` for inline message (FR-012) |
| R-005 Plugin API | T006 proxy pattern; new `metronomeContext.ts`; 5 file updates; PLUGIN_API_VERSION → `'5'` |
| R-006 Authoritative tempo | `Transport.bpm` = authoritative; PlaybackScheduler calls `updateTempo(bpm × multiplier)`; MetronomeEngine uses `"<denom>N"` notation; `updateBpm()` simplified to `updateTempo()` only |
