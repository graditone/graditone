# Research: Repeat Barlines (041)

**Phase**: Phase 0
**Branch**: `041-repeat-barlines`
**Date**: 2026-06-25
**Spec**: [spec.md](spec.md)

## R-001: MusicXML Repeat Barline Encoding

**Decision**: Parse `<barline location="right|left"><repeat direction="forward|backward"/></barline>` elements inside each MusicXML `<measure>`. Set boolean flags `start_repeat` and `end_repeat` on `MeasureData`.

**Evidence**: La Candeur MusicXML (`scores/Burgmuller_LaCandeur.mxl`) was parsed during the Clarify phase. It contains:

```xml
<!-- measure 8 — right-edge end-repeat -->
<barline location="right">
  <bar-style>light-heavy</bar-style>
  <repeat direction="backward"/>
</barline>

<!-- measure 9 — left-edge start-repeat -->
<barline location="left">
  <repeat direction="forward"/>
</barline>

<!-- measure 16 — right-edge end-repeat -->
<barline location="right">
  <bar-style>light-heavy</bar-style>
  <repeat direction="backward"/>
</barline>
```

**Mapping rules**:
- `location="right"` + `direction="backward"` → `end_repeat = true` on the measure
- `location="left"` + `direction="forward"` → `start_repeat = true` on the measure
- A measure can have both (seldom in practice, but structurally valid → `RepeatBoth` barline at one boundary)

**Alternatives considered**: Storing barline `<bar-style>` values (light-heavy, heavy-light, heavy-heavy) as the source of truth. Rejected because bar-style is a rendering hint, not the semantic intent. The `<repeat direction>` attribute is the authoritative semantic signal per MusicXML spec.

---

## R-002: Barline Geometry at Measure Boundaries

**Decision**: Add `start_repeat: bool` and `end_repeat: bool` to `MeasureInfo` in `backend/src/layout/breaker.rs`. In `create_bar_lines()` (`backend/src/layout/mod.rs`), determine barline type at each measure boundary by inspecting adjacent `MeasureInfo` flags.

**Evidence**: `create_bar_lines(measure_infos: &[MeasureInfo], ...)` already iterates measure boundaries to place `Final` (last measure) or `Single` barlines. The barline between measure `i` and `i+1` is the natural place to check `measure_infos[i].end_repeat` and `measure_infos[i+1].start_repeat`.

**Boundary logic**:
```
end_repeat[i] && start_repeat[i+1]  →  RepeatBoth
end_repeat[i]                        →  RepeatEnd
start_repeat[i+1]                    →  RepeatStart  (start-repeat barline drawn at left of measure i+1)
(default)                             →  Single or Final
```

**Alternatives considered**: Passing `repeat_barlines` directly to the layout engine and looking up by tick. Resolved that tick lookup is unnecessary; `MeasureInfo` already carries tick position and the flag can be set at `MeasureInfo` construction time in `compute_layout`.

---

## R-003: Repeat Dot Positions in Rust (Principle VI Compliance)

**Decision**: Compute repeat dot positions (x, y, radius) entirely in `backend/src/layout/mod.rs` when constructing `BarLine` for `RepeatStart`, `RepeatEnd`, or `RepeatBoth` types. Emit as `Vec<RepeatDotPosition>` in the layout output.

**Dot positioning formula** (staff-space units, Rust):
- Two dots per repeat side, positioned at the **2nd and 4th line spaces** of the staff (counting from bottom).
- Reference x: the barline `x` coordinate ± a configurable `dot_offset` (default `0.6` staff spaces from the thick bar).
- Reference y: `staff_top + 1.0 * staff_space` (second space = between lines 1 and 2) and `staff_top + 3.0 * staff_space` (fourth space = between lines 3 and 4).
- Dot radius: `0.25 * staff_space`.

```
RepeatEnd: dots to the LEFT of the thick bar
  x_dot = barline_x - dot_offset
  y_dot[0] = staff_top + 1.0 * staff_space
  y_dot[1] = staff_top + 3.0 * staff_space

RepeatStart: dots to the RIGHT of the thick bar
  x_dot = barline_x + dot_offset

RepeatBoth: 4 dots (2 left + 2 right)
```

**Evidence**: Constitution Principle VI explicitly states: *"The Rust/WASM engine is the ONLY permitted layout implementation; TypeScript-side layout engines (coordinate calculations in frontend code) are explicitly prohibited."* Dot positions are spatial geometry — they must be in Rust.

