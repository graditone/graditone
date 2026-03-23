# Research: Fix Practice Issues in La Candeur

**Feature**: 053-fix-lacandeur-practice  
**Date**: 2026-03-23  
**Status**: Complete — all unknowns resolved

---

## Codebase Map (relevant files)

| File | Role |
|---|---|
| `frontend/plugins/practice-view-plugin/practiceEngine.ts` | Pure reducer: `reduce()`, `isCorrect()` |
| `frontend/plugins/practice-view-plugin/practiceEngine.types.ts` | `PracticeState`, `PracticeAction`, `PracticeNoteResult`, `INITIAL_PRACTICE_STATE` |
| `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` | Main component: MIDI wiring, `confirmedNoteIds`, rAF hold loop, results overlay |
| `frontend/plugins/practice-view-plugin/mergePracticeNotesByTick.ts` | Both-Hands note merging + **second gap truncation (bug origin)** |
| `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` | Staff selector UI (RH / LH / Both Hands) |
| `frontend/src/plugin-api/scorePlayerContext.ts` | `extractPracticeNotes()` — grouping, tie filtering, **first gap truncation** |
| `frontend/src/plugin-api/types.ts` | `PluginPracticeNoteEntry`, `ScorePlayerState`, `PluginScoreRendererProps` |
| `frontend/src/components/LayoutRenderer.tsx` | SVG rendering, `updatePinnedHighlights()`, `updateExpectedHighlights()`, rAF loop |
| `frontend/src/components/LayoutRenderer.css` | `.pinned` (green `#5AC481`), `.expected` (40% opacity green) |
| `frontend/src/pages/ScoreViewer.tsx` | `scrollToHighlightedSystem()` — 400ms ease-out auto-scroll on system change |

---

## Bug Root Causes

### Bug 1 — LH chord not green for full duration in BH mode

**Decision**: Fix the double gap-truncation in `mergePracticeNotesByTick.ts`.

**Root cause**: Gap truncation runs **twice** for Both-Hands mode:

1. **First truncation** (correct, per-staff): `extractPracticeNotes(staffIndex)` in `scorePlayerContext.ts` clamps each note's `durationTicks` to the gap before the next onset **within the same staff**. After this, each staff's notes have correct per-staff durations.

2. **Second truncation** (buggy): `mergePracticeNotesByTick.ts` merges both staves and then runs **the same truncation again** on the merged array. The "next onset" now comes from **either hand**, so an LH half-note gets clamped to the gap until the next RH onset — even if that RH onset is much sooner. An LH held for 480 ticks gets truncated to e.g. 240 ticks because RH has an intermediate beat.

**Fix**: Remove the gap truncation from `mergePracticeNotesByTick.ts`. Each staff's durations are already correctly bounded by their own per-staff next onset. The merge should take `max(durationTicks)` at each tick without re-truncating.

**Rationale**: Alternatives considered:
- _Keep second truncation, but use only same-staff next-onset_: Requires tracking staff origin through the merge, more complex.
- _Remove first truncation only_: Would allow individual entries to block advancement indefinitely if a note has no following onset in the same staff.

---

### Bug 2 — M3-M4 chord duration truncated to M3 only

**Decision**: Same fix as Bug 1 — remove the second gap truncation in `mergePracticeNotesByTick.ts`.

**Root cause**: Identical mechanism. In BH mode, the LH chord in M3 (which spans into M4) is truncated by the first RH note onset that falls in M4. The per-staff first truncation correctly gave the LH chord its full cross-measure duration (bounded only by the next LH onset). The second merged truncation then cuts it at the first combined-hand onset in M4.

**Confirmation**: In LH-only mode this works correctly because only one staff's gap truncation runs. In BH mode, the second truncation introduces the wrong cross-staff clamp.

---

### Bug 3 — Green dot shown then removed on system line break

**Decision**: Add a post-scroll `reapplyHighlights()` call triggered after the scroll animation settles.

**Root cause**: When the score scrolls to a new system, `visibleSystemsChanged()` fires → `renderSVG()` rebuilds the SVG DOM → `reapplyHighlights()` is called. However, the `scrollToHighlightedSystem()` is a 400ms animated scroll. During this animation, `renderSVG()` can be triggered in mid-flight (e.g., by a practice state update) **before** the new system is fully in view. On first render the new system's note elements exist and highlights are applied (dot appears). On a subsequent `renderSVG()` call (triggered by the ongoing scroll or a new state), highlights are re-applied based on the props at that moment — but if the `expectedNoteIds` set transiently re-computes to empty (between engine `currentIndex` advance and the next rAF confirmedNoteIds memo), the highlights are cleared.

**Fix**: After every `reapplyHighlights()` call that follows a `renderSVG()`, schedule a deferred second `reapplyHighlights()` on the next animation frame (or 16ms timeout) to catch the transient empty-highlight window.

**Rationale**: More invasive alternative (debouncing `renderSVG()`) would introduce rendering latency across all scenarios.

---

### Bug 4 — M15 requires LH half-notes when only RH G4 expected

**Decision**: Investigate and fix the `sustainedPitches` propagation in BH merging.

**Root cause analysis**: In BH mode, `mergePracticeNotesByTick.ts` builds `sustainedPitches` for each entry — pitches from prior entries that are still within their `durationTicks` window. The `ChordDetector.pin()` pre-populates these so the player doesn't need to re-press already-held notes.

The bug indicates that at M15, the LH half-notes are included in the **current entry's `midiPitches`** (requiring re-press) rather than in `sustainedPitches` (pre-pinned). This happens when the LH notes at a prior tick are not correctly tracked as sustained at the time the M15 RH entry is built.

