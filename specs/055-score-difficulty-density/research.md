# Research: Score Difficulty Rate for Note Density

**Branch**: `055-score-difficulty-density` | **Date**: 2026-03-25  
**Status**: Complete — all NEEDS CLARIFICATION resolved

## Decision Log

### D-001: Where to compute difficulty — Rust domain vs. TypeScript

**Decision**: Compute in Rust domain (`backend/src/domain/difficulty/`)  
**Rationale**: Constitution Principle II (Hexagonal Architecture) requires domain logic to live in the core domain, independent of UI. Constitution Principle VI prohibits coordinate/spatial calculations in frontend — while density isn't spatial, the same rationale applies to all non-trivial domain logic. Rust is unit-testable in isolation without browser. The result is embedded in `ScoreDto` and flows through the existing WASM boundary.  
**Alternatives considered**: TypeScript-side computation post-parse was rejected because it violates hexagonal boundaries and cannot be unit-tested without WASM.

---

### D-002: Integration point — inside `parse_musicxml` vs. separate WASM function

**Decision**: Compute difficulty inside the existing `parse_musicxml` pipeline; persist result in `ScoreDto`  
**Rationale**: FR-009 requires synchronous computation before the score entry appears in the dialog. Embedding computation in the parse pipeline satisfies this naturally — one WASM call, one result. A separate WASM function would require a second call after caching, complicating the load pipeline and potentially introducing a race condition.  
**Alternatives considered**: A standalone `compute_difficulty(score_js: JsValue) -> JsValue` WASM binding was considered for separation of concerns, but rejected because it requires the frontend to call it explicitly, making "synchronous before dialog" harder to guarantee.

---

### D-003: Schema versioning — bump from v9 to v10

**Decision**: Bump `SCORE_SCHEMA_VERSION` from 9 to 10; add `difficulty_rating: Option<DifficultyRatingDto>` to `ScoreDto`  
**Rationale**: The existing stale-schema pipeline (frontend calls `get_schema_version()`, compares with cached `schema_version`, re-parses if stale) will automatically recompute difficulty for all previously cached scores on the next load — consistent with FR-004 (recompute on content change). Using `Option` ensures old cached `ScoreDto` values without the field deserialize safely via serde defaults.  
**Alternatives considered**: Storing difficulty in a separate `localStorage` key independently of the score cache was rejected because it requires a separate invalidation mechanism and loses the schema-version stale detection that already exists.

---

### D-004: Measure boundary access pattern

**Decision**: Use `score.measure_end_ticks` (existing field) with `actual_start()` / `actual_end()` from `backend/src/layout/extraction.rs` to compute per-measure tick ranges  
**Rationale**: These functions already handle the anacrusis (`pickup_ticks`) and shortened-measure edge cases correctly. The difficulty domain module should use the same validated logic rather than re-implementing measure boundary arithmetic.  
**Implementation note**: `actual_start(measure_index, &measure_end_ticks, pickup_ticks, ticks_per_measure)` and `actual_end(...)` are `pub(crate)` — the difficulty module must live in the same crate (`backend/`) to access them, which it does.  
**Alternatives considered**: Re-computing measure boundaries from time signatures only was rejected because it would fail for pickup measures and tempo-change-shortened measures.

---

### D-005: Tempo-independent density formula (notes per beat)

**Decision**: Use `bar_density = pitches_in_bar / bar_duration_beats`, where `bar_duration_beats = bar_duration_ticks / PPQ` (PPQ = 960). Density is tempo-independent — it measures note activity per beat, not per second.
**Rationale**: The original notes-per-second formula penalized slow tempos: a piece like Chopin's Nocturne (60 BPM) had its density cut in half compared to the same notes at 120 BPM. Since the difficulty of playing dense note passages is independent of tempo (your fingers must still move the same way), notes-per-beat is the correct unit.
**Evolution**: Originally `(ticks × 60.0) / (960.0 × bpm)` for seconds-based density. Changed to `ticks / 960.0` for beats-based density. `DEFAULT_BPM` constant removed as no longer needed.
**Implementation note**: `bar_duration_beats` is `f64`. Density is `f64` throughout — only the final level mapping rounds to a discrete integer.

---

### D-006: Note counting — which notes count

**Decision**: Count every `Note` in `instrument.staves[*].voices[*].interval_events` for the measure's tick range, **excluding** notes where `is_tie_continuation == true`  
**Rationale**: Per clarification Q1, each pitch counts separately (a 4-note chord = 4 pitches), and per the spec, tied note continuations are excluded. The `Note.is_tie_continuation: bool` field exists on the existing `Note` struct. Grace notes (`is_grace: bool`) should also be excluded as they have no meaningful duration contribution to bar density.  
**Alternatives considered**: Counting all `interval_events` including continuations would inflate density for legato/tied passages and misrepresent actual playing challenge.

