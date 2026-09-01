# Research Notes: Live Timing Feedback Overlay (096-timing-feedback-overlay)

## Open Questions & Resolutions

### RQ-1: What triggers the overlay?

**Decision**: The last entry of `practiceState.noteResults` when its `outcome` is `correct-late` or `early-release`, while the session is live.

**Rationale**: Every out-of-time result carries `relativeDeltaMs`. `practiceState.noteResults` is the single array that grows per recorded note (practiceEngine appends on `CORRECT_MIDI` late path and `EARLY_RELEASE`). Watching its last element in an effect (mirror of the existing `auto-advanced` flash at `PracticeViewPlugin.tsx:352-367`) gives the exact moment each result is recorded, failsafe-not-missed.

**Alternatives considered**:
- Watch `practiceState.currentIndex` → rejected: misses retries and doesn't carry the deviation value.
- Hook into `dispatchPractice` → rejected: couples the overlay to the reducer; the effect-on-noteResults pattern already exists in the codebase.

### RQ-2: Overlay lifecycle timing

**Decision**: CSS opacity fade-in (~120ms), full visibility (~700ms), fade-out (~180ms); total ≈ 1s. Each new out-of-time result resets the dismiss timer (rapid-miss refresh, no stacking).

**Rationale**: "Appear and disappear quickly to avoid disturbing the experience" + "fading (but quick)". The net ~1s budget matches SC-002 (≤1s). Reset-on-new-result satisfies FR-006 (update in place, no flicker/stack).

**Alternatives considered**:
- Animate with JS (requestAnimationFrame) → rejected: CSS transitions are cheaper, simpler, and composable; the existing `errorFlashTimerRef` idiom uses a `setTimeout` for dismissal.
- No fade-in (instant show) → rejected: request explicitly wants fading both ways.

### RQ-3: Styling / theme compliance

**Decision**: Use CSS custom properties with fallbacks, consistent with the practice plugin: `--ls-accent` (amber/orange accent) for the numeric value, `--color-danger` (red) as fallback/highlight, plus `--ls-success` used if a neutral/green note ever needs theming. Class: `.practice-btn__timing-overlay` scoped under `.practice-plugin`.

**Rationale**: `--ls-accent` is a warm, highly-visible accent token available on `body[data-landing-theme="*"]` (App.tsx keeps this on the body always — line 116). Fallbacks guarantee visibility even outside a themed landing page. FR-002 requires theme styling; SC-006 requires checking ≥2 themes.

**Alternatives considered**:
- Hardcoded `#F57F17` → rejected: breaks across themes (SC-006).
- Add a new token → rejected: existing tokens suffice and adding theme tokens is broader scope.

### RQ-4: Exclusion cases

**Decision**: Overlay shows only when: not `isReplaying`, not `freePractice.isFreePractice`, and `resultsOverlayVisible === false`. The value uses `formatStateLabel(last.relativeDeltaMs)` (Feature 095) as the single label source (FR-009).

**Rationale**: Replay is not live play (FR-007). Free practice is a no-score session without `noteResults` timing semantics (FR targets score-based practice). Results overlay open means the session ended (FR: overlay hides with the results).

### RQ-5: Non-interference

**Decision**: The overlay element is `position: absolute`, `pointer-events: none`, rendered inside the `.practice-plugin` root above the score area. `aria-live="polite"` so screen readers get the value without announcing structure.

**Rationale**: FR-008 (non-blocking, pass-through interactions). `aria-live` keeps accessibility without stealing focus.

## Technology/Dependency Findings

- The overlay is small; no new deps. Reuses `formatStateLabel` (already exported by `stateLabel.ts` from 095).
- Timer dismissal pattern already established: `errorFlashTimerRef` / `setTimeout` in `PracticeViewPlugin.tsx:150,361-365`.
- Test hooks: `PracticeViewPlugin.test.tsx` already drives full sessions via `ctx.simulateMidiEvent` and fake timers (see T030/T030b, Feature 042 block) — ideal for overlay integration tests.
- Theme tokens live on `body[data-landing-theme]`; CSS vars cascade; no JS needed to resolve a theme color.

## Best Practices

- Test-first (constitution V): write failing component + integration tests before the component exists.
- Keep the value computation identical to the report: reuse `formatStateLabel`.
- Use a ref for the dismiss timer; clear on unmount to avoid dangling timers in tests.
- CSS: transitions on `opacity` + `transform` (small upward drift) — cheap, GPU-friendly.