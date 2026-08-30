# Research: Onset-Derived Beat-Grid Reconstruction for Free Mode

**Feature**: 094 — Free Mode Measure Detection
**Date**: 2026-08-30
**Inputs**: spec.md (FR-001…FR-013, SC-001…SC-008), Constitution (I–VIII).

## R-001: Why onset-reconstruction, not the metronome or wall-clock

**Decision**: The beat grid and measure boundaries are ALWAYS reconstructed from the recorded note onsets. The metronome is never a clock source; wall-clock intervals are never used to define measures.

**Rationale**: The recorded scenario (8 on-beat quarter notes held one beat) currently fractures into 5 notes + a phantom 1/16 rest because `finalizeMeasureNotes` quantizes within fixed wall-clock measure windows that are not phase-locked to the user's musical beats. When a musician follows a metronome, the onsets themselves carry the beat phase — a reconstruction that anchors measure 1 at the first onset reproduces the metronome grid exactly (clarification confirmed: A≡B when the user follows ticks). Onset-derived grids are also correct when the metronome is OFF (free play without a click), so a single code path serves both — no metronome state needed.

**Alternatives considered**:
- *Metronome-locked grid*: correct only when the click runs; diverges the metronome-on and metronome-off code paths (violates the metronome-agnostic requirement); also depends on metronome tick subscription timing.
- *Wall-clock measure clock (status quo)*: drift/phase misalignment accumulates; the source of the reported bug.
- *BPM-from-inter-onset medians*: useful for *display BPM* only; not a measure-position source (retains wall-clock anchoring).

## R-002: Grid anchors and measure placement

**Decision**: Measure 1 starts at the time of the **first onset**. Each measure occupies exactly `4 beats`, where the beat length is derived from the session `bpm` (the effective BPM stored on `FreeMidiRecord`) as `msPerBeat = 60_000 / bpm`.

**Rationale**: Anchoring at the first onset makes "whoever starts first" the downbeat, matching how musicians play free practice (they start on 1). Using the effective session BPM for beat length keeps tempo invariance exact (SC-004).

**Alternatives considered**:
- *Anchor at session Start (existing behavior)*: start timestamp precedes the first onset; drifts; the source of off-by-beat phase errors.
- *Anchor at a metronome downbeat*: rejected (metronome-agnostic requirement).

## R-003: Attack quantization tolerance (proportional to beat) and off-grid handles

**Decision**: An onset's step index is `round((attackMs - measureStartMs) / msPerSixteenth)`, clamped to the current/open measure. This is a nearest-neighbor quantization with an implicit half-step (±1/32 → ±12.5% of a beat) capture radius — a sensible default that satisfies SC-006's ±25% tolerance bound without extra tuning. Re-timed/overlapping attacks resolving to the same step collapse into one grid position (no double-counted beats).

**Rationale**: Nearest-neighbor by rounding is already the existing quantizer; keeping it is low-risk and matches the ≤ 1/16 resolution requirement (R-004). Earlier-beat-bias on ties (round-half-down) avoids inventing time between beats.

**Alternatives considered**:
- *Strict mid-point rule with hysteresis*: only needed if jitter at exactly the boundary is common; defer (document as future tuning point).
- *Fixed ±25% band*: over-engineered for the current tolerance; nearest-neighbor already within it.

## R-004: Finest note value — 1/16; duration quantization

**Decision**: The finest detected value is 1/16. `FREE_STEPS_PER_MEASURE = 16` remains the grid; a note's detected duration in steps is `round(durationMs / msPerSixteenth)` (min 1 step), clamped so a note never extends past its attacking measure in the **detection** record (decomposition may carry it across the bar line for display, see R-006).

**Rationale**: Matches the existing 16-step grid and SC-008 (no value finer than 1/16). Clamping to the measure guarantees FR-003's exact-4-beat sums at detection time; hold-across-bar-line (FR-009) is handled as a *display/decomposition* concern so detection accounting stays exact.

**Alternatives considered**:
- *1/32 grid*: finer resolution but creates more jitter-fracture surface (the exact bug class we are fixing) and exceeds the clarified requirement.
- *No clamping*: would let a held note over-fill its attacking measure; violates FR-003.

## R-005: Replay & decomposition strategy — measure segmentation as a derived view

