# Timing Feedback Overlay Display Contract (096-timing-feedback-overlay)

## Purpose

Defines the presentation contract for the live timing-feedback overlay in the Practice view: a large `±ms` badge that flashes when a note is played out of time.

## Inputs

- `outcome: NoteOutcome` — the last recorded note result's outcome.
- `relativeDeltaMs: number` — the last recorded note result's signed deviation.
- `liveContext: { isReplaying, freePracticeActive, resultsVisible }` — gate flags.

## Output rules

1. **Trigger**: show when `outcome` is `correct-late` or `early-release`, AND NOT `isReplaying`, AND NOT free-practice session, AND NOT results overlay visible.
2. **Text**: `formatStateLabel(relativeDeltaMs)` — reuse `frontend/plugins/practice-view-plugin/stateLabel.ts` exactly as the report does (`>0` → `+{n} ms`, `<0` → `-{n} ms`, `===0` → `0 ms`).
3. **Appear**: fade in (~120ms), hold (~700ms), fade out (~180ms) → total ≤ ~1s. Opacity transitions; optional slight upward transform.
4. **Rapid repeats**: each new out-of-time result replaces the text and resets the timer. Never stack, never flash-flicker.
5. **Dismissal**: automatic via timer; also hide immediately when replay starts, free practice starts, or results overlay becomes visible.
6. **Non-interference**: `pointer-events: none`; absolute-positioned above the score area; `aria-live="polite"`; does not take focus.

## Styling (theme-compliant)

- Value colour: `var(--ls-accent, var(--color-danger, #F57F17))`.
- Large display type (`font-size` ≥ 4rem when space allows), bold, centered near the middle-top of the score area.
- Scoped classes: `.practice-plugin__timing-overlay` (container: absolute, centered, fade transitions) and inner `.practice-plugin__timing-overlay-value`.

## Non-Goals

- No new i18n keys (value is numeric + "ms").
- No persistence, no engine changes, no replay/result interactions.
- Does not replace the red note highlight for wrong pitches (existing `errorNoteIds` flash stays).

## Testable Assertions

- Render with `outcome='correct-late', relativeDeltaMs=120` → shows `+120 ms`.
- Render with `outcome='early-release', relativeDeltaMs=-80` → shows `-80 ms`.
- Render gated off (`isReplaying=true`, free practice, or results visible) → no overlay.
- No `correct` / `wrong` trigger → neither state opens it.
- Rapid successive values → single overlay, latest text, timer resets (verified via fake timers).
- CSS class present for theming; element `pointer-events: none`.