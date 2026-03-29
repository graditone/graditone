# Cross-Reference Contract: MusicXML Processing Reference

This feature is documentation-only. The "contract" is the set of cross-reference links that must be valid.

## Outgoing Links (from new document)

The new `docs/musicxml-processing.md` MUST contain valid relative links to:

- `architecture.md`
- `musicxml-importer.md`
- `layout-engine.md`
- `svg-renderer.md`
- `wasm-engine.md`
- `doc-update-checklist.md`

## Incoming Links (edits to existing documents)

`docs/architecture.md` MUST be updated to link to `musicxml-processing.md` in:

1. **Components table**: New row for "MusicXML Processing Pipeline"
2. **See Also section**: Add `[MusicXML Processing Pipeline](musicxml-processing.md)`
