# Research — Feature 088: Piano and Violin Playback Support

**Branch**: `088-piano-violin-playback` | **Date**: 2026-04-28

---

## R-001: Current `instrument_type` field status

**Decision**: The `instrument_type` field is hard-coded to `"piano"` in the Rust domain model (`Instrument::new()`). The MusicXML converter does not yet classify instrument type from the `<part-name>` or `<midi-instrument>` elements. Both the backend converter and the frontend must be updated.

**Rationale**: The importer already stores the part name in `PartData.name` (e.g., `"Piano"`, `"Violin"`). The converter creates an `Instrument` but always passes `instrument_type: "piano"`. Updating the converter to call a pure `classify_instrument_type(name: &str, midi_program: Option<u8>) -> String` function is the correct hexagonal-architecture approach (Principle II) — domain classification logic lives in the domain, not in the frontend.

**Alternatives considered**: Frontend-only detection using `instrument.name` — rejected because it duplicates classification logic and leaves the domain model incorrect.

---

## R-002: Instrument type classification strategy

**Decision**: A lookup table in the Rust backend maps part name fragments (case-insensitive) and MIDI program numbers to canonical instrument type strings. The canonical types are:

| Canonical type   | Name patterns (case-insensitive contains)          | MIDI programs |
|------------------|----------------------------------------------------|---------------|
| `"piano"`        | "piano", "keyboard", "clavier", "fortepiano"       | 1–8           |
| `"violin"`       | "violin", "violino"                                | 41            |
| `"viola"`        | "viola"                                            | 42            |
| `"cello"`        | "cello", "violoncello"                             | 43            |
| `"contrabass"`   | "bass", "contrabass", "double bass"                | 44            |
| `"guitar"`       | "guitar", "guitare"                                | 25–32         |
| `"flute"`        | "flute", "flauto"                                  | 74            |
| `"oboe"`         | "oboe"                                             | 69            |
| `"clarinet"`     | "clarinet", "clarinette"                           | 72            |
| `"trumpet"`      | "trumpet", "trompette"                             | 57            |
| `"default"`      | (fallback for unrecognised names)                  | —             |

**Rationale**: Rule-based matching on lowercase name fragment is robust for common MusicXML exports (MuseScore, Finale, Sibelius). MIDI program is the secondary signal. The `"default"` fallback maps to a generic synthesised timbre and prevents playback failures (FR-004).

**Alternatives considered**: ML-based classification — excessive for this use case. External soundfont library detection — not needed; timbre mapping is application-layer.

---

## R-003: Multi-channel audio architecture

**Decision**: Introduce a `PlaybackChannel` class that wraps a `Tone.Sampler | Tone.PolySynth` plus a `Tone.Volume` node. `ToneAdapter` grows a channel registry keyed by `partIndex` (0-based instrument position). Notes carry a `_partIndex?: number` tag (undefined → 0, backward-compatible). `PlaybackScheduler.scheduleWindow()` looks up the tag and calls `toneAdapter.playNoteOnChannel(partIndex, ...)`.

```
                      ┌──────────────────────────────────────┐
                      │          ToneAdapter (singleton)      │
  Transport ──────────┤                                       ├──── Tone.Transport
                      │  channel[0]: piano  ──► Tone.Volume ─►│
  scheduleNotes() ────┤  channel[1]: violin ──► Tone.Volume ─►├──── Tone.Limiter ──► Destination
                      │  channel[N]: ...    ──► Tone.Volume ─►│
                      └──────────────────────────────────────┘
```

**Rationale**: Preserves the singleton `ToneAdapter` contract (all transport control stays centralised). `PlaybackChannel` is a simple audio graph fragment — not a service — so it doesn't violate hexagonal architecture. The `_partIndex` tag approach avoids changing the `Note` domain type while still routing notes to the correct channel.

**Alternatives considered**:
- Multiple `ToneAdapter` instances (one per instrument) — rejected: would create multiple `Tone.Transport` owners, which Tone.js doesn't support well.
- `MultiInstrumentScheduler` replacing `PlaybackScheduler` entirely — overly invasive; windowed scheduling logic can be reused.

---

## R-004: Violin synthesiser configuration (Tone.js)

