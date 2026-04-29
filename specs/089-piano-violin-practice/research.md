# Research: Piano Practice with Violin Accompaniment Playback

**Feature**: 089-piano-violin-practice  
**Date**: 2026-04-29  
**Phase**: 0 — Pre-implementation research

---

## R-001: Audio Pipeline Architecture

**Question**: How does multi-part playback work and how is per-part volume controlled?

**Decision**: Use the existing per-instrument `PlaybackChannel` architecture introduced in Feature 088. Each instrument part gets its own `Tone.Volume` node connected to a shared `Tone.Limiter`. Volume is controlled via `IPlaybackChannel.setVolume(volume: number)` where `volume` is a linear gain scalar (0.0–1.0).

**Rationale**: The infrastructure already exists. Feature 088 added `ToneAdapter.channels: Map<number, PlaybackChannel>` — one channel per `partIndex`. The `PlaybackChannel.setVolume()` method adjusts the `Tone.Volume` node for that instrument in real time. No new audio engine work is needed.

**Alternatives considered**:
- Adding a Web Audio API `GainNode` at the output stage: Rejected — the Tone.js `Volume` node already provides this at the per-instrument level.
- Multiplying velocity values: Rejected — would require rescheduling all notes; `setVolume` works at the audio node level, affecting already-scheduled notes instantly.

**Key references**:
- `frontend/src/services/playback/PlaybackChannel.ts` — `IPlaybackChannel.setVolume(volume: number)`
- `frontend/src/services/playback/ToneAdapter.ts` — `getChannel(partIndex): IPlaybackChannel | null`

---

## R-002: Plugin API Gap Analysis

**Question**: Does the current Plugin API expose per-part instrument info and per-part volume control?

**Decision**: The Plugin API (`PluginScorePlayerContext` at v10) does NOT expose instrument metadata or per-part volume methods. Two new methods must be added at v11:

1. `getInstruments(): ReadonlyArray<PluginInstrumentInfo>` — exposes the instrument list from the loaded score.
2. `setPartVolume(partIndex: number, volume: number): void` — applies a linear gain to a specific instrument channel.

**Rationale**: The Practice plugin cannot access `ToneAdapter` directly (hexagonal architecture boundary — Principle II). All cross-boundary communication goes through the Plugin API. The two new methods follow the exact same pattern as `setPlaybackStaffFilter` (Feature 083): a `useCallback` wrapping a `ToneAdapter` call, added to the `api` useMemo and stub/proxy objects.

**Alternatives considered**:
- Exposing `setAccompanimentVolume(volume: number)` (host identifies non-piano parts): Would be simpler but hides instrument identity from the plugin, preventing future per-instrument volume controls (e.g., cello vs. violin separate sliders). `getInstruments()` + `setPartVolume()` is more composable.
- Leaking `ToneAdapter` reference into the plugin: Violates Principle II (hexagonal architecture). Rejected.

**Key references**:
- `frontend/src/plugin-api/types.ts` (v10) — `PluginScorePlayerContext` interface
- `frontend/src/plugin-api/scorePlayerContext.ts` — `setPlaybackStaffFilter` implementation pattern
- Feature 083 spec/contracts — precedent for Plugin API extension

---

## R-003: Instrument Part Identification

**Question**: How are instrument parts identified as piano vs. violin (or "other")?

**Decision**: Use `Score.instruments[partIndex].instrument_type` (canonical string, already resolved by `resolveInstrumentType()` during score load). Piano parts have `instrument_type === 'piano'`. Any part with a different type is an accompaniment part.

**Rationale**: `resolveInstrumentType()` in `InstrumentTimbres.ts` normalises MusicXML instrument names to canonical types. This resolution already happens during `toneAdapter.initChannel()` on score load. The `Score.instruments[]` array is populated by the WASM parser from MusicXML `<score-part>` metadata. The `PluginInstrumentInfo` type simply surfaces what is already computed.

**Alternatives considered**:
- Matching on display name strings (e.g. "Violin", "Piano"): Fragile, locale-sensitive, already rejected by `resolveInstrumentType()` in favour of canonical types.
- Treating instruments[0] as always piano: Wrong — MusicXML part order is not guaranteed.

**Piano part detection rule**: `instrumentType === 'piano'`. All other types are accompaniment parts.

**Fail-closed rule (FR-011)**: If the score has no part with `instrumentType === 'piano'`, the feature does not activate (no accompaniment slider shown). The `hasAccompaniment` flag is `false` when there are zero piano parts OR zero non-piano parts.

**Key references**:
- `frontend/src/services/playback/InstrumentTimbres.ts` — `resolveInstrumentType()`
- `frontend/src/types/score.ts` — `Score.instruments[].instrument_type`

