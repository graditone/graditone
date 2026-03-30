# Research: MIDI Volume Control (Feature 063)

**Date**: 2026-03-29  
**Status**: Complete — all NEEDS CLARIFICATION resolved

## R-001: MusicXML Dynamics Representation

**Task**: How are dynamics encoded in MusicXML? What elements must the parser handle?

**Decision**: Parse three element patterns from within `<direction>` blocks.

**Findings**:

1. **Static dynamics** (pp, p, mp, mf, f, ff, etc.):
   ```xml
   <direction placement="below">
     <direction-type>
       <dynamics><p/></dynamics>
     </direction-type>
     <staff>1</staff>
     <sound dynamics="72.22"/>
   </direction>
   ```
   - `<dynamics>` wraps a child element naming the marking (`<p/>`, `<pp/>`, `<f/>`, etc.)
   - `<sound dynamics="N"/>` is a **sibling** of `<direction-type>` providing the MIDI velocity (0–127 range, though some exporters use 0–113 scale)

2. **Wedges (crescendo/diminuendo)**:
   ```xml
   <direction><direction-type>
     <wedge type="crescendo" number="1"/>
   </direction-type></direction>
   ...
   <direction><direction-type>
     <wedge type="stop" number="1"/>
   </direction-type></direction>
   ```
   - `type` attribute: `"crescendo"`, `"diminuendo"`, or `"stop"`
   - `number` attribute for nesting (matching start/stop pairs)
   - Start elements do NOT carry a target velocity — the target is the next `<dynamics>` marking

3. **Sound dynamics attribute**: `<sound dynamics="72.22"/>` can appear standalone or paired with a `<dynamics>` element. When present, it provides an exact velocity value.

**Rationale**: These three patterns cover all sustained dynamics in MusicXML. Accent-type dynamics (sfz, fp) are out of scope per spec clarification.

**Alternatives considered**: Parsing `<words>` elements for text-based dynamics (e.g., "cresc.") — rejected because unreliable and not standardised.

---

## R-002: Dynamics in Existing Test Scores

**Task**: Which bundled scores contain dynamics for testing?

**Decision**: Use Chopin Nocturne Op.9 No.2 as primary test fixture (richest dynamics), Burgmuller La Candeur as secondary.

**Findings**:

| Score | Dynamics + Wedge Count | Markings Found |
|-------|----------------------|----------------|
| Chopin_NocturneOp9No2.mxl | 51 | p, pp, f, crescendo, diminuendo, sound dynamics |
| Burgmuller_LaCandeur.mxl | 33 | Multiple dynamic levels + wedges |
| Bach_InventionNo1.mxl | 8 | Basic dynamics |
| Burgmuller_Arabesque.mxl | 7 | Basic dynamics |
| Beethoven_FurElise.mxl | 3 | pp only |
| Pachelbel_CanonD.mxl | 0 | None (tests default mf behaviour) |

**Rationale**: Existing scores provide sufficient coverage across all dynamic levels and wedge types. Pachelbel Canon D serves as a regression test (no dynamics = mf default).

---

## R-003: Existing Parser Extension Pattern

**Task**: How to add new element types to the Rust MusicXML parser?

**Decision**: Follow the established OctaveShift pattern — the most recently added direction element type.

**Findings**:

The pattern is:
1. Add data struct to `backend/src/domain/importers/musicxml/types.rs` (like `OctaveShiftData`)
2. Add variant to `MeasureElement` enum (currently: `Note`, `Rest`, `Backup`, `Forward`, `Attributes`, `OctaveShift`)
3. Handle XML element in `parse_direction()` inside `Event::Empty` or `Event::Start` match arms in `structure.rs`
4. Push to `measure.elements` vector

`MeasureData` already has `sound_tempo: Option<f64>` — a parallel `sound_dynamics: Option<f64>` field follows the same pattern.

**Rationale**: Consistency with existing parser patterns minimises risk and review burden.

---

## R-004: Tone.js Velocity Handling for Scheduled Notes

**Task**: Best approach for applying per-note velocity in Tone.js Sampler scheduled playback?

**Decision**: Use the 4th parameter of `triggerAttackRelease(note, duration, time, velocity)` where velocity is a 0–1 amplitude scalar.

**Findings**:

