/**
 * Unit tests for TieResolver — Feature 051 (T015)
 *
 * Tests that resolveTiedNotes() correctly merges tied note chains
 * into single ResolvedNote entries with combined durations.
 */

import { describe, it, expect } from 'vitest';
import { resolveTiedNotes } from '../../src/services/playback/TieResolver';
import type { Note } from '../../src/types/score';

function makeNote(overrides: Partial<Note> & { id: string; pitch: number; start_tick: number; duration_ticks: number }): Note {
  return {
    ...overrides,
  } as Note;
}

describe('TieResolver', () => {
  it('merges two tied quarter notes into one with combined duration', () => {
    const notes: Note[] = [
      makeNote({ id: 'n1', pitch: 60, start_tick: 0, duration_ticks: 240, tie_next: 'n2' }),
      makeNote({ id: 'n2', pitch: 60, start_tick: 240, duration_ticks: 240, is_tie_continuation: true }),
    ];

    const resolved = resolveTiedNotes(notes);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe('n1');
    expect(resolved[0].combinedDurationTicks).toBe(480);
    expect(resolved[0].pitch).toBe(60);
  });

  it('merges a 3-note tie chain into one with sum of all durations', () => {
    const notes: Note[] = [
      makeNote({ id: 'n1', pitch: 64, start_tick: 0, duration_ticks: 240, tie_next: 'n2' }),
      makeNote({ id: 'n2', pitch: 64, start_tick: 240, duration_ticks: 240, tie_next: 'n3', is_tie_continuation: true }),
      makeNote({ id: 'n3', pitch: 64, start_tick: 480, duration_ticks: 240, is_tie_continuation: true }),
    ];

    const resolved = resolveTiedNotes(notes);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].combinedDurationTicks).toBe(720);
  });

  it('handles chord with partial tie: tied pitch merges, untied pass through', () => {
    const notes: Note[] = [
      makeNote({ id: 'c1', pitch: 60, start_tick: 0, duration_ticks: 480 }), // C4, no tie
      makeNote({ id: 'e1', pitch: 64, start_tick: 0, duration_ticks: 480, tie_next: 'e2' }), // E4, tied
      makeNote({ id: 'g1', pitch: 67, start_tick: 0, duration_ticks: 480 }), // G4, no tie
      makeNote({ id: 'c2', pitch: 60, start_tick: 480, duration_ticks: 480 }), // C4, no tie
      makeNote({ id: 'e2', pitch: 64, start_tick: 480, duration_ticks: 480, is_tie_continuation: true }), // E4, continuation
      makeNote({ id: 'g2', pitch: 67, start_tick: 480, duration_ticks: 480 }), // G4, no tie
    ];

    const resolved = resolveTiedNotes(notes);

    // Should produce 5 notes: C4, E4 (merged), G4, C4, G4
    // E4_continuation is filtered out, E4_start gets combined duration
    expect(resolved).toHaveLength(5);

    const mergedE = resolved.find(n => n.id === 'e1')!;
    expect(mergedE.combinedDurationTicks).toBe(960);

    // E4 continuation should not be in the result
    expect(resolved.find(n => n.id === 'e2')).toBeUndefined();
  });

  it('passes through untied notes unchanged', () => {
    const notes: Note[] = [
      makeNote({ id: 'n1', pitch: 60, start_tick: 0, duration_ticks: 480 }),
      makeNote({ id: 'n2', pitch: 62, start_tick: 480, duration_ticks: 480 }),
    ];

    const resolved = resolveTiedNotes(notes);

    expect(resolved).toHaveLength(2);
    expect(resolved[0].combinedDurationTicks).toBe(480);
    expect(resolved[1].combinedDurationTicks).toBe(480);
  });
});