---

### D-007: Multi-instrument aggregation

**Decision**: Compute density rate independently per `Instrument`; final score rating = max level across all instruments  
**Rationale**: Per clarification Q4. An instrument is the natural unit of a performer's workload. The max-across-instruments rule correctly identifies the hardest-playing-part difficulty. In Rust, iterate `score.instruments` and compute per-instrument density; take the max `DifficultyLevel` at the end.

---

### D-007a: Per-staff maximum (hardest single hand)

**Decision**: For both note counting and polyphony sampling, use per-staff maximum instead of summing across staves.
**Rationale**: A piano score has typically 2 staves (treble/bass, RH/LH). Summing both hands inflates the metric beyond what any single hand experiences. The difficulty of a passage is better captured by the hardest single hand. This change was essential for calibration — with sum-across-staves, all reference scores mapped to Hard.

---

### D-008: Frontend display — new DifficultyTag component vs. inline

**Decision**: New `DifficultyTag.tsx` React component; consumed by both `PreloadedScoreList.tsx` and `UserScoreList.tsx`  
**Rationale**: Both score lists need the same badge. A shared component avoids duplication, enables isolated Vitest unit testing of the tag rendering, and allows styling to be managed in one place.  
**Implementation note**: `DifficultyTag` receives a `level: 1 | 2 | 3 | null` prop. `null` renders nothing (no tag). Labels: 1 → "Easy", 2 → "Medium", 3 → "Hard". This maps directly from the TypeScript `DifficultyRating.level` field added to the `Score` interface.

---

### D-009: Polyphony as a difficulty factor

**Decision**: Add polyphony (simultaneous notes) as a secondary difficulty factor alongside note density, combined as `final_score = 0.6 × note_density + 0.4 × polyphony`.
**Rationale**: Note density alone (notes per beat) captures how many notes are played but not whether they overlap in time. A passage with 4 notes struck simultaneously (chord) is harder than 4 sequential notes at the same density. Polyphony captures this chordal complexity. The 60/40 weighting ensures density remains the primary driver while polyphony provides meaningful differentiation for chordal pieces.
**Implementation**: `polyphony(t)` = count of notes sounding at time `t`. Sampled at each note onset tick within each bar. Per-staff maximum (hardest single hand), matching the density approach. Aggregated as `0.7 × avg_polyphony + 0.3 × max_polyphony`.

---

### D-010: Threshold calibration (2.5 / 3.5)

**Decision**: Set difficulty thresholds at < 2.5 (Easy), 2.5–3.5 (Medium), > 3.5 (Hard).
**Rationale**: Calibrated against 6 reference piano scores. Result: Pachelbel (2.31) and La Candeur (1.79) are Easy, Arabesque (2.68) and Bach Invention (2.69) are Medium, Fur Elise (3.66) and Nocturne (4.04) are Hard. This matches human-perceived difficulty for 5/6 scores; La Candeur (Easy instead of desired Medium) is accepted as its density and polyphony are genuinely the lowest.

---

## Key API Surface Discovered

### Existing Rust helpers to use

```rust
// backend/src/domain/score.rs
score.get_tempo_at(tick: Tick) -> Option<&TempoEvent>   // TempoEvent.bpm.value() -> u16
score.get_time_signature_at(tick: Tick) -> Option<&TimeSignatureEvent>  // .numerator, .denominator

// backend/src/layout/extraction.rs (pub(crate))
actual_start(measure_index, &measure_end_ticks, pickup_ticks, ticks_per_measure) -> u32
actual_end(measure_index, &measure_end_ticks, pickup_ticks, ticks_per_measure) -> u32
```

### Score iteration for note counting

```
score.instruments[i]
  .staves[j]
  .voices[k]
  .interval_events[l]   // Note: { start_tick, duration_ticks, is_tie_continuation, is_grace, ... }
```

### Formula reference

```
bar_duration_beats = bar_duration_ticks / 960.0   (tempo-independent)
bar_density        = count_pitches_in_bar(bar) / bar_duration_beats  (per-staff max)

// polyphony: sample at each note onset tick in bar (per-staff max)
bar_polyphony_avg  = mean(polyphony at each onset tick)
bar_polyphony_max  = max(polyphony at each onset tick)

// per instrument:
note_density       = 0.7 × avg(bar_densities) + 0.3 × max(bar_densities)
polyphony_score    = 0.7 × avg(bar_polyphony_avgs) + 0.3 × max(bar_polyphony_maxes)
combined           = 0.6 × note_density + 0.4 × polyphony_score

// score level:
DifficultyLevel    = score.instruments.map(instrument_combined).max()
                     mapped via: < 2.5 → Easy(1), 2.5..=3.5 → Medium(2), > 3.5 → Hard(3)
```

