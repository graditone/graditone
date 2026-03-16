/**
 * TieResolver — Merges tied note chains into single playback events.
 *
 * Feature 051: Tied Notes
 */

import type { Note } from '../../types/score';

/** A note with its combined duration after resolving tie chains. */
export interface ResolvedNote {
  /** Original note ID (the tie-start note). */
  id: string;
  /** MIDI pitch */
  pitch: number;
  /** Start tick of the first note in the chain. */
  start_tick: number;
  /** Sum of all tied durations in the chain. */
  combinedDurationTicks: number;
}

/**
 * Resolves tied notes by merging continuation notes into their
 * tie-start note with accumulated duration.
 *
 * - Continuation notes (is_tie_continuation === true) are removed from output.
 * - Tie-start notes get their duration extended by all continuation durations.
 * - Non-tied notes pass through with combinedDurationTicks === duration_ticks.
 */
export function resolveTiedNotes(notes: Note[]): ResolvedNote[] {
  // Build a map of note ID → Note for quick lookup
  const noteById = new Map<string, Note>();
  for (const note of notes) {
    noteById.set(note.id, note);
  }

  const result: ResolvedNote[] = [];

  for (const note of notes) {
    // Skip continuation notes — they're absorbed into the start note
    if (note.is_tie_continuation) {
      continue;
    }

    // Accumulate duration along the tie chain
    let totalDuration = note.duration_ticks;
    let current: Note | undefined = note;

    while (current?.tie_next) {
      const next = noteById.get(current.tie_next);
      if (!next) break;
      totalDuration += next.duration_ticks;
      current = next;
    }

    result.push({
      id: note.id,
      pitch: note.pitch,
      start_tick: note.start_tick,
      combinedDurationTicks: totalDuration,
    });
  }

  return result;
}
