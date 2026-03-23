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
import { mergePracticeNotesByTick } from '../../plugins/practice-view-plugin/mergePracticeNotesByTick';

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

  it('preserves per-staff durationTicks after merge (no cross-staff truncation)', () => {
    // Bass whole note dur=1920 merged at tick 0; next merged onset at tick 240
    // Per-staff truncation already happened in extractPracticeNotes.
    // The merge must NOT re-truncate using cross-staff onsets.
    const treble: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [79], sustainedPitches: [], noteIds: ['t1'], durationTicks: 240 },
      { tick: 240, midiPitches: [76], sustainedPitches: [], noteIds: ['t2'], durationTicks: 240 },
    ];
    const bass: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48, 52, 55], sustainedPitches: [], noteIds: ['b1', 'b2', 'b3'], durationTicks: 1920 },
    ];

    const merged = mergePracticeNotesByTick([...treble, ...bass]);

    // Tick 0 durationTicks should be max(240, 1920) = 1920 (per-staff durations preserved)
    expect(merged[0].durationTicks).toBe(1920);
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

    // At tick 240: E5 is onset, bass chord is sustained, G5 is NOT sustained
    // (G5 eighth note dur=240 ends exactly at tick 240, so it should not carry)
    expect(merged[1].tick).toBe(240);
    expect(merged[1].midiPitches).toEqual([76]);
    expect(merged[1].sustainedPitches).toEqual(expect.arrayContaining([48, 52, 55]));
    expect(merged[1].sustainedPitches).not.toContain(79); // G5 NOT sustained

    // At tick 480: D5 is onset, bass chord is sustained, G5 still not sustained
    expect(merged[2].tick).toBe(480);
    expect(merged[2].midiPitches).toEqual([74]);
    expect(merged[2].sustainedPitches).toEqual(expect.arrayContaining([48, 52, 55]));
    expect(merged[2].sustainedPitches).not.toContain(79); // G5 NOT sustained
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

  // ─── Feature 053: Bug 1 & 2 regression tests ────────────────────────────

  it('[US1] BH merged LH half-note retains per-staff duration, not cross-staff gap', () => {
    // LH half-note (dur=480) at tick 0, RH quarter-note (dur=240) at tick 0, RH quarter at tick 240.
    // Per-staff: LH next onset is at tick 480 (no LH note at 240), so LH duration stays 480.
    // BH merge: next merged onset is at tick 240 (RH). Bug: second truncation cuts LH to 240.
    // Expected: LH half-note duration stays 480 (its per-staff value), not 240 (cross-staff).
    const lh: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48], sustainedPitches: [], noteIds: ['lh1'], durationTicks: 480 },
      { tick: 480, midiPitches: [50], sustainedPitches: [], noteIds: ['lh2'], durationTicks: 480 },
    ];
    const rh: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [72], sustainedPitches: [], noteIds: ['rh1'], durationTicks: 240 },
      { tick: 240, midiPitches: [74], sustainedPitches: [], noteIds: ['rh2'], durationTicks: 240 },
      { tick: 480, midiPitches: [76], sustainedPitches: [], noteIds: ['rh3'], durationTicks: 240 },
    ];

    const merged = mergePracticeNotesByTick([...lh, ...rh]);

    // Tick 0 merged entry has both LH+RH pitches. Duration should be max(480, 240) = 480
    // NOT truncated to 240 by a second cross-staff gap truncation.
    expect(merged[0].tick).toBe(0);
    expect(merged[0].durationTicks).toBe(480);
  });

  it('[US2] BH cross-barline LH chord retains full multi-measure duration', () => {
    // LH chord spans M3-M4: tick 1920, duration 1920 (two measures at 960 PPQ).
    // RH has onsets at tick 1920 (dur=480) and tick 2400 (dur=480).
    // Per-staff: LH next onset is at tick 3840 (next LH entry), so LH duration stays 1920.
    // BH merge: next merged onset is at tick 2400 (RH). Bug: second truncation cuts LH to 480.
    const lh: PluginPracticeNoteEntry[] = [
      { tick: 1920, midiPitches: [48, 52, 55], sustainedPitches: [], noteIds: ['lh-m3a', 'lh-m3b', 'lh-m3c'], durationTicks: 1920 },
      { tick: 3840, midiPitches: [50], sustainedPitches: [], noteIds: ['lh-m5'], durationTicks: 960 },
    ];
    const rh: PluginPracticeNoteEntry[] = [
      { tick: 1920, midiPitches: [79], sustainedPitches: [], noteIds: ['rh-m3'], durationTicks: 480 },
      { tick: 2400, midiPitches: [76], sustainedPitches: [], noteIds: ['rh-m3b'], durationTicks: 480 },
      { tick: 2880, midiPitches: [74], sustainedPitches: [], noteIds: ['rh-m4'], durationTicks: 480 },
      { tick: 3360, midiPitches: [72], sustainedPitches: [], noteIds: ['rh-m4b'], durationTicks: 480 },
    ];

    const merged = mergePracticeNotesByTick([...lh, ...rh]);

    // Tick 1920 merged entry has LH chord + RH note. Duration should be max(1920, 480) = 1920.
    // NOT truncated to 480 by a second cross-staff gap truncation.
    const m3Entry = merged.find(e => e.tick === 1920)!;
    expect(m3Entry).toBeDefined();
    expect(m3Entry.durationTicks).toBe(1920);
  });

  it('[US1] LH-only mode durations are unaffected by the BH merge path (regression)', () => {
    // Single-staff input (LH only): durations should pass through unchanged.
    // This guards against over-correcting the merge logic.
    const lhOnly: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48], sustainedPitches: [], noteIds: ['lh1'], durationTicks: 480 },
      { tick: 480, midiPitches: [50], sustainedPitches: [], noteIds: ['lh2'], durationTicks: 960 },
      { tick: 1440, midiPitches: [52], sustainedPitches: [], noteIds: ['lh3'], durationTicks: 480 },
    ];

    const merged = mergePracticeNotesByTick(lhOnly);

    expect(merged).toHaveLength(3);
    expect(merged[0].durationTicks).toBe(480); // gap to next = 480, same as original
    expect(merged[1].durationTicks).toBe(960); // gap to next = 960, same as original
    expect(merged[2].durationTicks).toBe(480); // last entry, no truncation
  });

  it('[US4] LH note at tick T with long duration appears in sustainedPitches at T+240', () => {
    // LH half-note (dur=480) at tick 0. RH quarter (dur=240) at tick 0, RH quarter at tick 240.
    // At tick 240, the LH note (tick 0 + dur 480 = end at tick 480) is still sounding.
    // So LH pitch should be in sustainedPitches at tick 240, NOT in midiPitches.
    const lh: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [48], sustainedPitches: [], noteIds: ['lh1'], durationTicks: 480 },
    ];
    const rh: PluginPracticeNoteEntry[] = [
      { tick: 0, midiPitches: [72], sustainedPitches: [], noteIds: ['rh1'], durationTicks: 240 },
      { tick: 240, midiPitches: [74], sustainedPitches: [], noteIds: ['rh2'], durationTicks: 240 },
    ];

    const merged = mergePracticeNotesByTick([...lh, ...rh]);

    // At tick 240: RH E5 is onset, LH C3 should be sustained (still within its 480-tick window)
    const entry240 = merged.find(e => e.tick === 240)!;
    expect(entry240).toBeDefined();
    expect(entry240.midiPitches).toEqual([74]); // Only RH note as onset
    expect(entry240.sustainedPitches).toContain(48); // LH C3 sustained
    expect(entry240.midiPitches).not.toContain(48); // LH C3 NOT in onset pitches
  });
});
