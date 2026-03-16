# Quickstart: Tied Notes Support

**Feature**: `051-tied-notes`  
**Date**: 2026-03-16

A developer guide for implementing tied notes support end-to-end.

---

## Implementation Order

The feature must be implemented layer-by-layer from backend to frontend. Each layer has a failing test written first (Constitution V — Test-First).

```
1. Domain model update   (note.rs, types.rs)
2. MusicXML parser       (parser.rs)
3. Domain converter      (converter.rs)
4. Layout engine         (types.rs, layout/mod.rs)
5. Frontend renderer     (NotationRenderer.tsx)
6. Playback scheduler    (TieResolver.ts, PlaybackScheduler.ts)
7. Practice extraction   (scorePlayerContext.ts or practiceEngine.ts)
```

---

## Step 1: Domain Model

**Files**: `backend/src/domain/events/note.rs`, `backend/src/domain/importers/musicxml/types.rs`

Add to `note.rs`:
```rust
// New enum
pub enum TieType { Start, Continue, Stop }

// New fields on Note struct
pub tie_next: Option<NoteId>,       // forward link to continuation note
pub is_tie_continuation: bool,      // true = no new attack in playback/practice
```

Add to `types.rs`:
```rust
// New enum
pub enum TiePlacement { Above, Below }

// New fields on NoteData struct
pub tie_type: Option<TieType>,
pub tie_placement: Option<TiePlacement>,
```

**Write test first** in `backend/tests/integration/test_tied_notes.rs`:
```rust
#[test]
fn test_note_tie_fields_default_false() {
    let note = Note::new(/* ... */);
    assert!(note.tie_next.is_none());
    assert!(!note.is_tie_continuation);
}
```

---

## Step 2: MusicXML Parser

**File**: `backend/src/domain/importers/musicxml/parser.rs`

In `parse_note()`, add handler for `b"tie"`:
```rust
b"tie" => {
    let tie_type = e.try_get_attribute(b"type")?
        .and_then(|attr| match attr.value.as_ref() {
            b"start"    => Some(TieType::Start),
            b"continue" => Some(TieType::Continue),
            b"stop"     => Some(TieType::Stop),
            _ => None,
        });
    if let Some(tt) = tie_type {
        note.tie_type = Some(tt);
    }
}
```

In `parse_notations()`, add handler for `b"tied"`:
```rust
b"tied" => {
    let placement = e.try_get_attribute(b"placement")?
        .and_then(|attr| match attr.value.as_ref() {
            b"above" => Some(TiePlacement::Above),
            b"below" => Some(TiePlacement::Below),
            _ => None,
        });
    note.tie_placement = placement;
}
```

**Write test first**: Parse `tests/fixtures/musicxml/tied_notes_basic.musicxml` → assert `NoteData.tie_type == Some(TieType::Start)` on first note, `Some(TieType::Stop)` on second.

**Fixture to create**: `tests/fixtures/musicxml/tied_notes_basic.musicxml` — 4 measures, 3 tie cases:
1. Single tie within a measure (C4 half note tied to C4 quarter note)
2. Tie crossing a barline (G4 quarter note in m.2 beat 4 tied to G4 in m.3 beat 1)
3. Three-note tie chain (E4 quarter → E4 quarter → E4 half)

---

## Step 3: Domain Converter (Tie Chain Resolution)

**File**: `backend/src/domain/importers/musicxml/converter.rs`

After all `NoteData` items are converted to domain `Note` objects, run a post-pass:

```rust
fn resolve_tie_chains(notes: &mut Vec<Note>) {
    // Sort by start_tick within each voice/staff/pitch group
    // For each NoteData with tie_type = Start or Continue:
    //   Find the next NoteData with same pitch, adjacent tick, tie_type = Stop or Continue
    //   Set note.tie_next = Some(next.id)
    //   Set next.is_tie_continuation = true
    // Log a warning if the paired note cannot be found (corrupt tie)
}
```

**Write test first**: Convert `tied_notes_basic.musicxml` → assert `Note[0].tie_next == Some(Note[1].id)` and `Note[1].is_tie_continuation == true`.

---

## Step 4: Layout Engine — Arc Geometry

**Files**: `backend/src/layout/types.rs`, `backend/src/layout/mod.rs` (or new `tie_layout.rs`)

