# Quickstart: Practice Report Timing Labels (095-state-timing-ms)

The final report's notes table State column shows the signed timing deviation in ms
(`+120 ms`, `-80 ms`, `0 ms`) for out-of-time notes. This guide validates the feature
end-to-end. Presentation contract: [contracts/status-label-contract.md](contracts/status-label-contract.md).
Data source: [data-model.md](data-model.md) (`PracticeNoteResult.relativeDeltaMs`).

## Prerequisites

- Monorepo `frontend/` with dependencies installed (`npm install` in `frontend/`) — see repo README.
- Test target: vitest (frontend).
- Work in the feature worktree: `../worktrees/095-state-timing-ms`.

## Validation Scenarios

### VS-01 — Unit: label formatter

**Run**: vitest on the formatter tests (component or extracted pure function).

**Expected**: `formatStateLabel` returns `+120 ms` for 120, `-80 ms` for -80, `0 ms` for 0.

### VS-02 — Component: State column composition

**Run**: vitest on `ResultsOverlay.test.tsx` with injected `noteResults`:

- `outcome='correct-late', relativeDeltaMs=120` → cell shows ⏱️ icon and text `+120 ms`.
- `outcome='early-release', relativeDeltaMs=-80` → cell shows ⏱️ icon and text `-80 ms`.
- `outcome='correct-late', relativeDeltaMs=0` → cell text `0 ms`.
- `outcome='correct'` → text `Correct` (unchanged).
- `outcome='wrong'` → text `Wrong` (unchanged).

**Expected**: all assertions pass; no change to Timing Δ column rendering.

### VS-03 — Regression: existing label tests

**Run**: vitest on `PracticeViewPlugin.test.tsx` (T030/T030b updated in this feature).

**Expected**: practice engine behaviour unchanged; results-table assertions match the new labels.

### VS-04 — Integration: live completed practice (manual)

1. Start the app (`npm run dev` in `frontend/`) and open Practice with a score.
2. Complete a session playing at least one note outside the timing tolerance.
3. Open the final report → expand the per-note details table.

**Expected**: out-of-time rows show signed ms in the State column (e.g. `+120 ms`); in-time rows
still show `Correct`; wrong rows show `Wrong`.

### VS-05 — Integration: saved practice report (manual)

1. Save the practice from VS-04.
2. Reload it from the saved-practices list and open the report.

**Expected**: State column matches VS-04 exactly (identical labels) — no inconsistency between
live and restored reports.

### VS-06 — Tablet layout

**Run**: manual, tablet viewport (e.g. iPad/Surface width), largest expected value.

**Expected**: `+{n} ms` label renders fully within the State cell — no truncation or wrap that
breaks the row (SC-004).

## Out of Scope (do not validate as changed)

- Partial/stopped-early report (no notes table).
- Score, summary stats, time comparison, delay graph, Timing Δ column.