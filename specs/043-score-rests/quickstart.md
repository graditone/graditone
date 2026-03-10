# Quickstart: Rest Symbols in Scores

**Feature**: `043-score-rests`  
**Branch**: `043-score-rests`

---

## Prerequisites

- Rust 1.93+ with `wasm-pack` installed
- Node.js 20+ with `npm` or `pnpm`
- `cargo test` passing on `main` before starting

---

## Step 1: Verify baseline tests pass

```bash
cd backend
cargo test 2>&1 | tail -5
# Expected: test result: ok. N passed; 0 failed
```

---

## Step 2: Domain Model Changes

**Add `RestEvent` entity** (`backend/src/domain/events/rest.rs`):
```rust
use crate::domain::{ids::RestEventId, value_objects::Tick};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RestEvent {
    pub id: RestEventId,
    pub start_tick: Tick,
    pub duration_ticks: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_type: Option<String>,
}
```

**Register in mod.rs** (`backend/src/domain/events/mod.rs`):
```rust
pub mod rest;
```

**Add `RestEventId`** to `backend/src/domain/ids.rs` (mirrors NoteId pattern — UUID wrapper).

**Extend `Voice`** (`backend/src/domain/voice.rs`):
```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Voice {
    pub id: VoiceId,
    pub interval_events: Vec<Note>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rest_events: Vec<RestEvent>,  // NEW
}
```

---

## Step 3: MusicXML Parser Changes

**Extend `RestData`** (`backend/src/domain/importers/musicxml/types.rs`):
```rust
pub struct RestData {
    pub duration: i32,
    pub voice: usize,
    pub staff: usize,
    pub note_type: Option<String>,  // NEW
}
```

**Preserve `note_type` in parser** (`parser.rs`, in the `b"note"` branch at ~line 411):
```rust
// Before:
let rest = RestData {
    duration: note.duration,
    voice: note.voice,
    staff: note.staff,
};

// After:
let rest = RestData {
    duration: note.duration,
    voice: note.voice,
    staff: note.staff,
    note_type: note.note_type.clone(),  // NEW
};
```

---

## Step 4: Converter Changes

**Convert rests** (`converter.rs`, in each `MeasureElement::Rest(rest_data)` arm):
```rust
MeasureElement::Rest(rest_data) => {
    // Existing: advance timing
    timing_context.advance_by_duration(rest_data.duration)?;

    // NEW: create RestEvent and store in current voice's rest_events
    let fraction = Fraction::from_musicxml(rest_data.duration, timing_context.divisions);
    let ticks = fraction.to_ticks()?;
    let start_tick = Tick::new(current_tick_before_advance);
    let rest_event = RestEvent {
        id: RestEventId::new(),
        start_tick,
        duration_ticks: ticks as u32,
        note_type: rest_data.note_type.clone(),
    };
    current_voice.rest_events.push(rest_event);
}
```

---

## Step 5: Bump Schema Version

In `backend/src/adapters/dtos.rs`:
```rust
// Before:
const SCORE_SCHEMA_VERSION: u32 = 4;

// After:
const SCORE_SCHEMA_VERSION: u32 = 5;
```

---

## Step 6: Layout Engine Changes

**Extend `VoiceData`** (`layout/mod.rs`):
```rust
struct VoiceData {
    notes: Vec<NoteEvent>,
    rests: Vec<RestEvent>,  // NEW
}
```

**Populate rests in `extract_instruments()`**: Parse `rest_events` JSON array in the same block that parses `notes` / `interval_events`.

**Call rest positioning in `position_glyphs_for_staff()`**:
```rust
let rest_glyphs = positioner::position_rests_for_staff(
    &voice_rests_in_range,
    &tick_to_x,
    &measure_bounds,
    time_numerator,
    time_denominator,
    staff_has_multiple_voices,
    config,
);
all_glyphs.extend(rest_glyphs);
```

**Extend spacer** to include rest durations in `compute_measure_width()` calls.

---

## Step 7: Run Tests

```bash
# Unit tests
cd backend && cargo test rest 2>&1

# All backend tests
cd backend && cargo test 2>&1 | tail -10

# Frontend tests
cd frontend && npm test 2>&1 | tail -10
```

---

## Verification

Import a score with rests (e.g., Pachelbel Canon in D which has rests in some voices):
1. Open the app
2. Import `scores/Pachelbel_CanonD.mxl`
3. Observe rest symbols rendered between notes in all staves
4. Confirm rest symbols are at correct horizontal positions

Or use the development fixture:
```bash
cd backend
cargo run --example import_score -- scores/Pachelbel_CanonD.mxl \
  | jq '.instruments[0].staves[0].voices[0].rest_events | length'
# Expected: > 0 (rests are now present in JSON output)
```
