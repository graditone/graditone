# Contracts: Free Mode Measure Detection

**Feature**: 094 — Free Mode Measure Detection
**Date**: 2026-08-30

Pure-domain function contracts for the onset-derived detection. These are the
interfaces between the domain layer (`freePractice.helpers.ts`) and its
consumers (live staff display, Stop finalization, replay). All are pure and
framework-free (Constitution Principle II / G2).

## Types

```ts
type FreeMidiEventLike = { midiNote: number; timestampMs: number; durationMs?: number };

interface DetectedNote {
  midiNote: number;
  startStep: number;      // 0..15 within its measure (1/16 grid)
  durationSteps: number;  // 1..(16 - startStep)
  acrossBarLine: boolean; // display-only carry
}

interface DetectedRest {
  startStep: number;      // 0..15
  durationSteps: number;  // >= 4 (>= 1 beat)
}

interface DetectedMeasure {
  index: number;
  startMs: number;
  endMs: number;
  complete: boolean;      // durations sum == 4 beats
  notes: DetectedNote[];
  rests: DetectedRest[];  // only for genuine gaps >= 1 beat
}
```

## Function contracts

### `detectMeasures(events, bpm) → DetectedMeasure[]`

Pure, total (never throws for any input).

**Preconditions**: `events` sorted ascending by `timestampMs`; `bpm > 0` (effective session BPM, floored at 10 per existing contract).

**Postconditions**:
- Anchor: `measures[0].startMs === events[0].timestampMs` (R-002). Empty `events` → `[]`.
- Every measure spans exactly `4 × 60_000 / bpm` ms.
- Each onset maps to exactly one `DetectedNote` in exactly one measure; onsets in the same 1/16 cell collapse to one `startStep` (FR-010).
- `complete` is `false` for at most the final measure; all others true (FR-003/FR-006).
- `durationSteps === clamp(round(durationMs / (msPerBeat/4)), 1, 16 - startStep)` (FR-013; min 1).
- `rests` contain only cells with no onset where the gap from prior note end to next onset is `≥ msPerBeat` (FR-005). Sub-beat gaps produce no rest.
- Deterministic: same `(events, bpm)` always returns identical structure (FR-007, SC-005).

**Example vector (target scenario, SC-001)** — `bpm = 80` (beat = 750 ms, cell = 187.5 ms):
- Eight events at `timestampMs = 0, 750, 1500, 2250, 3000, 3750, 4500, 5250`, each `durationMs = 750`, single pitch.
- Result: 2 measures; M0 notes = 4× `{startStep: 0,4,8,12, durationSteps: 4, value 1/4}`, complete; M1 identical; `rests = []`.

### `detectMeasures.quantizeNote(eventMsRel, msPerBeat) → { startStep, durationSteps }`

Pure helper. `startStep = clamp(round(rel / (msPerBeat/4)), 0, 15)`; `durationSteps = clamp(round(durationMs / (msPerBeat/4)), 1, 16 - startStep)`.

### `freeModeToPluginNotes(measures, bpm, timestampOffset) → PluginNoteEvent[]`

Pure. Converts derived measures into the `PluginNoteEvent[]` consumed by
`PluginStaffViewer` (staff display) and replay. `timestamp` values are generated
from measure grid positions (`measureStartMs + startStep × cell`) and
`durationMs = durationSteps × cell` — authoritative, metronome-agnostic, and
identical for display/save/replay (FR-007). `timestampOffset` mirrors the
existing StaffViewer prop (default 0), so callers can align to a session start.

### `computeNoteValue(steps) → '1/4' | '1/8' | '1/16' | ... | 'whole'`

Pure. Maps step counts to conventional note values for the measure grid
(16 steps = whole, 8 = half, 4 = quarter, 2 = eighth, 1 = sixteenth).

## Guarantee (metronome-agnostic)

None of these contracts accept a metronome state or clock. The same
`FreeMidiEvent[]` yields identical measures whether the metronome ran or not
(FR-001, SC-007). The metronome subsystem is intentionally out of the call graph.

## Consuming integration points (unchanged contracts)

- `context.components.StaffViewer({ notes, bpm, timestampOffset })` —
  supplies the measure grid + note glyph rendering from `PluginNoteEvent[]`.
- `FreeMidiRecord { events, elapsedMs, noteCount, bpm }` — storage contract unchanged.
- `context.playNote` / `context.stopPlayback` — replay behavior unchanged.