# Research: Fix Practice Mode MIDI Detection

**Phase**: 0 — Research  
**Date**: 2026-03-21  
**Feature**: `001-fix-practice-midi-detection`

All items below were resolved through direct codebase exploration. No external unknowns remain.

---

## Decision 1: Exact root cause of HL+HR chord retry failure

**Decision**: The bug is in the `ChordDetector` pin logic inside the `useEffect` in `PracticeViewPlugin.tsx` (around line 419–450).

**Rationale**: After an `EARLY_RELEASE` action, the practice engine mode transitions from `'holding'` → `'active'` on the **same** `currentIndex`. This triggers the ChordDetector reset `useEffect` (deps: `practiceState.currentIndex`, `practiceState.mode`). The reset logic re-populates the detector's pinned set using only notes from the **previous entry** (`notes[currentIndex - 1]`) that are currently held in `heldMidiKeysRef`. Notes from the **current entry** (`notes[currentIndex]`) that are still physically held (e.g., the LH notes in an HL+HR chord) are **not pinned**. When the user re-presses only the released hand's note, the detector cannot complete because the still-held LH pitches are not in its `presses` map and not in `pinned`. The chord never completes; the session is stuck.

**Root cause code** (`PracticeViewPlugin.tsx`, pin block):
```typescript
const prevEntry = ps.currentIndex > 0 ? ps.notes[ps.currentIndex - 1] : null;
const prevPitches = prevEntry ? (prevEntry.midiPitches as number[]) : [];
for (const pitch of onset) {
  // Only pins if pitch was in the PREVIOUS entry — misses current-entry still-held pitches
  if (prevPitches.includes(pitch) && heldMidiKeysRef.current.has(pitch)) {
    chordDetectorRef.current.pin(pitch);
  }
}
```

**Alternatives considered**:
- Resetting ChordDetector on `WRONG_MIDI` — rejected: this would clear partial correct accumulation during mixed wrong+correct events (e.g., user presses one correct+one wrong note simultaneously). Too aggressive.
- Adding a MIDI release handler that resets the detector when a chord note is released — rejected: `EARLY_RELEASE` already handles this transition; a second reset path would create race conditions with the `useEffect`.

---

## Decision 2: Exact root cause of staccato chord detection failure

**Decision**: The bug is in `scorePlayerContext.ts` → `extractPracticeNotes()`. Staccato notes have `durationTicks` **halved** (line ~486–488), but any positive `durationTicks` causes the engine to require a hold. For a staccato quarter note at 80 BPM, the halved duration is ~375 ms; 90% threshold = ~337 ms. Staccato key-hold duration is typically 50–100 ms. The hold check fires `EARLY_RELEASE` every time. The engine loops on the same note indefinitely.

**Root cause code** (`scorePlayerContext.ts`, staccato block):
```typescript
// Current (buggy):
if (entry.hasStaccato) {
  entry.durationTicks = Math.round(entry.durationTicks * 0.5);
}
```

The halved `durationTicks` is still > 0 → `entryRequiredHoldMs > 0` → engine enters `'holding'` mode → user's staccato release fires `EARLY_RELEASE` → infinite loop.

**Fix**: Set `durationTicks = 0` for staccato entries. Zero maps directly to `requiredHoldMs = 0` in the component, which bypasses the `'holding'` state entirely:
```typescript
// Fixed:
if (entry.hasStaccato) {
  entry.durationTicks = 0;  // Staccato: validate pitch only, no hold required
}
```

**Alternatives considered**:
- Adding `hasStaccato?: boolean` to `PluginPracticeNoteEntry` and using it to suppress hold in the component — rejected: this leaks an articulation concern into the plugin API contract. The API's `durationTicks = 0` contract already means "no hold"; staccato is an implementation detail of the extraction.
- Adjusting `EARLY_RELEASE` handling to accept short holds on staccato notes — rejected: requires the engine to know about staccato, violating the clean separation between score model and practice engine.
- Using a very low minimum hold threshold for staccato — rejected: not domain-correct. Staccato means "detached / no sustained hold." The semantically correct hold duration for a staccato note is 0.