**Alternatives considered**: Computing dot SVG positions in `LayoutRenderer.tsx` from the `BarLineType` string. Rejected as a direct Principle VI violation (TypeScript coordinate calculation).

---

## R-004: Playback Note Expansion Strategy

**Decision**: Introduce a pure TypeScript service `RepeatNoteExpander` that transforms the flat `Note[]` array into a repeat-expanded `Note[]` before it is passed to `usePlayback()`. The `PlaybackScheduler` and `MusicTimeline` are not modified.

**Evidence**: Integration points confirmed in codebase:
- `frontend/src/components/ScoreViewer.tsx` lines 99 and 113: collects `firstVoice.interval_events` into `allNotes`, then calls `usePlayback(allNotes, initialTempo)`.
- `frontend/plugins/score-player/scorePlayerContext.ts` lines 93 and 210: same pattern.
- `frontend/src/services/playback/MusicTimeline.ts`: `usePlayback(notes: Note[], tempo: number)` — accepts notes as a flat pre-sorted array; internal state depends on `notes` being stable.

**Expansion algorithm**:
1. Receive `{notes: Note[], repeatBarlines: RepeatBarline[]}` where each `RepeatBarline` carries `{measure_index, start_tick, end_tick, barline_type}`.
2. Build `RepeatSection[]` by pairing `End` markers with their nearest preceding `Start` (or tick 0 if none).
3. For each section `{sectionStartTick, sectionEndTick}`:
   - `sectionDuration = sectionEndTick - sectionStartTick`
   - Collect all `notes` where `sectionStartTick <= note.start_tick < sectionEndTick`
   - Clone them with `start_tick += sectionDuration` (and `end_tick += sectionDuration`)
   - Insert clones immediately after the original section's last note
4. Return the fully expanded, tick-sorted array.

**Tick arithmetic**: All tick values are `u32`-compatible integers (960 PPQ). No floating-point used (Principle IV).

**Alternatives considered**:
- Modifying `PlaybackScheduler` to be repeat-aware: rejected — adds hidden state to a stateless scheduler and breaks the single-responsibility model.
- Fetching a WASM-expanded note list: rejected — note expansion is data-only (no geometry), belongs in TypeScript domain.

---

## R-005: La Candeur Playback Result Validation

**Decision**: The canonical acceptance criterion is **39 sounded measures** for La Candeur.

**Evidence**: Derived from the MusicXML parse during the Clarify phase:
- 23 raw measures total
- Section A: measures 1–8 (8 measures) — repeated once → 16 measures played
- Section B: measures 9–16 (8 measures, start-repeat at m9, end-repeat at m16) — repeated once → 16 measures played
- Section C: measures 17–23 (7 measures) — played once → 7 measures played
- Total: 16 + 16 + 7 = **39 sounded measures**

The SC-001 success criterion in `spec.md` encodes this exact count. Integration test and E2E test both assert 39 measures.

**Tick calculation** (for test assertions):
- 4/4 time, 960 PPQ → 1 measure = 4 × 960 = 3840 ticks
- 39 measures × 3840 ticks/measure = **149,760 total ticks** in expanded note stream
- Last note's `end_tick` in the expanded stream ≤ 149,760

---

## R-006: `compute_layout` Repeat Barlines Input Path

**Decision**: `compute_layout(score: &serde_json::Value, config: &LayoutConfig)` reads `score["repeat_barlines"]` as a JSON array and uses it to annotate `MeasureInfo` entries with `start_repeat`/`end_repeat` when building the `measure_infos` vector.

**Evidence**: `backend/src/layout/mod.rs` line 63: `pub fn compute_layout(score: &serde_json::Value, config: &LayoutConfig) -> GlobalLayout`. The score JSON is already the input; `repeat_barlines` is serialized into it by `serde` from the `Score` domain struct. The layout engine currently extracts `measures` and `instruments` from the JSON; a third extraction of `repeat_barlines` follows the same pattern.

**Lookup**: For each `measure_index` in the `repeat_barlines` array, set the corresponding `MeasureInfo` flag. Since `MeasureInfo` is built by iterating `measures` with `enumerate`, the index mapping is direct.

**Alternatives considered**: A separate WASM function accepting a `repeat_barlines` parameter. Rejected as unnecessary indirection — the score JSON is already the single input contract.
