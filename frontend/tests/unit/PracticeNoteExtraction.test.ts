/**
 * Unit tests for practice note extraction with tied notes — Feature 051 (T018)
 *
 * Tests that tie continuation notes are excluded from the practice sequence,
 * so the practice engine only steps through independently-attacked notes.
 */

import { describe, it, expect } from 'vitest';
import type { Note } from '../../src/types/score';

/**
 * Standalone practice note extraction logic mirroring extractPracticeNotes behavior.
 * Tests the filtering/grouping of notes for practice mode.
 */
function extractPracticeNotesFromList(notes: Note[]) {
  // The key behavior: filter out tie continuation notes before grouping
  const attackNotes = notes.filter(n => !n.is_tie_continuation);

  // Group by start_tick (like the real extractPracticeNotes does)
  const tickMap = new Map<number, { midiPitches: number[]; noteIds: string[]; tick: number }>();
  for (const note of attackNotes) {
    const existing = tickMap.get(note.start_tick);
    if (existing) {
      existing.midiPitches.push(note.pitch);
      existing.noteIds.push(note.id);
    } else {
      tickMap.set(note.start_tick, {
        midiPitches: [note.pitch],
        noteIds: [note.id],
        tick: note.start_tick,
      });
    }
  }

  return [...tickMap.values()].sort((a, b) => a.tick - b.tick);
}

describe('Practice note extraction with tied notes (T018)', () => {
  it('3-note tie chain produces 1 practice entry (tie-start only)', () => {
    const notes: Note[] = [
      { id: 'n1', pitch: 64, start_tick: 0, duration_ticks: 240, tie_next: 'n2' },
      { id: 'n2', pitch: 64, start_tick: 240, duration_ticks: 240, tie_next: 'n3', is_tie_continuation: true },
      { id: 'n3', pitch: 64, start_tick: 480, duration_ticks: 240, is_tie_continuation: true },
    ];

    const entries = extractPracticeNotesFromList(notes);

    // Only the first note (attack) should appear
    expect(entries).toHaveLength(1);
    expect(entries[0].noteIds).toEqual(['n1']);
    expect(entries[0].midiPitches).toEqual([64]);
  });

  it('mix of tied and untied notes: continuations excluded, attacks included', () => {
    const notes: Note[] = [
      { id: 'n1', pitch: 60, start_tick: 0, duration_ticks: 480, tie_next: 'n2' },
      { id: 'n2', pitch: 60, start_tick: 480, duration_ticks: 480, is_tie_continuation: true },
      { id: 'n3', pitch: 64, start_tick: 960, duration_ticks: 480 },
      { id: 'n4', pitch: 67, start_tick: 1440, duration_ticks: 480 },
    ];

    const entries = extractPracticeNotesFromList(notes);

    // 3 entries: n1 (attack), n3 (attack), n4 (attack) — n2 is skipped
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.noteIds[0])).toEqual(['n1', 'n3', 'n4']);
  });

  it('chord with partial tie: continuation pitch excluded from second onset', () => {
    const notes: Note[] = [
      { id: 'c1', pitch: 60, start_tick: 0, duration_ticks: 480 },
      { id: 'e1', pitch: 64, start_tick: 0, duration_ticks: 480, tie_next: 'e2' },
      { id: 'c2', pitch: 60, start_tick: 480, duration_ticks: 480 },
      { id: 'e2', pitch: 64, start_tick: 480, duration_ticks: 480, is_tie_continuation: true },
    ];

    const entries = extractPracticeNotesFromList(notes);

    // First onset: C4 + E4 (both attacks)
    expect(entries[0].midiPitches).toEqual([60, 64]);
    // Second onset: only C4 (E4 continuation excluded)
    expect(entries[1].midiPitches).toEqual([60]);
  });
});
