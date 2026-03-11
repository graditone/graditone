# Data Model: Score-Defined Tempo Configuration

**Branch**: `001-score-tempo` | **Date**: 2026-03-11

This feature introduces no new entities. All existing domain models remain structurally unchanged. The changes are:
1. A new intermediate field in the MusicXML importer's internal data structure.
2. A new method on the frontend plugin API contract.
3. A sync point between `scorePlayerContext` and `TempoStateContext`.

---

## Existing Domain Entities (relevant subset)

### `Score` (aggregate root — unchanged)

```
Score
├── id: ScoreId
├── global_structural_events: Vec<GlobalStructuralEvent>   ← tempo lives here
│   ├── Tempo(TempoEvent { tick: Tick, bpm: BPM })         ← BPM at tick 0 = score tempo
│   └── TimeSignature(TimeSignatureEvent { tick, numerator, denominator })
├── instruments: Vec<Instrument>
├── repeat_barlines: Vec<RepeatBarline>
└── pickup_ticks: u32
```

**BPM value object** (validated, 20–400):

```
BPM(u16)
├── new(value: u16) → Result<BPM, &str>   ← rejects < 20 or > 400
└── value() → u16
```

No changes to `Score` or `BPM` — they are already correct once the importer fills them properly.

---

## Changed: MusicXML Importer Intermediate Type

### `MusicXMLDocument` (importer-internal, NOT a domain entity)

**Before**:
```
MusicXMLDocument {
    default_tempo: f64 = 120.0   ← never updated by parser; always 120
    parts: Vec<PartData>
    ...
}
```

**After** — the parser now writes the parsed tempo into `default_tempo` as soon as it encounters the first `<sound tempo="..."/>` element in any measure. No struct field additions needed; the existing field is simply populated correctly.

### `MeasureData` (importer-internal)

No structural changes. The parser's `parse_measure()` reads the `<sound>` tempo directly and assigns it to `doc.default_tempo` (via a mutable reference passed into the measure parser, or by returning it as part of the measure result — see contracts for the chosen approach).

---

## Frontend State Model

### `TempoStateContext` state (unchanged interface, new wiring)

```
TempoState {
    tempoMultiplier: number   -- user-adjustable, 0.5–2.0, default 1.0
    originalTempo: number     -- NOW: set from score on load; was: always 120
}
```

`originalTempo` is the score's marked BPM. After this feature, it is kept in sync whenever a score is loaded. `getEffectiveTempo()` returns `originalTempo × tempoMultiplier` and is now meaningful.

### `ScorePlayerState` (plugin-facing, unchanged structure)

```
ScorePlayerState {
    bpm: number    -- = scoreTempo × tempoMultiplier (already correct; unchanged)
    ...
}
```

No change to the shape of `ScorePlayerState`. The `bpm` field was already computed correctly from `scoreTempo × tempoMultiplier`; once the backend fix ensures `scoreTempo` reflects the real marked tempo, `bpm` will be correct automatically.

---

## State Transitions

### Score Load

```
loadScore(source)
  ╠═ parse MusicXML → Score (with real tempo in global_structural_events)
  ╠═ extractTempo(score) → parsedTempo   [e.g. 60 for Chopin Nocturne]
  ╠═ setScoreTempo(parsedTempo)          [drives usePlayback]
  ╠═ setOriginalTempo(parsedTempo)       [NEW: syncs TempoStateContext]
  ╚═ UI shows parsedTempo × multiplier
```

### Snap-to-Score Tempo

```
snapToScoreTempo()
  ╠═ resetTempo()                        [sets tempoMultiplier → 1.0]
  ╚═ effectiveBpm = scoreTempo × 1.0 = scoreTempo   [composer's marked tempo]
```

### Score Switch During Playback

```
loadScore(newSource)   [while playing]
  ╠═ resetPlayback()   [stops transport — already implemented]
  ╠═ setScoreTempo(newTempo)
  ╠═ setOriginalTempo(newTempo)
  ╚═ ready to play new score at its tempo
```

---

## Validation Rules

| Rule | Layer | Where enforced |
|------|-------|---------------|
| BPM must be 20–400 | Domain | `BPM::new()` in Rust |
| Out-of-range tempo clamped silently | Importer | Converter: `doc.default_tempo.clamp(20.0, 400.0)` before `BPM::new()` |
| Multiplier must be 0.5–2.0 | Frontend | `clampTempoMultiplier()` in `tempoCalculations.ts` |
| Score must have a Tempo event at tick 0 | Domain | `Score::new()` always creates one at 120; importer replaces it |
