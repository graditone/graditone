# Data Model: Time Signatures

**Feature**: `044-time-signatures`  
**Date**: 2026-03-10

---

## Existing Domain Entities (unchanged)

### TimeSignatureEvent

Already exists at `backend/src/domain/events/time_signature.rs`. No changes needed.

```rust
pub struct TimeSignatureEvent {
    pub tick: Tick,       // Position in score (Tick::new(0) = start of piece)
    pub numerator: u8,    // Beats per measure (e.g., 2 for 2/4, 6 for 6/8)
    pub denominator: u8,  // Beat unit as note-value denominator (e.g., 4 = quarter, 8 = eighth)
}
```

**Validation rules** (already enforced by `Score::add_time_signature_event`):
- Only one time signature event per tick position (no duplicates at tick 0)
- Stored in `score.global_structural_events` as `GlobalStructuralEvent::TimeSignature`

### Score

Already exists at `backend/src/domain/score.rs`. The `global_structural_events` field already holds `TimeSignatureEvent` values.

**State after this feature**: The score's `global_structural_events` at tick 0 will contain the actual time signature from the MusicXML file, instead of always 4/4.

---

## Derived Value: ticks_per_measure

This is not a persisted entity — it is a computed value derived from `TimeSignatureEvent` whenever measure boundaries are needed.

**Formula** (integer arithmetic, 960 PPQ):

```
ticks_per_measure = (3840 × numerator) / denominator
```

Where 3840 = 960 PPQ × 4 (a whole note in ticks).

| Time Signature | ticks_per_measure |
|---|---|
| 2/4 | 1920 |
| 3/4 | 2880 |
| 4/4 | 3840 |
| 3/8 | 1440 |
| 6/8 | 2880 |
| 9/8 | 4320 |
| 12/8 | 5760 |

**Usage locations** in `backend/src/layout/mod.rs`:
1. MeasureInfo construction: `start_tick = i as u32 * ticks_per_measure`
2. Measure number: `measure_num = (system_start_tick / ticks_per_measure) + 1`
3. Note-to-measure bucketing: `measure_index = (start_tick / ticks_per_measure) as usize`

---

## Data Flow Diagram

```
MusicXML file
      │
      ▼
MusicXMLParser           (reads <time><beats>N</beats><beat-type>D</beat-type></time>)
      │  TimeSignatureData { beats: N, beat_type: D }
      ▼
MusicXMLConverter        (CHANGED: reads attrs.time, creates TimeSignatureEvent(0, N, D))
      │  Score { global_structural_events: [GlobalStructuralEvent::TimeSignature(N, D)] }
      ▼
Score model (Rust domain)
      │
      ▼
LayoutView.tsx           (UNCHANGED: reads firstTimeSigEvent, passes {numerator:N, denominator:D})
      │  JSON: { staffs: [{ time_signature: {numerator:N, denominator:D}, ... }] }
      ▼
compute_layout (Rust/WASM) (CHANGED: derives ticks_per_measure=(3840×N)/D, uses instead of 3840)
      │  LayoutOutput with correct measure tick boundaries
      ▼
LayoutRenderer.tsx       (UNCHANGED: renders layout output)
```

---

## Entities NOT Changed

| Entity | Location | Reason |
|--------|----------|--------|
| `TimeSignatureData` | `importers/musicxml/types.rs` | Already correct; parser reads beats/beat_type correctly |
| `MusicXMLParser` | `importers/musicxml/parser.rs` | Already parses `<time>` element correctly |
| `StaffData` | `layout/mod.rs` | Already has `time_numerator`, `time_denominator` fields |
| `positioner::position_time_signature` | `layout/positioner.rs` | Already uses actual numerator/denominator |
| `beams::group_beamable_by_time_signature` | `layout/beams.rs` | Already uses actual numerator/denominator |
| Frontend `LayoutView.tsx` | `frontend/src/components/layout/` | Already reads and passes time signature correctly |
| Frontend `score.ts` TypeScript types | `frontend/src/types/score.ts` | Already has `time_signature: {numerator, denominator}` |

---

## State Transitions

**Before fix** for a 2/4 MusicXML file:
1. Parser reads `beats=2, beat_type=4` ✅
2. Converter ignores it, writes `TimeSignatureEvent(tick=0, numerator=4, denominator=4)` ❌
3. Score model has 4/4 ❌
4. LayoutView reads 4/4 from model ❌
5. Layout engine computes measures with 3840 ticks (4/4) ❌

**After fix** for a 2/4 MusicXML file:
1. Parser reads `beats=2, beat_type=4` ✅
2. Converter reads it, writes `TimeSignatureEvent(tick=0, numerator=2, denominator=4)` ✅
3. Score model has 2/4 ✅
4. LayoutView reads 2/4 from model ✅
5. Layout engine derives `ticks_per_measure = (3840×2)/4 = 1920` ✅
6. Layout engine computes measures with 1920 ticks (2/4) ✅