---

## R-004: Staff Filter Coexistence (Feature 084)

**Question**: Does `setPlaybackStaffFilter` (one-hand mode) conflict with per-part volume control?

**Decision**: No conflict. `setPlaybackStaffFilter` filters which staff of `instruments[0]` (the piano instrument) produces audio. It operates on staff-level note filtering in the playback scheduler, not on `ToneAdapter` channels. `setPartVolume` operates on the `Tone.Volume` node for a specific `partIndex`. The two mechanisms are orthogonal.

**Rationale**: `setPlaybackStaffFilter` sets a filter state that is checked in `PlaybackScheduler` when scheduling notes from the piano staff array. The accompaniment parts (violin, etc.) have their own `partIndex` channels and are unaffected by piano staff filtering. The violin notes are tagged with `_partIndex = violinPartIndex` and routed to the violin channel regardless of the piano staff filter state.

**Key references**:
- `frontend/src/plugin-api/scorePlayerContext.ts` line 203 — `playbackStaffFilter` state
- `frontend/src/services/playback/PlaybackScheduler.ts` — staff filter application point

---

## R-005: Accompaniment Volume Persistence Strategy

**Question**: Where should accompaniment volume state live, given it must persist across score changes but reset on page reload?

**Decision**: Module-level singleton or React context value outside the Practice plugin component tree — essentially page-session state. The simplest implementation is a module-level variable in `useAccompaniment.ts` that survives component unmount/remount (score changes) but is initialised fresh on page load.

**Rationale**: The spec explicitly states: "resets to the default only on a full page reload." This rules out `localStorage` (survives reload) and per-render state (resets on unmount). Module-level state in the hook file is the standard React pattern for this use case — used elsewhere in the codebase (e.g., `ToneAdapter` singleton, `ScoreCache` singleton).

**Alternatives considered**:
- `useRef` inside PracticeViewPlugin: Resets on plugin unmount — does not survive score changes that cause remount.
- `localStorage` with profile scoping: Over-engineered for a transient audio preference; Principle VIII exemption justified.
- React context: Valid but adds a Provider wrapper; module-level state is simpler for a single scalar.

**Default value**: `0.7` (70%, per FR-004).

---

## R-006: Toolbar Integration Point

**Question**: Where in the Practice plugin toolbar should the accompaniment volume slider be placed?

**Decision**: In `practiceToolbar.tsx`, after the tempo multiplier slider and before the MIDI connectivity controls, conditionally rendered only when `hasAccompaniment === true`.

**Rationale**: The toolbar already contains: profile icon (rightmost), MIDI connectivity, staff dropdown, and tempo multiplier. The accompaniment volume slider is logically adjacent to the tempo multiplier (both affect the sound of the current practice session). Conditional rendering on `hasAccompaniment` satisfies FR-008 (no new UI for piano-only scores) and SC-004.

**Key references**:
- `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` — existing toolbar layout
- Profile icon at line 484 (Feature 080) — must remain rightmost

---

## R-007: ToneAdapter `setPartVolume` Public Method

**Question**: Does `ToneAdapter` need a new public method, or can `scorePlayerContext.ts` call `getChannel()` directly?

**Decision**: `scorePlayerContext.ts` calls `toneAdapter.getChannel(partIndex)?.setVolume(volume)` directly — no new public method on `ToneAdapter` is needed. `getChannel()` is already public (line 734 of `ToneAdapter.ts`).

**Rationale**: The pattern is consistent with Feature 088's `ToneAdapter.initChannel()` call in `scorePlayerContext.ts`. Adding a `setPartVolume` wrapper on `ToneAdapter` would be an unnecessary layer of indirection for a single-line delegation.

**Clamp behaviour**: Volume is clamped to `[0, 1]` before calling `setVolume()` to guard against invalid plugin inputs.

---

## Summary Table

| # | Question | Decision |
|---|----------|----------|
| R-001 | Audio pipeline for per-part volume | Existing `PlaybackChannel.setVolume()` via `ToneAdapter.getChannel()` |
| R-002 | Plugin API gaps | Add `getInstruments()` + `setPartVolume()` as Plugin API v11 |
| R-003 | Piano part identification | `instrumentType === 'piano'` (canonical, resolved at load) |
| R-004 | Feature 084 coexistence | No conflict; staff filter and part volume are orthogonal |
| R-005 | Volume persistence | Module-level singleton in hook file; resets on page reload |
| R-006 | Toolbar placement | After tempo slider, before MIDI controls; conditionally rendered |
| R-007 | ToneAdapter API | Call `getChannel(partIndex)?.setVolume()` directly; no new ToneAdapter method |
