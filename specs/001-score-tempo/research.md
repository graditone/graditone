# Research: Score-Defined Tempo Configuration

**Branch**: `001-score-tempo` | **Date**: 2026-03-11  
**Method**: Direct codebase investigation (no unknowns remained after reading source)

---

## R-001: Root Cause — Why 120 BPM Is Always Used

**Question**: The spec states "we are using 120 BPM for all scores." Where exactly does this happen?

**Finding**: Three compounding bugs, all in the backend MusicXML importer chain:

### Bug 1: `parse_measure()` detects `<sound>` but ignores it

`backend/src/domain/importers/musicxml/parser.rs`, around line 449:

```rust
Ok(Event::Empty(e)) => {
    if e.name().as_ref() == b"sound" {
        // Handle <sound tempo="120"/> as empty element
        // ← body is empty — no attribute extraction happens
    }
}
```

When `<sound tempo="60"/>` appears as a direct child of `<measure>` (which is the standard MusicXML location, confirmed in Chopin Nocturne and other bundled scores), the parser recognises the element but does nothing. The `tempo` attribute is silently discarded.

### Bug 2: `MusicXMLDocument.default_tempo` is never updated by the parser

`backend/src/domain/importers/musicxml/types.rs`:

```rust
pub struct MusicXMLDocument {
    pub default_tempo: f64,   // ← always stays 120.0 (the initial value)
    ...
}
impl Default for MusicXMLDocument {
    fn default() -> Self { Self { default_tempo: 120.0, ... } }
}
```

`doc.default_tempo` is initialized to 120.0 and the parser has no code path that assigns a different value to it. The existing `attributes.tempo` field on `AttributesData` (which is set when `<sound>` appears inside `<attributes>`) is also never read by the converter.

### Bug 3: Converter unconditionally converts 120.0 → BPM 120

`backend/src/domain/importers/musicxml/converter.rs`, lines 239–250:

```rust
if doc.default_tempo > 0.0 {  // always true (120.0 > 0.0)
    let bpm = BPM::new(doc.default_tempo as u16 /* = 120 */)...;
    let tempo_event = TempoEvent::new(Tick::new(0), bpm);
    score.global_structural_events.clear();
    score.add_tempo_event(tempo_event)?;
    ...
}
```

Because `doc.default_tempo` is always 120.0, every imported score always gets BPM 120 written to its `global_structural_events`.

**Decision**: Fix the chain at the earliest point — the parser — so that `<sound tempo="..."/>` at measure level is extracted and propagated into `MusicXMLDocument.default_tempo`. The converter logic is then correct with no further changes needed.

**Alternatives considered**:
- Fix in the converter only (scan `measures[0].elements` for a sound_tempo): works, but leaves a misleading dead field on `MeasureData`. Rejected.
- Fix `default_tempo` assignment in the parser directly from the first parsed `<sound>` element: cleaner, chosen approach.

---

## R-002: Where `<sound tempo="..."/>` appears in real MusicXML files

**Finding**: Confirmed from bundled scores (Chopin Nocturne Op.9 No.2):

```xml
<measure number="1">
  <attributes>...</attributes>
  <sound tempo="60"/>          ← direct child of <measure>, NOT inside <attributes>
  <direction ...>...</direction>
  <note>...</note>
</measure>
```

The `<sound>` element is a sibling of `<note>` and `<attributes>`, not a child of `<attributes>`. The existing parser code that handles `<sound>` inside `parse_attributes()` (around line 573) targets a different, non-standard location and would never fire for real-world files.

**Decision**: The fix goes into `parse_measure()` (the `Event::Empty` arm for `b"sound"`), not inside `parse_attributes()`.

---

## R-003: Frontend tempo state — what's connected, what's not

**Finding**: Two independent code paths exist for displaying the current BPM:

| Path | Location | Base BPM source | Multiplier source |
|------|----------|----------------|-------------------|
| Plugin API | `scorePlayerContext.ts` | `scoreTempo` state (set from `extractTempo(result.score)` in `loadScore()`) | `tempoState.tempoMultiplier` from `TempoStateContext` |
| ScoreViewer | `ScoreViewer.tsx` | `initialTempo` (computed inline from `score.global_structural_events`) | `tempoState.tempoMultiplier` from `TempoStateContext` |

Both compute the effective BPM correctly for display once the Score's `global_structural_events` carry the real tempo (which the backend fix will provide).

**Gap 1**: `TempoStateContext.originalTempo` starts at 120 and `setOriginalTempo()` is never called when a score loads. This means `getEffectiveTempo()` (used by some callers) returns `120 × multiplier` regardless of the score. Fix: call `setOriginalTempo(parsedTempo)` inside `loadScore()` in `scorePlayerContext.ts`, and call `setOriginalTempo(initialTempo)` in a `useEffect` in `ScoreViewer.tsx`.

**Gap 2**: `PluginScorePlayerContext` interface has `setTempoMultiplier()` but not `snapToScoreTempo()`. Fix: add `snapToScoreTempo(): void` that calls `resetTempo()` (which resets the multiplier to 1.0 while leaving `scoreTempo`/`originalTempo` intact — yielding `scoreTempo × 1.0 = composer's marked tempo`).

---

## R-004: BPM clamping — silent vs. noisy (spec FR-004)

**Finding**: `BPM::new(value)` in Rust already enforces the 20–400 range with an `Err` result outside that range. In the converter, this returns `ImportError::ValidationError`. The spec says "silently clamp" — so instead of propagating an error, the converter should clamp the parsed float to `[20, 400]` before calling `BPM::new()`.

**Decision**: In the converter, add: `let clamped = doc.default_tempo.clamp(20.0, 400.0) as u16;` before `BPM::new(clamped)`. This silently brings out-of-range tempos into the valid domain and eliminates the error path for this edge case.

---

## R-005: Snap behaviour — multiplier reset interaction (spec FR-005)

**Finding**: `TempoStateContext.resetTempo()` already does exactly what the spec requires — it sets `tempoMultiplier` to `DEFAULT_TEMPO_MULTIPLIER` (1.0) without touching `originalTempo`. After the backend fix, `originalTempo` in TempoStateContext will be kept in sync with the score's tempo via `setOriginalTempo()`. So `snapToScoreTempo()` can simply delegate to `resetTempo()`.

**No new logic needed** — just the wiring and the exported API method.

---

## R-006: Score change during playback (spec FR-006)

**Finding**: `loadScore()` in `scorePlayerContext.ts` already calls `playbackState.resetPlayback()` before updating any state:

```ts
playbackState.resetPlayback();  // ← stops transport, resets tick counter
setScore(result.score);
setScoreTempo(parsedTempo);
```

This already stops active playback when a new score is loaded. No additional work needed for this requirement.

---

## Summary of Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D-001 | Fix `parse_measure()` to extract tempo from `<sound>` at measure level | Root cause; closest to the data source |
| D-002 | Set `doc.default_tempo` directly inside the parser's measure loop | Keeps converter logic unchanged |
| D-003 | Clamp `doc.default_tempo` to [20, 400] in converter before `BPM::new()` | Spec FR-004: silent clamping; avoids error propagation |
| D-004 | Call `setOriginalTempo(parsedTempo)` in `loadScore()` | Keeps TempoStateContext in sync with actual score tempo |
| D-005 | `snapToScoreTempo()` delegates to `resetTempo()` | No new logic — reuses existing correct implementation |
| D-006 | Call `setOriginalTempo(initialTempo)` via `useEffect` on score change in `ScoreViewer.tsx` | Ensures both code paths stay consistent |
