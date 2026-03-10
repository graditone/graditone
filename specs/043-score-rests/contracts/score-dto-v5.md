# Contract: ScoreDto JSON Schema v5

**Feature**: `043-score-rests`  
**Change**: `SCORE_SCHEMA_VERSION` 4 → 5  
**Affected file**: `backend/src/adapters/dtos.rs`

---

## Summary of Change

The `Voice` entity in the JSON output gains a new optional array field: `rest_events`. The change is additive and backward-compatible — consumers that ignore `rest_events` continue to work correctly without modification.

---

## Diff: Voice JSON Shape

### Before (schema v4)
```json
{
  "id": "voice-uuid",
  "interval_events": [
    {
      "id": "note-uuid",
      "start_tick": { "value": 0 },
      "duration_ticks": 960,
      "pitch": { "value": 60 },
      "spelling": null,
      "beams": []
    }
  ]
}
```

### After (schema v5)
```json
{
  "id": "voice-uuid",
  "interval_events": [
    {
      "id": "note-uuid",
      "start_tick": { "value": 0 },
      "duration_ticks": 960,
      "pitch": { "value": 60 },
      "spelling": null,
      "beams": []
    }
  ],
  "rest_events": [
    {
      "id": "rest-uuid",
      "start_tick": { "value": 960 },
      "duration_ticks": 960,
      "note_type": "quarter"
    }
  ]
}
```

---

## New Field: `rest_events`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `rest_events` | `RestEventJson[]` | No (defaults to `[]`) | Zero or more rest events in this voice |

### `RestEventJson` object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID) | Yes | Unique identifier |
| `start_tick` | `{ "value": number }` | Yes | Beat position at 960 PPQ |
| `duration_ticks` | `number` | Yes | Duration in ticks, must be > 0 |
| `note_type` | `string \| null` | No | MusicXML note type: `"whole"`, `"half"`, `"quarter"`, `"eighth"`, `"16th"`, `"32nd"`, `"64th"` |

---

## Serialization Rules

- `rest_events` is serialized with `#[serde(default, skip_serializing_if = "Vec::is_empty")]` — voices with no rests do not include the field in JSON output
- `note_type` is serialized with `#[serde(skip_serializing_if = "Option::is_none")]` — omitted when not present
- Layout engine must treat missing `rest_events` field as empty array

---

## Version Bump

```rust
// dtos.rs — before
/// v4: repeat_barlines added to ScoreDto
const SCORE_SCHEMA_VERSION: u32 = 4;

// dtos.rs — after
/// v5: rest_events added to Voice
const SCORE_SCHEMA_VERSION: u32 = 5;
```

---

## Consumer Impact

| Consumer | Impact | Action Required |
|----------|--------|-----------------|
| WASM layout engine (`layout/mod.rs`) | Must read `rest_events` to generate rest glyphs | Update `extract_instruments()` JSON parsing |
| Playback engine (ToneAdapter.ts) | No impact — playback timing uses `interval_events` ticks only | None |
| Frontend renderer | No impact — renders `Glyph` structs from layout output | None |
| Plugin API | No impact — plugins consume `GlobalLayout` not `ScoreDto` | None |
