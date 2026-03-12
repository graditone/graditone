// RepeatNoteExpander unit tests — Feature 047: Volta Bracket Playback
//
// Tests US1 (first-ending skip) and SC-004 (backward compat regression guard).

import { describe, it, expect } from 'vitest';
import { expandNotesWithRepeats } from './RepeatNoteExpander';
import type { Note, RepeatBarline, VoltaBracket } from '../../types/score';

// Helper: create a note at a given tick with a unique id
function makeNote(tick: number, id?: string): Note {
  return {
    id: id ?? `n-${tick}`,
    start_tick: tick,
    duration_ticks: 480,
    pitch: { octave: 4, step: 'C', alter: 0 },
  } as Note;
}

// Helper: build repeat barlines for a simple section (start at startTick, end at endTick)
function simpleRepeatBarlines(startTick: number, endTick: number, measureDuration: number): RepeatBarline[] {
  return [
    {
      measure_index: Math.floor(startTick / measureDuration),
      start_tick: startTick,
      end_tick: startTick + measureDuration,
      barline_type: 'Start',
    },
    {
      measure_index: Math.floor((endTick - measureDuration) / measureDuration),
      start_tick: endTick - measureDuration,
      end_tick: endTick,
      barline_type: 'End',
    },
  ];
}

describe('expandNotesWithRepeats', () => {
  describe('without volta brackets (pre-feature behavior)', () => {
    it('should return notes unchanged when no repeat barlines', () => {
      const notes = [makeNote(0), makeNote(960), makeNote(1920)];
      const result = expandNotesWithRepeats(notes, undefined);
      expect(result).toEqual(notes);
    });

    it('SC-004: should produce identical output when voltaBrackets is undefined', () => {
      // Simple repeated section: measures 0–3 (ticks 0–3840, 960 tick measures)
      const measureDur = 960;
      const repeatBarlines: RepeatBarline[] = [
        { measure_index: 0, start_tick: 0, end_tick: measureDur, barline_type: 'Start' },
        { measure_index: 3, start_tick: 3 * measureDur, end_tick: 4 * measureDur, barline_type: 'End' },
      ];
      const notes = [
        makeNote(0, 'm0'), makeNote(960, 'm1'), makeNote(1920, 'm2'), makeNote(2880, 'm3'),
      ];

      const withoutVolta = expandNotesWithRepeats(notes, repeatBarlines);
      const withUndefinedVolta = expandNotesWithRepeats(notes, repeatBarlines, undefined);

      // Both should produce the same result — 8 notes (4 × 2 passes)
      expect(withUndefinedVolta).toEqual(withoutVolta);
      expect(withUndefinedVolta.length).toBe(8);
    });
  });

  describe('US1: first-ending skip on second pass', () => {
    // Setup: 4 measures repeated, measure 3 (index 3) is first ending
    // Measures at 960 ticks each: m0=0, m1=960, m2=1920, m3=2880
    // Section: tick 0 - 3840 (start repeat at m0, end repeat at m3)
    // First ending bracket: measure 3, ticks 2880–3840
    const measureDur = 960;
    const sectionEnd = 4 * measureDur; // 3840

    const repeatBarlines: RepeatBarline[] = [
      { measure_index: 0, start_tick: 0, end_tick: measureDur, barline_type: 'Start' },
      { measure_index: 3, start_tick: 2880, end_tick: sectionEnd, barline_type: 'End' },
    ];

    const voltaBrackets: VoltaBracket[] = [
      {
        number: 1,
        start_measure_index: 3,
        end_measure_index: 3,
        start_tick: 2880,
        end_tick: 3840,
        end_type: 'Stop',
      },
    ];

    const notes = [
      makeNote(0, 'm0'), makeNote(960, 'm1'), makeNote(1920, 'm2'), makeNote(2880, 'm3'),
    ];

    it('should include first-ending notes on the first pass', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      // First pass should include m3 (at tick 2880)
      const firstPassNotes = result.filter(n => !n.id.includes('-r'));
      const hasFE = firstPassNotes.some(n => n.id === 'm3');
      expect(hasFE).toBe(true);
    });

    it('should skip first-ending notes on the second pass', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      // Second pass notes have '-r1' suffix
      const secondPassNotes = result.filter(n => n.id.includes('-r'));
      // m3 should NOT appear in the second pass
      const hasFE = secondPassNotes.some(n => n.id.includes('m3'));
      expect(hasFE).toBe(false);
    });

    it('should produce correct total note count (7 notes: 4 first pass + 3 second pass)', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      // First pass: m0, m1, m2, m3 (4 notes)
      // Second pass: m0, m1, m2 (3 notes — m3 skipped)
      expect(result.length).toBe(7);
    });

    it('should correctly position notes after first-ending compression', () => {
      // After the section, add a trailing note at tick 3840
      const trailingNote = makeNote(3840, 'trail');
      const notesWithTrail = [...notes, trailingNote];
      const result = expandNotesWithRepeats(notesWithTrail, repeatBarlines, voltaBrackets);
      // Trail should be offset by sectionDuration (3840) minus first-ending duration (960) = 2880
      // Original tick 3840 + offset 2880+3840 = ... let's just check it exists
      const trail = result.find(n => n.id === 'trail');
      expect(trail).toBeDefined();
      // The trail is after the repeated section. The 2 passes produce:
      // Pass 0: 3840 ticks of content
      // Pass 1: 2880 ticks of content (m3 skipped = 960 less)
      // Total section output ticks: 3840 + 2880 = 6720
      // Trail original tick is 3840. Offset should be: sectionDuration - feDur = 3840 - 960 = 2880
      // So trail plays at 3840 + 2880 = 6720
      expect(trail!.start_tick).toBe(6720);
    });
  });

  describe('US1: multi-measure first ending', () => {
    // Section: measures 0–5 (6 measures, 960 ticks each), first ending spans m4–m5
    const measureDur = 960;
    const sectionEnd = 6 * measureDur; // 5760

    const repeatBarlines: RepeatBarline[] = [
      { measure_index: 0, start_tick: 0, end_tick: measureDur, barline_type: 'Start' },
      { measure_index: 5, start_tick: 5 * measureDur, end_tick: sectionEnd, barline_type: 'End' },
    ];

    const voltaBrackets: VoltaBracket[] = [
      {
        number: 1,
        start_measure_index: 4,
        end_measure_index: 5,
        start_tick: 4 * measureDur, // 3840
        end_tick: 6 * measureDur,   // 5760
        end_type: 'Stop',
      },
    ];

    const notes = [
      makeNote(0, 'm0'), makeNote(960, 'm1'), makeNote(1920, 'm2'),
      makeNote(2880, 'm3'), makeNote(3840, 'm4'), makeNote(4800, 'm5'),
    ];

    it('should skip all measures under a multi-measure first-ending on second pass', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      const secondPassNotes = result.filter(n => n.id.includes('-r'));
      // m4 and m5 should NOT appear in second pass
      const hasM4 = secondPassNotes.some(n => n.id.includes('m4'));
      const hasM5 = secondPassNotes.some(n => n.id.includes('m5'));
      expect(hasM4).toBe(false);
      expect(hasM5).toBe(false);
      // Second pass should have 4 notes (m0–m3 only)
      expect(secondPassNotes.length).toBe(4);
    });
  });

  describe('US2: second-ending plays on second pass', () => {
    // Section: measures 0–4 (5 measures, 960 ticks each)
    // First ending: measure 3 (ticks 2880–3840)
    // Second ending: measure 4 (ticks 3840–4800)
    // End-repeat barline is on the first-ending measure (m3)
    const measureDur = 960;
    const sectionEnd = 4 * measureDur; // 3840 (end-repeat at end of m3)

    const repeatBarlines: RepeatBarline[] = [
      { measure_index: 0, start_tick: 0, end_tick: measureDur, barline_type: 'Start' },
      { measure_index: 3, start_tick: 2880, end_tick: sectionEnd, barline_type: 'End' },
    ];

    const voltaBrackets: VoltaBracket[] = [
      {
        number: 1,
        start_measure_index: 3,
        end_measure_index: 3,
        start_tick: 2880,
        end_tick: 3840,
        end_type: 'Stop',
      },
      {
        number: 2,
        start_measure_index: 4,
        end_measure_index: 4,
        start_tick: 3840,
        end_tick: 4800,
        end_type: 'Stop',
      },
    ];

    const notes = [
      makeNote(0, 'm0'), makeNote(960, 'm1'), makeNote(1920, 'm2'),
      makeNote(2880, 'm3-1st'), makeNote(3840, 'm4-2nd'),
    ];

    it('should include second-ending notes on the second pass at correct ticks', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      // The second-ending note (m4-2nd at tick 3840) is after the section,
      // so it's passed through with tickOffset.
      // After the section: offset = sectionDuration - feDur = 3840 - 960 = 2880
      // So m4-2nd plays at 3840 + 2880 = 6720
      const secondEndingNote = result.find(n => n.id === 'm4-2nd');
      expect(secondEndingNote).toBeDefined();
      expect(secondEndingNote!.start_tick).toBe(6720);
    });

    it('should not duplicate second-ending notes', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      const secondEndingNotes = result.filter(n => n.id.includes('m4-2nd'));
      // Second ending note should appear exactly once (it's after the section)
      expect(secondEndingNotes.length).toBe(1);
    });

    it('should not include first-ending on second pass', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      const secondPassNotes = result.filter(n => n.id.includes('-r'));
      const hasFE = secondPassNotes.some(n => n.id.includes('m3-1st'));
      expect(hasFE).toBe(false);
    });

    it('discontinue end-type should not trigger extra jump', () => {
      const discontinueBrackets: VoltaBracket[] = [
        { ...voltaBrackets[0] },
        { ...voltaBrackets[1], end_type: 'Discontinue' },
      ];
      const result = expandNotesWithRepeats(notes, repeatBarlines, discontinueBrackets);
      // Same count as with Stop — the end_type doesn't affect playback logic
      const resultStop = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      expect(result.length).toBe(resultStop.length);
    });
  });

  describe('SC-001: La Candeur 38-measure expansion', () => {
    // La Candeur structure: 23 raw measures in 4/4 at 960 PPQ (3840 ticks/measure)
    // Repeat barlines: end at m8 (idx 7), start at m9 (idx 8), end at m16 (idx 15)
    // Volta bracket: ending 1 at m16 (idx 15), stop
    //
    // Expected playback:
    //   Section 1 (idx 0–7):  pass 1 = 8 measures, pass 2 = 8 measures → 16
    //   Section 2 (idx 8–15): pass 1 = 8 measures, pass 2 = 7 measures (skip idx 15) → 15
    //   Tail (idx 16–22):     7 measures → 7
    //   Total: 16 + 15 + 7 = 38

    const measureDur = 3840;

    const repeatBarlines: RepeatBarline[] = [
      { measure_index: 7, start_tick: 7 * measureDur, end_tick: 8 * measureDur, barline_type: 'End' },
      { measure_index: 8, start_tick: 8 * measureDur, end_tick: 9 * measureDur, barline_type: 'Start' },
      { measure_index: 15, start_tick: 15 * measureDur, end_tick: 16 * measureDur, barline_type: 'End' },
    ];

    const voltaBrackets: VoltaBracket[] = [
      {
        number: 1,
        start_measure_index: 15,
        end_measure_index: 15,
        start_tick: 15 * measureDur,
        end_tick: 16 * measureDur,
        end_type: 'Stop',
      },
    ];

    // One synthetic note per raw measure
    const notes: Note[] = Array.from({ length: 23 }, (_, i) =>
      makeNote(i * measureDur, `m${i}`)
    );

    it('should expand to exactly 38 notes', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      expect(result.length).toBe(38);
    });

    it('should have monotonically increasing start_ticks', () => {
      const result = expandNotesWithRepeats(notes, repeatBarlines, voltaBrackets);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].start_tick).toBeGreaterThanOrEqual(result[i - 1].start_tick);
      }
    });
  });
});
