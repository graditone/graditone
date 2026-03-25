# Contracts: Refactor MusicXML Importer

**Feature**: 057-refactor-musicxml-importer  
**Date**: 2025-03-25

## Contract Preservation Policy

This refactor introduces **zero contract changes**. All public interfaces remain identical in signature, semantics, and behavior. This document records the contracts that MUST be preserved.

## Public Interface Contracts

### 1. Port: IMusicXMLImporter Trait

**Location**: `backend/src/ports/importers.rs`  
**Status**: FROZEN — no modifications allowed

```rust
pub trait IMusicXMLImporter {
    fn import_file(&self, path: &Path) -> Result<ImportResult, ImportError>;
    fn import_content(&self, xml: &str) -> Result<ImportResult, ImportError>;
}
```

**Contract**:
- `import_file`: Accepts `.mxl` (compressed) or `.xml` (plain) MusicXML files
- `import_content`: Accepts raw MusicXML string content
- Both return identical `ImportResult` structure on success
- Both return `ImportError` on failure

### 2. Result Types

**Location**: `backend/src/ports/importers.rs`  
**Status**: FROZEN

```rust
pub struct ImportResult {
    pub score: Score,
    pub metadata: ImportMetadata,
    pub statistics: ImportStatistics,
    pub warnings: Vec<ImportWarning>,
    pub partial_import: bool,
}
```

All fields and their semantics are preserved.

### 3. REST API Endpoint

**Location**: `backend/src/adapters/api/import.rs`  
**Status**: UNCHANGED (not touched by this refactor)

- `POST /api/v1/scores/import-musicxml`
- Multipart form-data input
- JSON response with score, metadata, statistics, warnings

### 4. CLI Binary

**Location**: `backend/src/bin/musicore-import.rs`  
**Status**: UNCHANGED (not touched by this refactor)

- `musicore-import <file>` with `--output`, `--validate-only`, `--quiet`, `--verbose`, `--format` flags

### 5. Internal Module Re-exports

**Location**: `backend/src/domain/importers/musicxml/mod.rs`  
**Status**: All re-exports MUST be preserved

```rust
pub use converter::MusicXMLConverter;
pub use errors::{ConversionError, ImportError, ImportWarning, MappingError, WarningCategory, WarningSeverity};
pub use mapper::ElementMapper;
pub use parser::MusicXMLParser;
pub use timing::Fraction;
pub use types::*;
```

These re-exports ensure that code importing from `domain::importers::musicxml::` continues to work without path changes.

## Inter-Module Contracts (Internal)

### Parser → Converter Data Contract

The parser produces `MusicXMLDocument` which the converter consumes. The structure of this intermediate type is unchanged:

```
MusicXMLDocument
├── version: Option<String>
├── work_title: Option<String>
├── composer: Option<String>
├── parts: Vec<PartData>
└── part_names: HashMap<String, String>

PartData
├── id: String
├── name: String
├── measures: Vec<MeasureData>
└── staff_count: usize

MeasureData
├── number: i32
├── elements: Vec<MeasureElement>
├── start_repeat: bool
├── end_repeat: bool
└── endings: Vec<RawEndingData>
```

### Warning Contract

All sub-modules that accept `&mut ImportContext` MUST use the existing warning methods:
- `context.add_warning(message, category, severity)`
- `context.set_measure(number)` / `context.set_instrument(name)` / `context.set_staff(number)`

No new warning categories or severity levels are introduced.

## Verification

Contract preservation is verified automatically by:
1. **Compilation**: Any signature change causes compile errors in callers (REST API, CLI, tests)
2. **Integration Tests**: 70+ tests verify behavioral contract preservation
3. **Re-export Check**: `cargo check` verifies all re-exports resolve correctly
