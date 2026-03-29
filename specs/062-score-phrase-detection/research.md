# Research: Score Phrase Detection

**Feature**: 062-score-phrase-detection  
**Date**: 2026-03-29  
**Status**: Complete

## Research Tasks

### R1: How do slur chains work in the existing codebase?

**Decision**: Slur chains are resolved post-collection via `resolve_slur_chains()` in `converter/ties.rs`. Each note with a slur start gets `slur_next: Option<NoteId>` pointing to the slur-end note. Slurs are per-voice and unidirectional (start→end only, no `slur_start` marker on end notes).

**Rationale**: The existing slur resolution is a good foundation — we can walk `slur_next` chains to identify phrase-spanning slur arcs. Since slurs are resolved per-voice, phrase detection should use the primary staff's first voice for slur-based grouping.

**Alternatives considered**: Building a separate slur index during parsing was rejected — the existing `slur_next` field already provides the chain structure needed.

### R2: Where to insert phrase detection in the import pipeline?

**Decision**: Call `detect_phrases()` in `parse_musicxml()` (WASM bindings.rs) after `MusicXMLConverter::convert()` and `compute_difficulty()`, before building `ScoreDto`. This mirrors the existing `compute_difficulty()` pattern.

**Rationale**: At this point, the Score has all data resolved: slur chains, repeat barlines, volta brackets, measure_end_ticks, key/time signatures. The phrase detection module receives the fully-constructed Score and returns phrase regions. Placing it in bindings.rs (not inside the converter) keeps the converter focused on MusicXML-to-domain translation, and phrase detection as a separate domain concern.

**Alternatives considered**: 
- Inside `MusicXMLConverter::convert()` — rejected because phrase detection is an analysis step, not a conversion step. It should work on any Score, not just MusicXML-imported ones.
- In the frontend — rejected per clarification (backend is authoritative).

### R3: How to represent phrase boundaries relative to measures?

**Decision**: Use `measure_end_ticks` (already computed and stored on Score) to map phrase boundaries to ticks. A `PhraseRegion` stores `start_measure_index` and `end_measure_index` (both 0-based, end inclusive), plus derived `start_tick` and `end_tick` computed from `measure_end_ticks`.

**Rationale**: `measure_end_ticks` is the canonical measure boundary array. Measure 0 starts at tick 0 (or `pickup_ticks` if anacrusis). Measure N ends at `measure_end_ticks[N]`. This is already used by the practice plugin's `measureRangeToTicks()` function.

**Alternatives considered**: Tick-only boundaries (no measure indices) — rejected because phrases must align to measure boundaries per spec, and measure indices are easier for humans to validate.

### R4: How to walk slur chains across a voice to find phrase boundaries?

**Decision**: Iterate through all notes in the primary voice (voice index 0 of the primary staff, staff index 0). For each note where `slur_next` is `Some(id)`:
1. Find the end note by ID in the same voice.
2. Record the measure range spanned by start_tick → end_tick of the slur.
3. If consecutive slurs overlap or are adjacent (end of one slur is at/near start of next), merge them into one phrase.
4. Gaps between slur groups become phrase boundaries.

**Rationale**: This directly uses the composer's phrasing marks. In classical piano scores, the treble/right-hand staff typically carries the melodic slurs that define phrases.

**Alternatives considered**: Using all voices and taking the union of slurs — rejected because accompaniment voices often have different slur patterns that would dilute the melodic phrasing signal.

### R5: How to detect structural hard boundaries?

**Decision**: Collect all measure indices where any of the following occur:
- `repeat_barlines` with any `barline_type` → that `measure_index`
- `volta_brackets` → `start_measure_index` and `end_measure_index + 1`
- `global_structural_events` containing `TimeSignature` with tick > 0 → convert tick to measure index via `measure_end_ticks`
- `staff_structural_events` containing `KeySignature` with tick > 0 → convert to measure index

These measure indices form a sorted set of hard boundaries. Any phrase that would span across a hard boundary is split at that boundary.

**Rationale**: These are unambiguous structural markers in the musical notation. Repeat barlines definitively separate musical sections. Time/key signature changes indicate new musical sections.

**Alternatives considered**: Only using repeat barlines — rejected because key/time signature changes are equally strong structural signals that should not be ignored.

### R6: How to detect rest-based boundaries?

**Decision**: For each measure boundary (between measures M and M+1), check if there is a rest across all active voices at that boundary transition. Specifically: if the last events in all voices of measure M end with rests (or notes that end well before the measure boundary), this suggests a breathing point.

**Rationale**: Simultaneous rests across all voices indicate a musical pause — a natural phrase boundary. This is a secondary signal, only used when slurs don't provide clear grouping.

**Alternatives considered**: Analyzing rest positions within measures — rejected as too complex for initial version. Measure-boundary rest detection is simpler and sufficient.

### R7: How to render phrase color bands in the frontend?

**Decision**: Phrase visualization is a frontend overlay, NOT part of the layout engine output. The frontend uses phrase data (measure indices + ticks) from the Score and the layout engine's `System` data (tick ranges, bounding boxes) to compute overlay rectangles:
1. For each phrase, find which Systems contain measures in the phrase's range
2. For each System, compute the x-range by interpolating the phrase's tick range within the System's tick_range and bounding_box
3. Render semi-transparent colored rectangles behind the score content

**Rationale**: Phrase color bands are a visualization concern, not layout geometry. The layout engine (Constitution VI) is the authority for spatial geometry of musical elements, but phrase bands are UI annotations — similar to how the practice plugin highlights notes without modifying the layout engine. This keeps the layout engine focused on notation geometry.

**Alternatives considered**: Adding phrase bands to the layout engine output — rejected because it would couple musical analysis to rendering, violating separation of concerns. Phrase bands are not musical notation elements; they are pedagogical annotations.

### R8: What are the best practices for the fallback 4/8-measure grouping?

**Decision**: When no slurs, structural markers, or rest patterns provide boundaries for a section:
- In 4/4 or 3/4 time: group into 4-measure phrases
- In 2/4 or 6/8 time: group into 8-measure phrases (since measures are shorter)
- In any compound time: group into 4-measure phrases as default
- Always align to the start of the ungrouped section (not to absolute measure 0)

**Rationale**: 4-measure phrases are the most common phrase length in Western classical music (the "4-bar phrase" is a foundational concept). 8-measure grouping for shorter meters maintains similar musical duration per phrase.

**Alternatives considered**: Fixed 4-measure grouping regardless of time signature — simpler but produces phrases that feel too short in 2/4 time. Adjusting by actual musical duration (tick count) — over-engineered for a fallback.