Add to `types.rs`:
```rust
pub struct TieArc {
    pub start: Point, pub end: Point,
    pub cp1: Point,   pub cp2: Point,
    pub above: bool,
    pub note_id_start: NoteId,
    pub note_id_end: NoteId,
}

// Add to Staff:
pub tie_arcs: Vec<TieArc>,
```

Add to layout computation:
```rust
fn compute_tie_arcs(notes: &[LayoutNote], staff: &mut Staff) {
    for note in notes.iter().filter(|n| n.tie_next.is_some()) {
        if let Some(cont) = notes.iter().find(|n| Some(n.id) == note.tie_next) {
            let start = Point { x: note.bbox.right(), y: note.bbox.center_y() };
            let end   = Point { x: cont.bbox.left(),  y: cont.bbox.center_y() };
            let above = note.stem_direction == StemDirection::Down;
            let direction = if above { -1.0 } else { 1.0 };
            let span_x = end.x - start.x;
            let arc_height = (span_x * 0.15).clamp(4.0, 30.0);
            staff.tie_arcs.push(TieArc {
                start, end,
                cp1: Point { x: start.x + span_x * 0.33, y: start.y + direction * arc_height },
                cp2: Point { x: start.x + span_x * 0.67, y: end.y   + direction * arc_height },
                above,
                note_id_start: note.id.clone(),
                note_id_end:   cont.id.clone(),
            });
        }
    }
}
```

**Write test first**: Layout `tied_notes_basic.musicxml` → assert `staff.tie_arcs.len() == 3`, arc `above` field matches expected stem direction.

---

## Step 5: Frontend Renderer

**File**: `frontend/src/components/notation/NotationRenderer.tsx`

In the SVG render, after `layout.notes.map(...)`, add:
```tsx
{staff.tieArcs?.map((arc) => (
  <path
    key={`tie-${arc.noteIdStart}-${arc.noteIdEnd}`}
    d={`M ${arc.start.x},${arc.start.y} C ${arc.cp1.x},${arc.cp1.y} ${arc.cp2.x},${arc.cp2.y} ${arc.end.x},${arc.end.y}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="tie-arc"
  />
))}
```

**Write test first** (`NotationRenderer.test.tsx`): Render with a mock `staff` containing one `tieArc` → snapshot includes a `<path>` with `className="tie-arc"`.

---

## Step 6: Playback Tie Resolver

**New file**: `frontend/src/services/playback/TieResolver.ts`

```typescript
export function resolveTiedNotes(notes: Note[]): ResolvedNote[] {
  const byId = new Map(notes.map(n => [n.id, n]));
  return notes
    .filter(n => !n.isTieContinuation)
    .map(n => {
      let totalDuration = n.durationTicks;
      let cur: Note = n;
      while (cur.tieNext) {
        const next = byId.get(cur.tieNext);
        if (!next) break;
        totalDuration += next.durationTicks;
        cur = next;
      }
      return { note: n, combinedDurationTicks: totalDuration };
    });
}
```

In `PlaybackScheduler.ts`, apply `resolveTiedNotes()` before scheduling.

**Write test first** (`TieResolver.test.ts`): two tied quarter notes → one resolved note with `combinedDurationTicks = 480` (2 × 240).

---

## Step 7: Practice Mode Filter

**File**: `frontend/src/plugin-api/scorePlayerContext.ts` (or `practiceEngine.ts`)

Locate the note extraction function and add a filter:
```typescript
const practiceNotes = allNotes
  .filter(note => !note.isTieContinuation)   // Skip continuation notes
  .map(note => toPracticeNoteEntry(note));
```

**Write test first**: Practice note list for a score with one tie chain (3 notes) → assert the sequence has 1 entry, not 3.

---

## Verification

After all steps are implemented:

```bash
# Backend unit + integration tests
cd backend && cargo test

# Frontend unit tests
cd frontend && npm run test

# E2E test (requires running app)
cd frontend && npx playwright test e2e/tied-notes.spec.ts
```

Expected results:
- `cargo test` passes all new tied-notes tests
- `vitest` passes `TieResolver.test.ts` and `NotationRenderer.test.tsx`
- Playwright: `.tie-arc` elements visible in Chopin score SVG

---

## Test Fixtures to Create

| Fixture | Location | Purpose |
|---------|----------|---------|
| `tied_notes_basic.musicxml` | `tests/fixtures/musicxml/` | 3 tie cases: within measure, across barline, 3-note chain |
| `tied_notes_chord.musicxml` | `tests/fixtures/musicxml/` | Chord with partial ties on specific pitches |
