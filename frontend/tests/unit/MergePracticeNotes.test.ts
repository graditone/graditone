/**
 * Unit tests for mergePracticeNotesByTick — Feature 050 (Both Clefs bug)
 *
 * Tests that merging notes from multiple staves:
 * 1. Fuses entries at the same tick
 * 2. Propagates sustained notes from long-duration entries to later ticks
 * 3. Truncates durationTicks to the gap before the next onset
 */

import { describe, it, expect } from 'vitest';
import type { PluginPracticeNoteEntry } from '../../src/plugin-api/types';
import { mergePracticeNotesByTick } from '../../plugins/practice-view-plugin/PracticeViewPlugin';

describe('mergePracticeNotesByTick (Both Clefs)', () => {
  it('fuses entries from different staves at the same tick', () => {
    // Treble staff: G5 (MIDI 79) at tick 0, dur=240
    // Bass staff:   C3+E3+G3 (MIDI 48,52,55) chord at tick 0, dur=1920
    const treble: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [79], sustainedPitches: [], noteIds: ['t1'], durationTicks: 240 },
      { tick: 240, midiPitches: [76], sustainedPitches: [], noteIds: ['t2'], durationTicks: 240 },
      { tick: 480, midiPitches: [74], sustainedPitches: [], noteIds: ['t3'], durationTicks: 240 },
    ];
    const bass: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48, 52, 55], sustainedPitches: [], noteIds: ['b1', 'b2', 'b3'], durationTicks: 1920 },
    ];

    const merged = mergePracticeNotesByTick([...treble, ...bass]);

    // Tick 0 should contain all pitches from both staves
    expect(merged[0].tick).toBe(0);
    expect(merged[0].midiPitches).toEqual(expect.arrayContaining([79, 48, 52, 55]));
    expect(merged[0].midiPitches).toHaveLength(4);
  });

  it('truncates durationTicks to gap before next onset after merge', () => {
    // Bass whole note dur=1920 merged at tick 0; next onset at tick 240
    // → merged tick 0 duration should be capped to 240
    const treble: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [79], sustainedPitches: [], noteIds: ['t1'], durationTicks: 240 },
      { tick: 240, midiPitches: [76], sustainedPitches: [], noteIds: ['t2'], durationTicks: 240 },
    ];
    const bass: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48, 52, 55], sustainedPitches: [], noteIds: ['b1', 'b2', 'b3'], durationTicks: 1920 },
    ];

    const merged = mergePracticeNotesByTick([...treble, ...bass]);

    // Tick 0 durationTicks should be 240 (gap to tick 240), NOT 1920
    expect(merged[0].durationTicks).toBe(240);
  });

  it('propagates cross-staff sustained pitches to later onsets', () => {
    // Bass chord C3+E3+G3 at tick 0, dur=1920 (whole note in 4/4)
    // Treble: G5 at tick 0 dur=240, E5 at tick 240 dur=240, D5 at tick 480 dur=240
    // → Bass chord should appear as sustainedPitches at tick 240 and tick 480
    const treble: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [79], sustainedPitches: [], noteIds: ['t1'], durationTicks: 240 },
      { tick: 240, midiPitches: [76], sustainedPitches: [], noteIds: ['t2'], durationTicks: 240 },
      { tick: 480, midiPitches: [74], sustainedPitches: [], noteIds: ['t3'], durationTicks: 240 },
    ];
    const bass: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48, 52, 55], sustainedPitches: [], noteIds: ['b1', 'b2', 'b3'], durationTicks: 1920 },
    ];

    const merged = mergePracticeNotesByTick([...treble, ...bass]);

    // At tick 240: E5 is onset, bass chord is sustained
    expect(merged[1].tick).toBe(240);
    expect(merged[1].midiPitches).toEqual([76]);
    expect(merged[1].sustainedPitches).toEqual(expect.arrayContaining([48, 52, 55]));

    // At tick 480: D5 is onset, bass chord is sustained
    expect(merged[2].tick).toBe(480);
    expect(merged[2].midiPitches).toEqual([74]);
    expect(merged[2].sustainedPitches).toEqual(expect.arrayContaining([48, 52, 55]));
  });

  it('does not duplicate onset pitches in sustainedPitches', () => {
    // If a pitch appears in both onset and sustained, it should only be in onset
    const entries: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [60, 64], sustainedPitches: [], noteIds: ['a', 'b'], durationTicks: 480 },
      { tick: 240, midiPitches: [60], sustainedPitches: [], noteIds: ['c'], durationTicks: 240 },
    ];

    const merged = mergePracticeNotesByTick(entries);

    // At tick 240: 60 is onset (re-attacked), 64 sustained from prior entry
    // 60 should NOT be in sustainedPitches since it's in midiPitches
    expect(merged[1].midiPitches).toEqual([60]);
    expect(merged[1].sustainedPitches).not.toContain(60);
    expect(merged[1].sustainedPitches).toContain(64);
  });

  it('handles empty input', () => {
    expect(mergePracticeNotesByTick([])).toEqual([]);
  });

  it('handles single-staff input (no cross-staff merge needed)', () => {
    const notes: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [60], sustainedPitches: [], noteIds: ['n1'], durationTicks: 480 },
      { tick: 480, midiPitches: [62], sustainedPitches: [], noteIds: ['n2'], durationTicks: 480 },
    ];

    const merged = mergePracticeNotesByTick(notes);

    expect(merged).toHaveLength(2);
    expect(merged[0].tick).toBe(0);
    expect(merged[0].durationTicks).toBe(480); // gap = 480, same as original
    expect(merged[1].tick).toBe(480);
  });
});