### Schema change

- `SCORE_SCHEMA_VERSION`: 9 → 10
- New field in `ScoreDto`: `difficulty_rating: Option<DifficultyRatingDto>`
- `DifficultyRatingDto`: `{ density_rate: f64, level: u8 }` (level: 1/2/3)
- New field in TypeScript `Score`: `difficulty_rating?: { density_rate: number; level: 1 | 2 | 3 }`

## Unknowns at Research Start → Resolution Status

| Unknown | Resolved? | Resolution |
|---------|-----------|------------|
| Where in the codebase to compute difficulty | ✅ | Rust domain, inside parse pipeline |
| How measure boundaries are accessed | ✅ | `actual_start`/`actual_end` from extraction.rs |
| How BPM is queried per tick | ✅ | `score.get_tempo_at()` exists in domain/score.rs |
| Does `difficulty_rating` field exist? | ✅ | No — new field required |
| Current schema version | ✅ | v9; bump to v10 |
| How stale-cache detection works | ✅ | `get_schema_version()` WASM fn + `ScoreDto.schema_version` comparison |
| Existing ticks-to-seconds helper | ✅ | None — use formula directly |
| Which notes to exclude | ✅ | Exclude `is_tie_continuation` and `is_grace` |
| `WasmImportResult` extensibility | ✅ | `ScoreDto` carries rating; WasmImportResult.score is ScoreDto |

---

## Reference Score Calibration

**Date**: 2026-03-25 | **Last Updated**: Calibration round 3 (polyphony + notes-per-beat)

### Formula Evolution

1. **v1** (notes/second, sum across staves): All scores Hard (5.5–16.4 notes/s). Rejected.
2. **v2** (notes/second, per-staff max): Improved but Nocturne too low due to slow tempo.
3. **v3** (notes/beat, per-staff max, tempo-independent): Nocturne corrected (5.27 → Hard). La Candeur/Pachelbel both Easy, acceptable.
4. **v4** (combined: 0.6 × density + 0.4 × polyphony): Current. Polyphony rewards pieces with chordal complexity.

### Current Formula

```
bar_density     = pitches_in_bar / bar_duration_beats   (per-staff max)
note_density    = 0.7 × avg(bar_density) + 0.3 × peak(bar_density)
bar_polyphony   = simultaneous notes at each onset tick  (per-staff max)
polyphony_score = 0.7 × avg_polyphony + 0.3 × max_polyphony
combined_score  = 0.6 × note_density + 0.4 × polyphony_score
```

Thresholds: < 2.5 → Easy, 2.5–3.5 → Medium, > 3.5 → Hard

### Calibration Results (v4 — combined formula)

| Score | Combined Score | Level | Target |
|-------|---------------|-------|--------|
| Burgmüller — La Candeur | 1.79 | Easy | Medium* |
| Pachelbel — Canon in D | 2.31 | Easy | Easy ✓ |
| Burgmüller — Arabesque | 2.68 | Medium | Medium ✓ |
| Bach — Invention No. 1 | 2.69 | Medium | Medium ✓ |
| Beethoven — Für Elise | 3.66 | Hard | Hard ✓ |
| Chopin — Nocturne Op.9 No.2 | 4.04 | Hard | Hard ✓ |

*La Candeur (1.79) maps to Easy rather than the desired Medium. This is acceptable because La Candeur genuinely has the lowest note density and polyphony among all reference scores. Forcing it to Medium would require lowering the Easy/Medium threshold below 1.8, which would make the Easy range too narrow to be useful.

**Result**: 5/6 scores match their target level. La Candeur deviation accepted as justified.

### Historical Calibration Data

#### v1: Notes/second, sum across staves (original)

| Score | density_rate | Level |
|-------|-------------|-------|
| Bach — Invention No. 1 | 11.5182 | Hard |
| Beethoven — Für Elise | 16.4082 | Hard |
| Burgmüller — Arabesque | 10.2333 | Hard |
| Burgmüller — La Candeur | 6.6741 | Hard |
| Chopin — Nocturne Op.9 No.2 | 6.4588 | Hard |
| Pachelbel — Canon in D | 5.5444 | Hard |
