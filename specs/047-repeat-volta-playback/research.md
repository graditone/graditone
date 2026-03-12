# Research: Volta Bracket Playback (Repeat Endings)

**Feature**: 047-repeat-volta-playback  
**Phase**: 0 — Resolves all NEEDS CLARIFICATION items from Technical Context  
**Date**: 2026-03-12

---

## Decision 1: `parse_barline_content` threading strategy for `<ending>` elements

**Decision**: Extend `parse_barline_content` to return a richer struct instead of `(bool, bool)`.

**Rationale**: The current signature is `fn parse_barline_content(reader, location) -> Result<(bool, bool)>`. Adding ending data as a third tuple element is fragile. A small `ParsedBarlineResult` struct carrying `start_repeat`, `end_repeat`, and `Option<RawEndingData>` is cleaner, matches the Rust idiom of named fields, and is readable at the call sites. The struct stays private to the parser module.

**Alternatives considered**: Returning a 3-tuple `(bool, bool, Option<RawEndingData>)` — rejected because unnamed tuples with three elements are hard to read and refactor. Using a separate `parse_ending_content` function — rejected because it would require a second pass over the same XML subtree.

**`RawEndingData` shape** (private parser type):
```rust
struct RawEndingData {
    number: u8,          // 1 or 2 (from MusicXML `number` attribute)
    end_type: EndingType, // Start | Stop | Discontinue
}
enum EndingType { Start, Stop, Discontinue }
```

The mapper accumulates one `start` event and one `stop`/`discontinue` event per bracket then constructs a `VoltaBracket` value.

---

## Decision 2: `VoltaBracket` placement in the mapper / score build

**Decision**: Accumulate first-pass `RawEndingData::Start` events in a scratch map keyed by `number`, then merge the matching `Stop`/`Discontinue` event at the close of the measure to emit a complete `VoltaBracket` and push it onto `score.volta_brackets`.

**Rationale**: MusicXML represents a bracket start and end as separate barline elements (start on the `location="left"` barline, stop/discontinue on `location="right"` barline of the last measure in the bracket). Because each measure is parsed atomically in the mapper, start events on the left barline and stop events on the right barline of the same measure resolve within one measure pass. Cross-measure brackets (bracket starts at measure N, ends at measure N+2) would require carrying the scratch map across measures, which is already the mapper pattern for other multi-measure state.

**Alternatives considered**: Resolving in a post-pass over the raw parsed measures — rejected as unnecessary extra complexity when the mapper already handles multi-measure state.

---

## Decision 3: `VoltaBracket` layout placement in the rendering tree

**Decision**: Volta bracket layout elements live on the **System** struct, not on individual Staff objects.

**Rationale**: A volta bracket is an above-staff annotation that spans one or more measures. Staves represent a single 5-line staff; bracket geometry must know the x-extent of each measure in the system, which is available at system-build time. The existing `MeasureNumber` precedent (which also lives on `System`) confirms this is the correct architectural level. The `System` struct in Rust (`layout/types.rs`) gains a `volta_bracket_layouts: Vec<VoltaBracketLayout>` field.

**Alternatives considered**: Attaching to `StaffGroup` — rejected because volta brackets are score-level notation, not per-instrument. Attaching to `Staff` — rejected for the same reason and because it would require duplicating the bracket across staves in multi-staff instruments.

**`VoltaBracketLayout` fields**:
```
number: u8           // 1 or 2
label: String        // "1." or "2."
x_start: f32         // x-position of the left edge of the bracket
x_end: f32           // x-position of the right edge of the bracket
y: f32               // y-position above the topmost staff line
closed_right: bool   // true = vertical closing stroke; false = open (discontinue)
```

---

## Decision 4: `RepeatNoteExpander` algorithm for first-ending skip

**Decision**: Extend `expandNotesWithRepeats` to accept an optional `VoltaBracket[]` parameter. On the second pass (`pass === 1`) through a repeat section, skip notes whose `start_tick` falls within the first-ending bracket's tick range. Compress `tickOffset` after the section by `firstEndingDuration` to keep all subsequent notes (including second-ending notes) correctly positioned.

**Rationale**: The algorithm is a minimal, targeted extension of the existing two-pass loop. It preserves the existing behavior for scores without volta brackets (`voltaBrackets === undefined` → no change). The compression step (`tickOffset += sectionDuration - firstEndingDuration`) automatically repositions second-ending notes (which are physically located in the score after the first-ending bracket) to sound immediately after the repeated pre-first-ending content, with no additional logic needed.

