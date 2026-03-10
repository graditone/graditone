# Data Model: Rest Symbols in Scores

**Feature**: `043-score-rests`  
**Date**: 2026-03-10

---

## Entities

### RestEvent (NEW — `backend/src/domain/events/rest.rs`)

Represents a period of silence in a musical voice. Parallel to `Note` but without pitch.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `RestEventId` | Unique identity (UUID, same pattern as `NoteId`) |
| `start_tick` | `Tick` | Beat position within the score at 960 PPQ |
| `duration_ticks` | `u32` | Duration in ticks. Must be > 0. |
| `note_type` | `Option<String>` | Original MusicXML note type string: `"whole"`, `"half"`, `"quarter"`, `"eighth"`, `"16th"`, `"32nd"`, `"64th"`. Used for glyph selection. |

**Validation rules**:
- `duration_ticks > 0` (enforced in constructor, mirrors `Note::new`)
- No pitch — structural silence only

**State transitions**: None. `RestEvent` is immutable after creation.

---

### Voice (MODIFIED — `backend/src/domain/voice.rs`)

Extended to carry both notes and rests.

| Field | Type | Change |
|-------|------|--------|
| `id` | `VoiceId` | Unchanged |
| `interval_events` | `Vec<Note>` | Unchanged |
| `rest_events` | `Vec<RestEvent>` | **NEW** — initialized as empty Vec |

**Invariants unchanged**: Overlapping note pitches still rejected. Rests do not participate in note overlap validation (rests have no pitch).

---

### RestData (MODIFIED — `backend/src/domain/importers/musicxml/types.rs`)

Parser-layer intermediate type. Extended to preserve `note_type`.

| Field | Type | Change |
|-------|------|--------|
| `duration` | `i32` | Unchanged — divisions units from MusicXML |
| `voice` | `usize` | Unchanged |
| `staff` | `usize` | Unchanged |
| `note_type` | `Option<String>` | **NEW** — copied from `NoteData.note_type` during split |

---

### VoiceData (MODIFIED — `backend/src/layout/mod.rs`)

Layout-layer working type. Extended to carry parsed rest events.

| Field | Type | Change |
|-------|------|--------|
| `notes` | `Vec<NoteEvent>` | Unchanged |
| `rests` | `Vec<RestEvent>` | **NEW** — populated from JSON `rest_events` array |

**RestEvent (layout layer)** — internal struct in layout/mod.rs:

| Field | Type | Description |
|-------|------|-------------|
| `start_tick` | `u32` | Beat position |
| `duration_ticks` | `u32` | Duration |
| `note_type` | `Option<String>` | Duration class string for glyph selection |
| `voice_number` | `u8` | 1-indexed voice number (for vertical offset) |

---

## Relationships

```
Score
  └─ Instrument (1..*) 
       └─ Staff (1..*)
            └─ Voice (1..*)
                 ├─ Note (0..*) — interval_events
                 └─ RestEvent (0..*)  ← NEW — rest_events
```

---

## Glyph Selection Logic

Rest glyph codepoint selection is performed in `positioner.rs`:

```
fn rest_glyph_codepoint(note_type: Option<&str>, duration_ticks: u32) -> char {
    // Primary: note_type string from MusicXML
    if let Some(nt) = note_type {
        return match nt {
            "whole"   => '\u{E4E3}',  // restWhole
            "half"    => '\u{E4E4}',  // restHalf
            "quarter" => '\u{E4E5}',  // restQuarter
            "eighth"  => '\u{E4E6}',  // rest8th
            "16th"    => '\u{E4E7}',  // rest16th
            "32nd"    => '\u{E4E8}',  // rest32nd
            "64th"    => '\u{E4E9}',  // rest64th
            _         => fallback(duration_ticks),
        };
    }
    // Fallback: duration_ticks threshold comparison
    fallback(duration_ticks)
}

fn fallback(duration_ticks: u32) -> char {
    match duration_ticks {
        t if t >= 3840 => '\u{E4E3}',  // whole
        t if t >= 1920 => '\u{E4E4}',  // half
        t if t >= 960  => '\u{E4E5}',  // quarter
        t if t >= 480  => '\u{E4E6}',  // eighth
        t if t >= 240  => '\u{E4E7}',  // 16th
        t if t >= 120  => '\u{E4E8}',  // 32nd
        _              => '\u{E4E9}',  // 64th
    }
}
```

---

## Vertical Position Logic

Y-coordinate for rest glyphs (staff space = 20 units, top line at y=0):

```
fn rest_y(duration_ticks: u32, voice_number: u8, staff_has_multiple_voices: bool, units_per_space: f32) -> f32 {
    // Standard position (fraction of staff height from top)
    let base_y = match duration_ticks {
        t if t >= 3840 => 1.0 * units_per_space,  // whole: hangs from line 1
        _              => 2.0 * units_per_space,   // all others: middle of staff
    };

    // Voice offset (only in multi-voice staves)
    if staff_has_multiple_voices {
        if voice_number % 2 == 1 {
            base_y - units_per_space   // Voice 1: shift up
        } else {
            base_y + units_per_space   // Voice 2: shift down
        }
    } else {
        base_y
    }
}
```

---

## Full-Measure Rest Detection

```
fn is_full_measure_rest(duration_ticks: u32, time_numerator: u8, time_denominator: u8) -> bool {
    let ticks_per_measure = time_numerator as u32 * (3840 / time_denominator as u32);
    duration_ticks == ticks_per_measure
}
```

When `true`, x-position uses centering formula instead of beat-offset lookup:
```
rest_x = measure_start_x + (measure_width - REST_GLYPH_WIDTH) / 2.0
```

Where `REST_GLYPH_WIDTH` is the advance width of a whole rest glyph in the current font size (approximately 20 units at font-size 80, derived from Bravura metrics).