**Decision**: Detection happens on demand over the session's `FreeMidiEvent[]`:
- **Session-end / Stop**: recompute the full measure segmentation from scratch (first-onset anchor, effective BPM, per-segment 16-step grid) and build `measure[]` for persistence if desired.
- **Live staff**: maintain an incremental buffer, but re-anchor/requantize on each new note; the staff never depends on the wall-clock measure timer (which is removed). This keeps FR-007 (display/save/replay consistency) automatically true because all three derive from one source.

**Rationale**: FreeMidiRecord retains raw events + bpm (persistence model unchanged, G7 N/A). A single pure function `detectMeasures(events, bpm)` guarantees identical results across live staff, save, and replay (SC-005).

**Alternatives considered**:
- *Big-bang quantization at Stop only*: simpler, but the live staff during play would still drift — rejecting.
- *Persisting segmented measures*: changes the storage schema; only if tests require a cache. Marked optional-extension.

## R-006: Rests only for genuine silence; ties across the bar line

**Decision**: Rests are generated only where a gap ≥ `1 beat` (msPerBeat) exists between a note's end and the next onset (or to a measure boundary at session end), using greedy largest-first rest decomposition (whole→half→quarter→8th→16th). Sub-beat gaps are absorbed. Hold-across-bar-line: the note is *not detected* in two pieces; detection clamps to its attacking measure, and the display layer renders the note value spanning the boundary (WASM supports this); no spurious 1/16 rest appears (FR-005, SC-003).

**Rationale**: Mirrors the staff viewer's existing gap handling (`decomposeGapRests`, legato pass that fills < 1-quarter gaps) — but the *threshold* is raised to a full beat to match the "rests only for deliberate silence" requirement and to avoid the phantom-rest bug.

**Alternatives considered**:
- *Quarter-note gap threshold (staff viewer default 3840 ticks) — lower*: still generates a rest for a sub-beat silence; rejected (SC-003 is strict: no rest under one beat).
- *No rest generation*: would misreport genuine beats of silence; rejected.

## R-007: Tempo change mid-session (FR-011) and re-anchor after pause (FR-012)

**Decision**: A tempo change mid-session updates the effective BPM used for beat length; onsets before the change keep their detected positions (already recorded as raw events), subsequent quantization uses the new `msPerBeat`. When the session resumes after a silent pause, the FIRST onset after the pause re-anchors a fresh measure-1 of a new segment (the next complete set of 4 beats), preserving an honest partial measure for the pre-pause tail.

**Rationale**: Raw-event storage makes tempo re-derivation free; FR-011/FR-012 fall out of "derive from onsets + current bpm" naturally.

**Alternatives considered**:
- *Persist bpm history*: over-engineering; the effective BPM at Stop (already stored) is the documented source of truth.

## R-008: Exact timing budget

**Decision**: Reconstruction of ≤ 500 events is a single O(n) pass (plus a sort, already sorted) and well under 100ms — comfortably inside the constitution WASM-operation/60fps budgets. No caching required.

**Rationale**: Straightforward; a micro-benchmark is added to the unit tests to lock the bound (perf gate).

## R-009: Staff display consumption (no layout change)

**Decision**: `PluginStaffViewer` already renders the measure grid and note values from `notes` + `bpm` (16th-step quantization at 960 PPQ). The fix supplies correct `PluginNoteEvent` timestamps/durations; no changes to the WASM layout engine.

**Rationale**: The layout engine is forbidden to change (Principle VI); the bug is upstream (musical positions), not in layout.

## Consolidated decision record

| # | Decision | Spec refs |
|---|----------|-----------|
| D1 | Onset-reconstructed grid; metronome/wall-clock never sources | FR-001, SC-007 |
| D2 | Measure 1 anchored at first onset; beat = 60_000/bpm | FR-001/FR-003 |
| D3 | Nearest-neighbor quarter-step quantization (±½ step ≈ ±12.5% beat) | FR-004, SC-006 |
| D4 | 1/16 finest value; duration = round(steps); clamp to measure | FR-013, SC-008 |
| D5 | Detection = pure derived function on FreeMidiEvent[]; display/save/replay share it | FR-007, SC-005 |
| D6 | Rests only ≥ 1 beat gap; greedy largest-first; ties = display concern | FR-005, FR-009, SC-003 |
| D7 | Temp change: current effective bpm; pause → re-anchor at next first onset | FR-011, FR-012 |
| D8 | O(n) pass, <100ms; benchmark locked by test | SC-002..SC-004 |