**Algorithm sketch** (TypeScript):
```typescript
// Inside the section loop, second pass:
const firstEnding = voltaBrackets?.find(vb =>
  vb.number === 1 &&
  vb.start_tick >= section.start_tick &&
  vb.end_tick <= section.end_tick
);
const fe_start = firstEnding?.start_tick ?? null;
const fe_end   = firstEnding?.end_tick   ?? null;
const fe_dur   = firstEnding ? (fe_end! - fe_start!) : 0;

for (const note of notes) {
  const t = note.start_tick as number;
  if (t < section.start_tick || t >= section.end_tick) continue;
  if (pass === 1 && fe_start !== null && t >= fe_start && t < fe_end!) continue; // skip
  const compression = (pass === 1 && fe_end !== null && t >= fe_end) ? fe_dur : 0;
  const offset = tickOffset + pass * sectionDuration - compression;
  expanded.push({ ...note, id: pass === 0 ? note.id : `${note.id}-r${pass}`, start_tick: t + offset });
}

// After section loop:
tickOffset += sectionDuration - fe_dur;  // fe_dur = 0 if no first ending
```

**Alternatives considered**: Filtering notes into "before first ending", "first ending", "second ending" buckets before the pass loop — rejected as more complex with no benefit. Adding a new expander function — rejected because the existing function is already tested and the change is additive with a clear default.

---

## Decision 5: Schema version bump

**Decision**: Bump `SCORE_SCHEMA_VERSION` from 6 to 7 in `backend/src/adapters/dtos.rs`.

**Rationale**: `volta_brackets` is a new field on `ScoreDto`. Using serde `#[serde(default)]` ensures pre-v7 scores deserialize successfully. The version bump documents the schema evolution point for operators and future debugging.

**Alternatives considered**: No version bump, relying solely on serde `default` — rejected because version numbers serve as a clear audit trail of data model changes.

---

## Decision 6: Test fixture strategy

**Decision**: Use the three existing repository scores as integration test fixtures (no synthetic fixtures needed for the initial test suite).

| Score | Time sig | Ticks/measure | Volta brackets |
|-------|----------|---------------|----------------|
| Burgmuller_LaCandeur.mxl | 4/4 | 3840 | 1st ending: measure 16 (idx 15), start_tick=57600, end_tick=61440, stop |
| Burgmuller_Arabesque.mxl | 2/4 | 1920 | Section 1: 1st=m10(idx9,17280–19200,stop), 2nd=m11(idx10,19200–21120,stop) |
|  |  |  | Section 2: 1st=m27(idx26,49920–51840,stop), 2nd=m28(idx27,51840–53760,discontinue) |
| Beethoven_FurElise.mxl | 3/8 | 1440 | Section 1: 1st=m9(idx8,11520–12960,stop), 2nd=m10(idx9,12960–14400,stop) |
|  |  |  | Section 2: 1st=m24(idx23,33120–34560,stop), 2nd=m25(idx24,34560–36000,discontinue) |

**Note**: Tick values computed assuming no pickup measure offset. The integration tests will assert counts and specific bracket fields; exact tick values may require adjustment once the importer is running against the real files.

---

## Decision 7: Backward compatibility mechanism

**Decision**: `VoltaBracket` field on `Score` (Rust) and `ScoreDto` uses `#[serde(default)]`; TypeScript `Score` uses `volta_brackets?: VoltaBracket[]` (optional). No migration step.

**Rationale**: Confirmed in clarification Q4. Serde `default` on `Vec<VoltaBracket>` produces an empty `Vec` when the field is absent. This matches the Feature 041 precedent for `repeat_barlines` (`pub repeat_barlines?: RepeatBarline[]` in TypeScript, optional with `?`).

---

## All NEEDS CLARIFICATION items resolved

| Item | Status |
|------|--------|
| Parser threading for `<ending>` | ✅ Decision 1 |
| `VoltaBracket` mapper accumulation strategy | ✅ Decision 2 |
| Layout rendering tree placement | ✅ Decision 3 |
| `RepeatNoteExpander` algorithm | ✅ Decision 4 |
| Schema version | ✅ Decision 5 |
| Test fixture tick values | ✅ Decision 6 |
| Backward compatibility | ✅ Decision 7 |
