# State Label Rendering Contract (095-state-timing-ms)

## Purpose

Defines the presentation contract for the **State column** (header: `practice.results.status`,
ResultsOverlay.tsx:360) of the per-note details table in the Score Practice View final report.
Applies identically to live reports and reports loaded from saved practices (FR-007).

## Contract

### Inputs

For each row in the notes table, the renderer receives a `PracticeNoteResult` with at least:

- `outcome: NoteOutcome`
- `relativeDeltaMs: number`

### Output rules

1. **If `outcome === 'correct-late'` or `outcome === 'early-release'`** (out of time):
   - Render the existing status icon (⏱️) as today (FR-006).
   - Render the state label as `formatSignedMs(relativeDeltaMs)`:
     - `> 0` → `"+{n} ms"` (e.g. `+120 ms`)
     - `< 0` → `"-{n} ms"` (e.g. `-80 ms`)
     - `=== 0` → `"0 ms"` (no sign)
   - No localized word ("Off-beat" / "Held too short") appears in the text.
2. **If `outcome === 'correct'`**: keep the existing `✅ Correct` label; invariant to `relativeDeltaMs`.
3. **Any other outcome** (e.g. `wrong`): keep the existing `❌ Wrong` label; invariant to `relativeDeltaMs`.
4. The **Timing Δ column** (ResultsOverlay.tsx:391-395) MUST remain unchanged (FR-009).

### Formatting helper

```ts
function formatStateLabel(relativeDeltaMs: number): string {
  if (relativeDeltaMs > 0) return `+${relativeDeltaMs} ms`;
  if (relativeDeltaMs < 0) return `${relativeDeltaMs} ms`; // already carries '-'
  return '0 ms';
}
```

Note: the existing inline pattern at ResultsOverlay.tsx:393
(`${relativeDeltaMs > 0 ? '+' : ''}${relativeDeltaMs} ms`) produces identical output for non-zero
values but renders `0 ms` for zero, whereas the Timing Δ column intentionally hides zero as `—`.
The State label uses the `0 ms` form per FR-001.

## Non-Goals

- No change to `PracticeNoteResult`, storage, or the practice engine.
- No change to the partial (stopped-early) report — it has no notes table.
- No new translation keys; `practice.results.off_beat` becomes unused for the State cell text
  (may remain defined for backward safety) and `Held too short` (a hardcoded string at
  ResultsOverlay.tsx:387) is superseded.

## Testable Assertions

- `formatStateLabel(120) === '+120 ms'`
- `formatStateLabel(-80) === '-80 ms'`
- `formatStateLabel(0) === '0 ms'`
- Row with `outcome='correct-late', relativeDeltaMs=120` renders icon ⏱️ + text `+120 ms`.
- Row with `outcome='early-release', relativeDeltaMs=-80` renders icon ⏱️ + text `-80 ms`.
- Row with `outcome='correct', relativeDeltaMs=40` renders `Correct`.
- Row with `outcome='wrong', relativeDeltaMs=-200` renders `Wrong`.