Likely cause: The sustained-note window check in `mergePracticeNotesByTick.ts` uses the **truncated** `durationTicks` of prior entries (after the second gap truncation). Since bug 1's double truncation under-counts LH durations, LH notes expire sooner than expected — they fall outside the sustained window when they should still be active. Fixing the double truncation (Bug 1 fix) may automatically resolve Bug 4 as a side effect.

If not fully resolved: the sustained pitch detection needs to compare against the **original (pre-truncation) `durationTicks`** for cross-staff sustain tracking, not the truncated value.

**Alternatives considered**: Tracking sustained pitches separately from chord pitches at the merge stage (more complex state shape, not needed if truncation fix resolves it).

---

### Bug 5 — M17 rest accepted when pressed during rest period

**Decision**: Implement per-hand rest detection using the existing `sustainedPitches` mechanism.

**Root cause**: The practice engine has **no concept of rests**. Between two entries in the `notes[]` array, the engine simply waits at `currentIndex` for the next onset. During gaps (rests), any pitch that matches the next entry's `midiPitches` triggers `CORRECT_MIDI` prematurely.

At M17, during the RH half-rest:
- The LH entry may still be "active" (in holding mode)  
- Or the engine has advanced to the next combined BH entry that happens to include pitches the player is pressing

Two scenarios for the acceptance:
1. The engine's current entry (post-advance from the previous beat) includes pitches that the player holds or presses during the rest
2. In LH-only mode, the beat at M17 where the RH rest lives isn't part of the extracted notes at all (correctly skipped). In BH mode, the merged entry at that tick may include LH pitches that the player is holding, causing an inadvertent match.

**Fix approach**: Add a **rest gap** concept. When the elapsed time since `holdStartTimeMs + requiredHoldMs` exceeds the gap before the next note's tick, treat any key press during that gap as a wrong note (not advancing). This requires the engine to know the tick-to-time gap.

**Simpler alternative** (preferred): The `WRONG_MIDI` action already fires for any pitch not in `entry.midiPitches`. The issue is that pitches in the current `sustainedPitches` (held from prior beat) are being silently accepted. The semi-strict policy (FR-005) means pressing a key during a per-hand rest should count as a mistake. Enforce this by: when in the "inter-onset gap" (holding or waiting and the next entry tick is in the future), treat any pitch not in `nextEntry.midiPitches` that is pressed as `WRONG_MIDI`.

**Note**: Full rest enforcement (per-hand, time-based) is complex to implement in a reactive MIDI system. For this iteration, the fix focuses on the observed failure: pressing keys during an identified rest period generates a `WRONG_MIDI`. Pure time-based rest enforcement is deferred.

---

### Bug 6 — Position can be changed during active practice

**Decision**: Gate all position-navigation handlers with a `isPracticeActive` guard.

**Root cause**: No lockout exists. Affected handlers in `PracticeViewPlugin.tsx`:
- `handleNoteShortTap` — currently routes taps to `SEEK` (jumps practice position). Must be fully blocked (not re-routed) during `running` state.
- Return-to-start button — `seekToTick(loopStart?.tick ?? 0)` — must be hidden/disabled.
- Any measure-bar-click handler in `ScoreViewer.tsx` that changes `currentTick` — must be intercepted.

**Fix**: Add a `readonly isPracticeRunning: boolean` prop or context value; disable/hide navigation affordances when true.

**Rationale**: `SEEK` action in practice was designed for intentional position jumps during practice setup, not mid-session repositioning. Its presence in the active state creates confusion.

---

### Bug 7 — No partial results when stopping early

**Decision**: Capture snapshot of `noteResults` + `currentIndex` on STOP and display using the existing results overlay with a "Partial" badge.

**Root cause**: The STOP action resets all state including `noteResults`. The results overlay only renders when `mode === 'complete'` OR when `performanceRecord` is set from natural completion.

**Fix**:
1. Before dispatching `STOP`, snapshot the current `noteResults`, `currentIndex`, and `notes.length` into a new `partialPerformanceRecord` state variable.
2. After STOP, if `partialPerformanceRecord` is non-empty, show the results overlay with a "Session stopped early — M{stoppedAtMeasure} of {totalMeasures}" indicator.
3. Re-use the existing score computation (`practiceReport` memo) applied to the partial data.

**Rationale**: Re-using the existing results overlay (rather than a separate component) avoids duplication and keeps the change minimal. The only new UI element is the "partial" badge and the measure-reached display (SC-007: score % + "MX of N" label).

---

## Decisions Summary

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01 | Remove second gap truncation in `mergePracticeNotesByTick.ts` | Fixes Bugs 1, 2, and likely 4 as a side effect |
| D-02 | Post-scroll deferred `reapplyHighlights()` on next rAF | Minimal fix for transient highlight clear on system change |
| D-03 | Sustainable pitch fix if D-01 doesn't resolve Bug 4 | Use pre-truncation duration for cross-staff sustain window |
| D-04 | WRONG_MIDI on any key press when in inter-onset gap | Addresses rest acceptance; time-based per-hand enforcement deferred |
| D-05 | `isPracticeRunning` guard on all navigation handlers | Disable position navigation during active practice |
| D-06 | Snapshot `noteResults` + `currentIndex` before STOP dispatch | Enables partial results display after early stop |
| D-07 | Apply fixes engine-wide, test on La Candeur + Arabesque | Scope: all scores (clarification session 2026-03-23) |

---

## No Further Unknowns

All 7 bugs have identified root causes and fix approaches. No backend changes required. No new Rust/WASM logic required. All fixes are contained in:
- `frontend/plugins/practice-view-plugin/` (engine + component)
- `frontend/src/plugin-api/scorePlayerContext.ts` (if D-03 needed)
- `frontend/src/pages/ScoreViewer.tsx` (navigation lockout)

No NEEDS CLARIFICATION items remain.