**Decision**: Violin uses `Tone.PolySynth(Tone.Synth)` with:
- `oscillator.type: "triangle"` — closest to a bowed string harmonic profile among Tone.js basic types
- `envelope.attack: 0.08` — gradual bow contact (not instantaneous like piano)
- `envelope.decay: 0.05`
- `envelope.sustain: 0.75` — sustained bow tone
- `envelope.release: 0.4` — gradual bow lift
- `volume: -6` (dBFS) — slightly quieter than piano to balance ensemble

For cello, `attack: 0.1`, `sustain: 0.8`, `release: 0.5` (heavier bow).
For default/unknown: `triangle`, `attack: 0.05`, `decay: 0.1`, `sustain: 0.5`, `release: 0.3`.

**Rationale**: `triangle` wave has stronger odd harmonics than `sine` and a softer, richer tone than `square` or `sawtooth`, resembling the characteristic warmth of bowed strings. The 80 ms attack avoids the "electronic stab" of a 0 ms attack and approximates a bow engaging the string. A high sustain reflects that a bowed note holds as long as bowing continues.

**Alternatives considered**: `sawtooth` oscillator — too harsh/buzzy. `sine` — too pure, lacks harmonic richness. Custom `FMSynth` — higher complexity with marginal quality improvement given the offline-safe, no-new-dependency constraint.

---

## R-005: Per-instrument volume persistence (Principle VIII)

**Decision**: Persist per-instrument volumes with profile-scoped keys using the existing `scopedSetItem` / `scopedGetItem` utilities from `profileStorage.ts`. Key format:

```
graditone:volume:part:<scoreId>::<partName>
```

Example: `profile:abc123:graditone:volume:part:uuid-of-score::Violin I`

**Rationale**: Using the score UUID (not file name) is stable across re-imports and works for both catalogue and user-uploaded scores. Profile scoping (via `scopedSetItem`) satisfies Principle VIII. The double-colon separator (same convention as the spec's `"Sonata.mxl::Violin I"`) makes the key structure human-readable.

**Alternatives considered**: File name as key — rejected: catalogue scores have no file names; same file re-imported gets a new UUID but the user experience is unchanged because the preference migrates naturally.

---

## R-006: Mute toggle UI — placement in the score view

**Decision**: Mute toggles (and volume sliders for P2/P3) are rendered as an SVG/HTML overlay anchored to the `name_label.position` of each `StaffGroup` in the layout result. On the first system (first page), each `StaffGroup.name_label` provides exact `(x, y)` coordinates (in the layout's logical coordinate space). The overlay renders a React component positioned at those coordinates, transformed with the same CSS `scale` as the score canvas.

The overlay is inserted in `LayoutView.tsx` as an absolutely-positioned sibling to the SVG canvas, not modifying the SVG DOM directly (consistent with Principle VI — only the layout engine determines geometry; we merely read it for overlay placement).

**Rationale**: Inline placement at the instrument name label is exactly what FR-005 requires. Using the layout engine's `name_label.position` (rather than computing our own positions) fully respects Principle VI. The overlay pattern (React above SVG) is the existing pattern used for note highlighting and fingering annotations.

**Alternatives considered**: A standalone mixer panel above the score — rejected per spec clarification. Modifying the SVG text elements directly — rejected per Principle VI (renderers must not derive spatial geometry).

---

## R-007: Mute implementation — immediate effect during playback

**Decision**: Each `PlaybackChannel` includes a `Tone.Volume` node between its synth/sampler and the limiter. Muting sets `volumeNode.volume.value = -Infinity`. The `Volume` node applies immediately in the Web Audio graph — notes already scheduled on the `Tone.Transport` will be silent the moment the gain is set.

**Rationale**: This satisfies FR-006 ("Muting an instrument MUST silence it immediately during active playback") and SC-003 ("within one audio processing frame"). No Transport reschedule is needed.

**Alternatives considered**: Cancelling and rescheduling Transport events on mute — rejected: introduces audible gap and resync complexity. Setting `volume.rampTo(-Infinity)` — rejected: adds latency; instantaneous is preferred here.

---

## R-008: Backward compatibility — single-instrument scores

**Decision**: When a score has exactly one instrument, `ToneAdapter` operates in its current mode (channel 0 = piano sampler, no channel overhead). The `usePlayback` / `useScorePlayerBridge` API does not change its signature. Notes are still tagged with `_partIndex: 0` transparently at flattening time. No UI changes appear for single-instrument scores (FR-010; mute toggles only shown when `instruments.length > 1`, FR-005).

**Rationale**: This ensures SC-004 (all existing single-instrument playback tests pass without modification) and FR-010 (no regression in single-instrument behaviour).