---

## Decision 3: Auto-advance implementation location

**Decision**: Add auto-advance logic directly to the `WRONG_MIDI` case in `practiceEngine.ts` (pure reducer), gated by a new exported constant `MAX_CONSECUTIVE_WRONG = 3`.

**Rationale**: The reducer already tracks `currentWrongAttempts`. Adding a threshold check in the reducer keeps all session advancement logic in one place (the pure state machine), consistent with the existing architectural pattern. The component does not need to observe the counter and schedule a side effect; the reducer returns the already-advanced state.

**New outcome**: Add `'auto-advanced'` to `PracticeNoteResult.outcome` to distinguish auto-advanced beats from single-failure beats in the results report, even though they carry the same score weight (SC-006 specifies same weight, but separate outcome label aids diagnostics).

**Alternatives considered**:
- Implementing auto-advance in `PracticeViewPlugin.tsx` after receiving a `WRONG_MIDI` state update — rejected: duplicates session control logic in the component; makes the reducer's state machine incomplete.
- Using a separate `AUTO_ADVANCE` action — rejected: unnecessary indirection; the reducer can decide and return the next state inline in the `WRONG_MIDI` case.

---

## Decision 4: Chord-grouping window (50 ms spec vs 80 ms code)

**Decision**: Retain the existing default of **80 ms** in `ChordDetector`. The spec states 50 ms as a starting value "that may need tuning." The current code already uses 80 ms based on prior tuning experience ("inaudible chord-roll delay to human ears" per code comment). The spec explicitly calls this configurable; 80 ms is within the acceptable range.

**Alternatives considered**:
- Resetting to 50 ms per spec — rejected: prior tuning settled on 80 ms as the UX-optimal value. Regressing it without evidence of a problem would risk breaking currently-working chord detection.
- Making the window a user-configurable setting — deferred: not in scope for this fix.

---

## Decision 5: `consecutiveFailures` vs re-use of `currentWrongAttempts`

**Decision**: Re-use the existing `currentWrongAttempts` field in `PracticeState` as the auto-advance counter. It already resets to 0 on each successful advance (`CORRECT_MIDI`, `HOLD_COMPLETE`), giving "consecutive wrong presses since last success" — which is the intended semantics. No new state field is needed.

**Rationale**: Adding a separate `consecutiveFailures` field would be redundant. The distinction between "wrong press" and "failed attempt" is theoretical for the MVP fix; the threshold of 3 consecutive wrong presses is a reasonable proxy for "3 failed attempts."

**Alternatives considered**:
- Adding a separate `consecutiveAttempts` counter that only increments when all chord keys are released without completion — **deferred**: requires tracking "chord abandoned" events, which adds complexity beyond the bug fix scope.

---

## Decision 6: `PluginPracticeNoteEntry.hasStaccato` API addition

**Decision**: Do **not** add `hasStaccato` to `PluginPracticeNoteEntry`. The plugin API interface stays unchanged.

**Rationale**: The staccato fix works by setting `durationTicks = 0`, which is already the correct signal for "no hold required." The contract `durationTicks === 0 ↔ advance immediately on correct press` is clean and stable. Propagating `hasStaccato` through the API would expose a musical articulation flag with no additional behaviour attached, creating an API surface with no current consumer.

---

## Summary of Resolved Unknowns

| # | Unknown | Resolution |
|---|---------|------------|
| 1 | Root cause of HL+HR chord retry failure | EARLY_RELEASE → ChordDetector reset; pin logic misses currently-held same-entry notes |
| 2 | Root cause of staccato chord not detected | `durationTicks × 0.5` still > 0; hold requirement fires EARLY_RELEASE for staccato key presses |
| 3 | Auto-advance implementation location | Pure reducer `WRONG_MIDI` case, guarded by `MAX_CONSECUTIVE_WRONG` constant |
| 4 | Chord-grouping window default | Retain existing 80 ms |
| 5 | `consecutiveFailures` counter | Reuse existing `currentWrongAttempts` |
| 6 | API surface for staccato | No change to `PluginPracticeNoteEntry`; fix is in extraction layer |
