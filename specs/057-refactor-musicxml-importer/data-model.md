# Data Model: Refactor MusicXML Importer

**Feature**: 057-refactor-musicxml-importer  
**Date**: 2025-03-25

## Overview

This refactor introduces no new data types or entities. The "data model" for this feature is the **module structure** — the reorganization of existing code into focused sub-modules. All existing types, traits, and their relationships are preserved unchanged.

## Module Structure: Before and After

### Before (current)

```
backend/src/domain/importers/musicxml/
├── mod.rs              (~350 lines)  ImportContext, MusicXMLImporter, re-exports
├── parser.rs           (~1,395 lines) ALL parsing logic in one file
├── converter.rs        (~1,645 lines) ALL conversion logic in one file
├── types.rs            (~400 lines)  Intermediate data types
├── errors.rs           (~150 lines)  Error types & warnings
├── compression.rs      (~150 lines)  .mxl ZIP handling
├── mapper.rs           (~150 lines)  Value mapping
└── timing.rs           (~200 lines)  Fraction math
```

### After (proposed)

```
backend/src/domain/importers/musicxml/
├── mod.rs              (~350 lines)  ImportContext, MusicXMLImporter, re-exports [UNCHANGED]
├── parser/
│   ├── mod.rs          (~270 lines)  Parser entry, document & metadata parsing
│   ├── measure.rs      (~137 lines)  Measure element routing
│   ├── note.rs         (~442 lines)  Note, pitch, articulation, duration parsing
│   ├── attributes.rs   (~200 lines)  Key, clef, time signature parsing
│   └── structure.rs    (~198 lines)  Barline/repeat and direction/octave-shift parsing
├── converter/
│   ├── mod.rs          (~170 lines)  Convert entry, part routing, measure tick helpers
│   ├── staff.rs        (~310 lines)  Staff routing (single/multi) + key/clef changes
│   ├── notes.rs        (~400 lines)  Note collection, conversion, rest distribution
│   ├── ties.rs         (~90 lines)   Tie & slur chain resolution
│   ├── structure.rs    (~290 lines)  Pickup, measure boundaries, repeats, voltas, octave shifts
│   └── voice.rs        (~110 lines)  VoiceDistributor struct + assignment logic
├── types.rs            (~400 lines)  [UNCHANGED]
├── errors.rs           (~150 lines)  [UNCHANGED]
├── compression.rs      (~150 lines)  [UNCHANGED]
├── mapper.rs           (~150 lines)  [UNCHANGED]
└── timing.rs           (~200 lines)  [UNCHANGED]
```

## Preserved Entities (No Changes)

### Public Trait Interface

| Type | Location | Status |
|------|----------|--------|
| `IMusicXMLImporter` | `ports/importers.rs` | UNCHANGED |
| `ImportResult` | `ports/importers.rs` | UNCHANGED |
| `ImportMetadata` | `ports/importers.rs` | UNCHANGED |
| `ImportStatistics` | `ports/importers.rs` | UNCHANGED |

### Public Domain Types

| Type | Location | Status |
|------|----------|--------|
| `MusicXMLParser` | `parser/mod.rs` (was `parser.rs`) | Re-exported unchanged |
| `MusicXMLConverter` | `converter/mod.rs` (was `converter.rs`) | Re-exported unchanged |
| `ImportContext` | `mod.rs` | UNCHANGED |
| `ImportWarning` | `errors.rs` | UNCHANGED |
| `ImportError` | `errors.rs` | UNCHANGED |
| `Fraction` | `timing.rs` | UNCHANGED |
| `ElementMapper` | `mapper.rs` | UNCHANGED |
| `MusicXMLDocument` | `types.rs` | UNCHANGED |
| `PartData` | `types.rs` | UNCHANGED |
| `MeasureData` | `types.rs` | UNCHANGED |
| `NoteData` | `types.rs` | UNCHANGED |

### Internal Types Relocated (Not Renamed)

| Type | From | To | Visibility |
|------|------|----|------------|
| `TimingContext` | `converter.rs` | `converter/mod.rs` | `pub(super)` |
| `VoiceDistributor` | `converter.rs` | `converter/voice.rs` | `pub(super)` |
| `ParsedBarlineResult` | `parser.rs` | `parser/structure.rs` | `pub(super)` |

## State Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  ImportContext (mut ref, threads through │
                    │  all modules for warning collection)    │
                    └────────────────┬────────────────────────┘
                                     │
 ┌───────────────┐           ┌───────▼───────┐           ┌──────────────┐
 │  compression  │──.xml──►  │  parser/      │──Doc──►   │  converter/  │──► Score
 │  (.mxl→.xml)  │           │  mod.rs       │           │  mod.rs      │
 └───────────────┘           │    ▼          │           │    ▼         │
                             │  measure.rs   │           │  structure   │
                             │    ▼  ▼  ▼   │           │  staff.rs    │
                             │  note attrs  │           │  notes.rs    │
                             │  structure   │           │  ties.rs     │
                             └──────────────┘           │  voice.rs    │
                                                        └──────────────┘
```

## Validation Rules (Preserved)

All existing validation rules are preserved:
- XML structure validation (parser)
- Duration/timing validation (converter via TimingContext)
- Voice overflow warnings (VoiceDistributor)
- Measure boundary validation (converter structure helpers)
- Tie/slur pairing validation (ties.rs)

No new validation rules are introduced by this refactor.
