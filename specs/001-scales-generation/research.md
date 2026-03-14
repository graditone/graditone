# Research: Scales Generation

**Phase**: 0 | **Date**: 2026-03-14 | **Feature**: [spec.md](spec.md)

---

## 1. MusicXML `.mxl` File Format

**Decision**: Generate compressed `.mxl` files using Python's `zipfile` stdlib — no external dependencies.

**Rationale**: `.mxl` is a ZIP archive containing two entries:
- `META-INF/container.xml` — declares root file path
- `score.xml` — the MusicXML document (`<score-partwise version="4.0">`)

**Evidence from existing files** (`Bach_InventionNo1.mxl`):
```
namelist → ['META-INF/container.xml', 'score.xml']
root tag → score-partwise
root attrib → {'version': '4.0'}
```

**Alternatives considered**: Using the `music21` library (heavyweight, requires installation) or generating uncompressed `.xml` files (not `.mxl`, would break the existing import pipeline). Both rejected in favour of stdlib zip + handcrafted MusicXML.

---

## 2. MusicXML Scale Structure (4/4, Quarter Notes)

**Decision**: Each scale file uses `<divisions>1</divisions>` (1 division per quarter note), 4/4 time, single treble clef, one instrument part. 4 bars total: 2 ascending (root → octave), 2 descending (octave → root).

**Rationale**: Confirmed from existing score structure. `<divisions>` specifies how many MIDI ticks equal a quarter note. Using 1 keeps output minimal and unambiguous for quarter notes (`<duration>1</duration>`).

**MusicXML attributes block for first measure** (confirmed from Bach file—same structure):
```xml
<attributes>
  <divisions>1</divisions>
  <key><fifths>N</fifths><mode>major|minor</mode></key>
  <time><beats>4</beats><beat-type>4</beat-type></time>
  <clef><sign>G</sign><line>2</line></clef>
</attributes>
```

**Alternatives considered**: Using 8 divisions (as Bach file uses) — rejected, unnecessary complexity for pure quarter notes. Using bass clef or grand staff — rejected, scales are single-line exercises.

---

## 3. Key Signatures (Circle of Fifths `<fifths>` values)

**Decision**: Use circle-of-fifths `<fifths>` values for both major and minor. For natural minor scales, the key signature is the relative major's `<fifths>` value (same accidentals), plus `<mode>minor</mode>`.

**Circle of fifths order and fifths values**:

| Root | Major fifths | Minor fifths | Minor root (relative) |
|---|---|---|---|
| C | 0 | 0 (A minor) | A |
| G | 1 | 1 (E minor) | E |
| D | 2 | 2 (B minor) | B |
| A | 3 | 3 (F# minor) | F# |
| E | 4 | 4 (C# minor) | C# |
| B | 5 | 5 (G# minor) | G# |
| F# | 6 | 6 (D# minor) | D# |
| D♭ | -5 | -5 (B♭ minor) | B♭ |
| A♭ | -4 | -4 (F minor) | F |
| E♭ | -3 | -3 (C minor) | C |
| B♭ | -2 | -2 (G minor) | G |
| F | -1 | -1 (D minor) | D |

**Note on minor scale display ordering**: The spec requires ordering by circle of fifths of the *root note* (same 12 roots as major: C, G, D, A, E, B, F#, D♭, A♭, E♭, B♭, F). For minor scales the roots in circle-of-fifths order are: C minor, G minor, D minor, A minor, E minor, B minor, F# minor, C# minor, G# minor, D# minor, B♭ minor, F minor.

**Rationale**: This is the standard musicology convention and matches how music theory textbooks (e.g., Berklee, ABRSM) present key signatures. Using parallel minor ordering (same root letter as major) is friendlier for practice comparison.

---

## 4. Scale Pitch Sequences (MIDI note numbers)

**Decision**: Compute ascending scale notes from the root MIDI note using the interval pattern for the scale type, then reverse for descending.

**Major intervals** (semitones from root): [0, 2, 4, 5, 7, 9, 11, 12]  
**Natural minor intervals** (semitones from root): [0, 2, 3, 5, 7, 8, 10, 12]

**MusicXML pitch encoding** — pitch is specified as step + octave + optional alter:
- Middle C = C4 = MIDI 60
- `<step>C</step><octave>4</octave>` → no alter needed
- `<step>F</step><octave>4</octave><alter>1</alter>` → F#4
- `<step>B</step><octave>3</octave><alter>-1</alter>` → B♭3

**Enharmonic spelling**: Use conventional spelling per key (e.g., F# major uses E#, not F; B major uses A#, not B♭). The generator will use a chromatic-to-step lookup table that takes the `<fifths>` value as input to determine correct enharmonic spelling.

**Alternatives considered**: MIDI-number-only approach with chromatic step names — rejected because MusicXML renderers (and the app's WASM parser) resolve pitch from step+octave+alter, and wrong enharmonic spelling produces incorrect key signatures in notation.

---

## 5. Filename Convention

**Decision**: `{Root}_{type}_oct{N}.mxl` where Root uses uppercase with `b` for flats and `s` for sharps:
- `C_major_oct4.mxl`, `Gb_major_oct4.mxl`, `Cs_minor_oct5.mxl`

**Rationale**: No special characters in filenames; machine-parseable; consistent with existing score filenames (PascalCase already used, but underscore-separated is clearer for programmatic generation). The `scores/` symlink serves these as static assets at `{BASE_URL}scores/scales/{filename}`.

---

## 6. Frontend: Collapsible Group via `<details>/<summary>`

**Decision**: Use native HTML `<details>/<summary>` elements for the collapsible group — no JavaScript toggle state needed.

**Rationale**: 
- Native HTML `<details>` is supported in all PWA target browsers (Chrome 57+, Safari 11+, Edge 16+)
- Zero JavaScript toggle state; accessible by default (keyboard-navigable, announces to screen readers)
- `open` attribute on `<details>` can be controlled declaratively; collapsed by default (no `open` attribute)
- Consistent with progressive enhancement principles

**Alternatives considered**: React `useState` boolean toggle — rejected, adds unnecessary state for functionality that HTML handles natively. CSS-only `:focus-within` trick — rejected, not reliably accessible.

---

## 7. Catalog Data Structure

**Decision**: Introduce a `ScoreGroup` interface and a `PRELOADED_CATALOG` export that contains both ungrouped top-level scores and grouped scores. `PRELOADED_SCORES` is preserved for backward compatibility.

**Rationale**: The existing `LoadScoreDialog` and tests reference `PRELOADED_SCORES` directly. Introducing a new `PRELOADED_CATALOG` object alongside allows incremental adoption without breaking changes. `SCALE_SCORE_GROUPS` is exported separately so the generator script output is decoupled from the catalog assembly.

---

## 8. Scale File Symlink / Static Asset Path

**Decision**: No changes needed to the Vite static copy plugin or symlink configuration. The `frontend/public/scores` symlink already resolves to `../../scores`, so `scores/scales/` is automatically served at `{BASE_URL}scores/scales/`.

**Evidence**: 
```json
// frontend/package.json dependencies include:
"vite-plugin-static-copy": "^3.2.0"
```
Existing scores at `{BASE_URL}scores/Bach_InventionNo1.mxl` confirm the symlink works end-to-end. Adding the `scales/` subfolder requires no configuration change.

---

## Summary: All Unknowns Resolved

| Unknown | Decision |
|---|---|
| `.mxl` format | ZIP with META-INF + score.xml; Python stdlib |
| Note duration / time sig | Quarter notes, 4/4, divisions=1 |
| Key signature encoding | `<fifths>N</fifths><mode>m</mode>` per circle of fifths |
| Enharmonic spelling | Conventional spelling derived from fifths value |
| Filename convention | `{Root}_{type}_oct{N}.mxl` |
| Collapsible UI | Native `<details>/<summary>` HTML element |
| Catalog structure | `ScoreGroup` + `PRELOADED_CATALOG` alongside existing `PRELOADED_SCORES` |
| Static asset path | No Vite/symlink config change needed |