- `Tone.Sampler.triggerAttackRelease(note, duration, time?, velocity?)` — the `velocity` parameter (0–1) scales the amplitude of the triggered note
- `attackNote()` already uses the equivalent pattern: `triggerAttack(note, time, gain)` where `gain = velocity / 127`
- This is per-note granularity without affecting the master bus
- The Salamander samples include different velocity layers — Tone.Sampler automatically selects the appropriate sample layer based on the velocity parameter

**Rationale**: Tone.js natively supports this; matches the existing `attackNote()` pattern. The Sampler's multi-velocity sample selection produces more natural dynamics than pure gain scaling.

---

## R-005: Logarithmic Velocity-to-Gain Curve

**Task**: Best formula for logarithmic MIDI velocity (1–127) to Tone.js amplitude (0–1)?

**Decision**: Use `gain = (velocity / 127)^0.5` — a square root curve providing a good perceptual balance.

**Findings**:

Common approaches:
- **Linear**: `gain = velocity / 127` — sounds unnatural, too quiet at low velocities
- **Square root**: `gain = Math.sqrt(velocity / 127)` — gentle logarithmic feel, industry standard for software samplers
- **True logarithmic**: `gain = Math.log(velocity + 1) / Math.log(128)` — more extreme compression at high end
- **Power curve with configurable exponent**: `gain = Math.pow(velocity / 127, gamma)` where gamma < 1

**Rationale**: Square root curve (`gamma = 0.5`) is the most common choice in DAWs and VSTs. It provides:
- Clearly audible differences across the full velocity range
- Natural-sounding dynamics that match human perception
- A well-tested approach with no surprises

**Alternatives considered**: Configurable gamma parameter — rejected for this feature (unnecessary complexity; can be added later if users request it).

---

## R-006: Master Volume via Tone.Destination

**Task**: How to implement master volume control in Tone.js?

**Decision**: Use `Tone.Destination.volume` (Param in dB) for master volume scaling.

**Findings**:

- `Tone.Destination` is the master output node; all synths connect to it via `.toDestination()`
- `Tone.Destination.volume` is a `Tone.Param<"decibels">` — can be set in dB
- `Tone.Destination.mute` is already used by `setMuted()` in ToneAdapter
- dB range: `-Infinity` (silent) to `0` (full volume)
- User-facing 0–100% maps to approximately -60 dB to 0 dB
- Changes to `Tone.Destination.volume` affect all audio (sampler, polySynth, metronome) automatically since they all use `.toDestination()`

**Rationale**: Single control point, no routing changes needed, affects all audio uniformly. Avoids creating a separate GainNode.

**Alternatives considered**: Inserting a GainNode between instruments and Destination — rejected because more complex for no benefit (Destination.volume achieves the same result).

---

## R-007: MIDI CC7/CC11 Handling

**Task**: How to parse MIDI Control Change messages and apply volume/expression?

**Decision**: Add a `parseMidiCC()` function to `midiUtils.ts` and a CC callback to `useMidiInput.ts`.

**Findings**:

- MIDI CC messages use status byte `0xB0` (channel 1) through `0xBF` (channel 16)
- Data format: `[status, controller_number, value]` — 3 bytes
- CC7 = Channel Volume (0–127)
- CC11 = Expression (0–127)
- Standard behaviour: Final volume = (CC7 / 127) × (CC11 / 127) × note velocity gain
- Currently, `useMidiInput.ts` only routes `0x90` (note-on) and `0x80` (note-off) — `0xB0` falls through unhandled
- Tests in `useMidiInput.test.ts` explicitly verify CC messages do NOT trigger `onNoteOn`

**Rationale**: CC7/CC11 are the standard MIDI volume controls. Multiplicative model matches the MIDI specification and every hardware controller's expectation.

---

## R-008: Volume Persistence Pattern

**Task**: How to persist master volume setting?

**Decision**: Use localStorage with key `graditone:volume:master`, following the existing tempo persistence pattern.

**Findings**:

- Existing pattern: `graditone:tempo:{scoreId}` stored in localStorage for per-score tempo preferences
- Master volume is global (not per-score), so key is `graditone:volume:master`
- Value stored as a number 0–100 (percentage)
- Default value on first use: 80 (avoids full volume on first launch)

**Rationale**: Consistent with existing persistence patterns. localStorage is synchronous, simple, and sufficient for a single scalar value.
