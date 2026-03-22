# Rust Struct Contracts: Fingering Support

**File**: `backend/src/`  
**Date**: 2026-03-22

These are the exact Rust struct definitions and changes required. Use these as the authoritative source during implementation.

---

## New: `FingeringAnnotation` (shared by import + layout layers)

**Location**: `backend/src/domain/events/note.rs` (or a shared `types` module if preferred — but collocating with `Note` is simplest)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FingeringAnnotation {
    pub digit: u8,
    pub above: bool,
}
```

---

## Changed: `NoteData` in `backend/src/domain/importers/musicxml/types.rs`

Add one field:

```rust
pub struct NoteData {
    // ... existing fields unchanged ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fingering: Vec<FingeringAnnotation>,
}
```

Default value: `Vec::new()` (derived via `#[serde(default)]`)

---

## Changed: `Note` in `backend/src/domain/events/note.rs`

Add one field:

```rust
pub struct Note {
    // ... existing fields unchanged ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fingering: Vec<FingeringAnnotation>,
}
```

Add builder method following existing `with_staccato()` pattern:

```rust
impl Note {
    // ... existing builder methods unchanged ...

    pub fn with_fingering(mut self, fingering: Vec<FingeringAnnotation>) -> Self {
        self.fingering = fingering;
        self
    }
}
```

---

## Changed: `NoteEvent` in `backend/src/layout/extraction.rs`

Add one field:

```rust
pub(crate) struct NoteEvent {
    // ... existing fields unchanged ...
    pub(crate) fingering: Vec<FingeringAnnotation>,
}
```

JSON deserialization (in the `NoteEvent` constructor from JSON):

```rust
fingering: note_item["fingering"]
    .as_array()
    .map(|arr| {
        arr.iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect()
    })
    .unwrap_or_default(),
```

---

## New: `FingeringGlyph` in `backend/src/layout/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingeringGlyph {
    #[serde(serialize_with = "round_f32")]
    pub x: f32,
    #[serde(serialize_with = "round_f32")]
    pub y: f32,
    pub digit: u8,
    pub above: bool,
}
```

---

## Changed: `Staff` in `backend/src/layout/types.rs`

Add one field:

```rust
pub struct Staff {
    // ... existing fields unchanged ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fingering_glyphs: Vec<FingeringGlyph>,
}
```

---

## Changed: `AnnotationResult` in `backend/src/layout/annotations.rs`

Add one field:

```rust
pub(crate) struct AnnotationResult {
    pub ledger_lines: Vec<LedgerLine>,
    pub notation_dots: Vec<types::NotationDot>,
    pub tie_arcs: Vec<types::TieArc>,
    pub slur_arcs: Vec<types::TieArc>,
    pub fingering_glyphs: Vec<types::FingeringGlyph>,  // NEW
}
```

---

## New: `parse_technical` in `backend/src/domain/importers/musicxml/parser.rs`

```rust
fn parse_technical<B: BufRead>(
    reader: &mut Reader<B>,
    note: &mut NoteData,
) -> Result<(), ImportError> {
    // Read events until </technical>
    // For each <fingering> element:
    //   - read placement attribute (Option<bool>)
    //   - read text content → parse as u8 (discard if fails)
    //   - derive `above` from placement attr OR staff number
    //   - push FingeringAnnotation { digit, above } to note.fingering
}
```

Called from `parse_notations` in the new arm:

```rust
b"technical" => {
    parse_technical(reader, note)?;
}
```

---

## Changed: `mod.rs` Staff construction in `backend/src/layout/mod.rs`

```rust
let staff = Staff {
    staff_lines,
    glyph_runs,
    structural_glyphs,
    bar_lines,
    ledger_lines: ann.ledger_lines,
    notation_dots: ann.notation_dots,
    tie_arcs: ann.tie_arcs,
    slur_arcs: ann.slur_arcs,
    fingering_glyphs: ann.fingering_glyphs,  // NEW
};
```

---

## Invariants

- `FingeringAnnotation.digit` is always `> 0` (non-numeric or zero text is discarded at parse time)
- `Staff.fingering_glyphs` is always empty for scores with no `<fingering>` elements (JSON field omitted → no regression for existing scores)
- `FingeringGlyph.y` is always outside the five staff lines (either above the top line or below the bottom line)
