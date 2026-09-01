# Research Notes: Practice Report Timing Labels (095-state-timing-ms)

## Open Questions & Resolutions

### RQ-1: Which note states count as "out of time"?

**Decision**: Out-of-time states are `correct-late` (currently labelled "Off-beat") and `early-release` (currently "Held too short").

**Rationale**: Both outcomes are produced when the recorded onset timing deviates from the expected interval. In `practiceEngine.ts` (lines 113, 240) a note becomes `correct-late` when `|relativeDeltaMs| > LATE_THRESHOLD_MS`; the `EARLY_RELEASE` handler (lines 148-157) computes an identical `relativeDeltaMs`. Both carry a numeric deviation that can be shown in ms. `correct` notes are within tolerance (deviation ≈ 0) and `wrong` notes miss pitch, so neither is an "out of time" state.

**Alternatives considered**:
- Only `correct-late` → rejected: inconsistent, would silently drop the deviation for early-release notes.
- All states including `correct`/`wrong` → rejected: spec FR-004/FR-005 require those labels unchanged.

### RQ-2: What does the State label text become?

**Decision**: For out-of-time states, the State cell text becomes the signed milliseconds value (`+120 ms`, `-80 ms`, `0 ms`). The existing status icon (⏱️) is retained (spec FR-006). The localized words "Off-beat" / "Held too short" no longer appear in the cell for these states.

**Rationale**: The user requirement is explicit — "The state label must be +/- xxx ms". Replacing the qualitative word with the quantitative value while keeping the icon satisfies both the requirement (FR-001) and the unchanged-label constraints for other states (FR-004/FR-005/FR-008). No new i18n keys needed; the value is numeric and locale-independent (FR-008).

**Alternatives considered**:
- Append amount to the word ("Off-beat +120 ms") → rejected: deviates from the stated requirement and would require keeping/translating the word for every locale.
- Show amount only in the existing "Timing Δ" column and leave State untouched → rejected: that is today's behaviour, not an improvement.

### RQ-3: Sign convention and zero handling

**Decision**: Reuse the exact convention of the existing "Timing Δ" column (ResultsOverlay.tsx:392-394): positive `relativeDeltaMs` renders as `+{n} ms`, negative as `-{n} ms`, and `0` out-of-time notes render as `0 ms`.

**Rationale**: Spec FR-001/FR-002 require signed formatting. `relativeDeltaMs` is already signed (positive = late, negative = early) per `practiceEngine.ts`. The formula `+/>0`, `-/<0`, no sign for `0` is simplest and matches the delta column, preventing user confusion between State and Timing Δ.

**Alternatives considered**:
- Zero shows `—` like the delta column → rejected: spec FR-001 explicitly requires `0 ms` for out-of-time notes whose deviation is zero (possible for early-release with no reference point, practiceEngine.ts:152-153).

## Technology/Dependency Findings

- **Existing formatter**: `ResultsOverlay.tsx` already has a local `formatTimeMs` helper (line 32) and inline signed-ms rendering (line 393). No date/number library is used; `Number.prototype.toFixed` is not used for ms (values are already integers via `Math.round`).
- **Label scope**: the change touches ONLY the state `<td>` at ResultsOverlay.tsx:378-389. It must NOT affect the `timing_delta` column, score block, stats, time comparison, or delay graph (FR-009).
- **Both report paths share the renderer**: `practiceReport.results` comes from `practiceState.noteResults` (live) or `performanceRecord?.noteResults` (saved) — ResultsOverlay.tsx:209-211. A single edit therefore covers both live and saved reports (FR-007, spec US2). The partial report has no notes table (ResultsOverlay.tsx:653-683) and is unaffected.
- **Testing**: Existing component tests render `ResultsOverlay` directly with `practiceState.mode='complete'` and injected `noteResults` (ResultsOverlay.test.tsx:46-71). New format tests should follow this pattern. `PracticeViewPlugin.test.tsx` T030/T030b assert on the "Held too short" label and must be updated because that wording disappears for flagged rows.

## Best Practices

- **Test-first (constitution V)**: write the failing component tests for the new label format before changing the component; update T030/T030b expectations in the same change.
- **Localization**: numeric labels need no translation; keep `practice.results.*` keys untouched for unaffected states.
- **Accessibility**: keep the status icon + aria semantics; the cell remains labelled by the Status column header.
- **Performance**: string concatenation per row only; no memoization changes required.