/**
 * Practice Engine — Updated TypeScript Contracts
 *
 * Feature: 001-fix-practice-midi-detection
 * Phase: 1 — Contracts
 *
 * This file documents the changed TypeScript interfaces and type unions
 * resulting from this feature. No new REST or GraphQL endpoints are introduced
 * (all changes are frontend-internal).
 *
 * Files actually changed:
 *   frontend/plugins/practice-view-plugin/practiceEngine.types.ts
 *   frontend/plugins/practice-view-plugin/practiceEngine.ts
 *   frontend/src/plugin-api/scorePlayerContext.ts
 *   frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx
 */

// ---------------------------------------------------------------------------
// 1. NoteOutcome — expanded union
// ---------------------------------------------------------------------------

/**
 * BEFORE:
 *   type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'pending' | 'early-release';
 *
 * AFTER: add 'auto-advanced'
 */
export type NoteOutcome =
  | 'correct'          // user played correct pitch(es) within time window, held for ≥90% duration
  | 'correct-late'     // correct pitch(es), but response interval was > LATE_THRESHOLD_MS
  | 'wrong'            // incorrect pitch pressed (session stays on same beat)
  | 'pending'          // placeholder for beats not yet reached
  | 'early-release'    // correct pitch(es) pressed but released before ≥90% hold duration elapsed
  | 'auto-advanced';   // beat skipped after MAX_CONSECUTIVE_WRONG consecutive wrong presses (FR-003a)

// Score weights (informational — not currently stored in PracticeNoteResult):
//   'correct'       → 1.0
//   'correct-late'  → 0.5
//   'early-release' → 0.0  (retry, can still recover)
//   'wrong'         → 0.0  (penalty recorded in wrongAttempts)
//   'auto-advanced' → 0.0  (same weight as wrong, per SC-006 / clarification Q5)
//   'pending'       → n/a

// ---------------------------------------------------------------------------
// 2. MAX_CONSECUTIVE_WRONG — new exported constant
// ---------------------------------------------------------------------------

/**
 * NEW constant exported from practiceEngine.ts
 *
 * Number of consecutive wrong MIDI presses on a single beat before the engine
 * auto-advances past that beat (FR-003a).
 *
 * Configurable by changing this constant. Default = 3.
 * Exported alongside LATE_THRESHOLD_MS (existing) to keep constants discoverable.
 */
export const MAX_CONSECUTIVE_WRONG = 3;

// ---------------------------------------------------------------------------
// 3. extractPracticeNotes() — staccato contract change
// ---------------------------------------------------------------------------

/**
 * UNCHANGED interface in PluginPracticeNoteEntry (types.ts):
 *
 *   readonly durationTicks: number;
 *   //  When 0 → engine advances immediately on correct press (no hold required)
 *   //  When > 0 → engine enforces hold ≥ 90% of (durationTicks / ((bpm/60) * 960)) * 1000 ms
 *
 * CHANGED extraction rule in scorePlayerContext.ts:
 *
 *   BEFORE:
 *     if (entry.hasStaccato) { entry.durationTicks = Math.round(entry.durationTicks * 0.5); }
 *
 *   AFTER:
 *     if (entry.hasStaccato) { entry.durationTicks = 0; }
 *
 * Staccato entries now expose durationTicks = 0 to the plugin layer.
 * This maps to the existing "no hold required" contract — correct pitch → immediate advance.
 * The hasStaccato field is NOT propagated to PluginPracticeNoteEntry (encapsulated at extraction).
 */

// ---------------------------------------------------------------------------
// 4. ChordDetector reset/pin contract — behavioural change, API unchanged
// ---------------------------------------------------------------------------

/**
 * ChordDetector public API is UNCHANGED:
 *   reset(requiredPitches: number[]): void
 *   press(midiNote: number, timestamp: number): ChordResult
 *   pin(midiNote: number): void
 *
 * CHANGED usage in PracticeViewPlugin.tsx (the useEffect that resets the detector):
 *
 *   BEFORE — pin logic:
 *     Pin a pitch only if it is in notes[currentIndex - 1].midiPitches AND currently held.
 *
 *   AFTER — pin logic:
 *     Pin a pitch if it is in the CURRENT entry's (onset ∪ sustained) AND currently held.
 *
 * Contract: After ChordDetector.reset(), calling pin(midi) for a pitch that is in the
 * required set marks it as already-pressed. Subsequent press() calls for the remaining
 * unpinned pitches complete the chord.
 *
 * Invariant: pin() is a no-op for midi values not in the required set. Calling it for
 * currently-held pitches that satisfy the required set is always safe.
 */

// ---------------------------------------------------------------------------
// 5. PracticeState — unchanged interface; behavioural contract updated
// ---------------------------------------------------------------------------

/**
 * PracticeState.currentWrongAttempts behavioural contract update:
 *
 *   BEFORE: Counts wrong presses for the current beat. Reset on correct advance.
 *           Used only for informational display.
 *
 *   AFTER: Same semantics, but now ALSO triggers auto-advance when it reaches
 *          MAX_CONSECUTIVE_WRONG inside the WRONG_MIDI reducer case.
 *
 * No new fields added to PracticeState. Structural interface is unchanged.
 */

// ---------------------------------------------------------------------------
// 6. WRONG_MIDI action — updated reducer contract
// ---------------------------------------------------------------------------

/**
 * WRONG_MIDI action contract update:
 *
 *   Input: { type: 'WRONG_MIDI'; midiNote: number; responseTimeMs: number }
 *
 *   BEFORE: Always stays on same beat. Increments currentWrongAttempts.
 *
 *   AFTER: If (currentWrongAttempts + 1 >= MAX_CONSECUTIVE_WRONG):
 *            → Appends PracticeNoteResult { outcome: 'auto-advanced' }
 *            → Advances currentIndex
 *            → Resets currentWrongAttempts to 0
 *            → Sets mode = 'active' (or 'complete' if last beat)
 *          Else:
 *            → Stays on same beat (existing behaviour)
 *            → Increments currentWrongAttempts
 *
 *   Idempotency: The reducer is still pure. Two equal WRONG_MIDI dispatches
 *   produce deterministic state — the second may or may not trigger auto-advance
 *   depending on the current counter value.
 */
