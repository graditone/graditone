import { describe, it, expect } from 'vitest';
import { convertScoreToLayoutFormat } from './LayoutView';
import type { Score } from '../../types/score';

/**
 * Regression guard for the convertScoreToLayoutFormat whitelist.
 *
 * This function is a manual field-by-field mapper: every optional Note field
 * must be explicitly spread into the layout-engine input.  If a new field is
 * added to the Rust domain model and the TypeScript Note type but NOT added
 * to the spread list, data is silently dropped and the WASM layout engine
 * never sees it.
 *
 * BUG HISTORY:
 *  - 2026-03: `fingering` field was parsed by Rust, serialised to TS Score,
 *    but never forwarded by convertScoreToLayoutFormat → fingering glyphs
 *    were always empty in the browser.
 *
 * HOW TO USE THIS TEST:
 *  When you add a new optional field to the Note interface in score.ts AND
 *  forward it in convertScoreToLayoutFormat, add it to the "fully populated
 *  note" fixture below and assert it appears in the output.
 */

/** Helper: builds a minimal Score wrapping the given notes. */
function wrapNotes(notes: Record<string, unknown>[]): Score {
  return {
    id: 'test-score',
    schema_version: 9,
    global_structural_events: [
      { TimeSignature: { tick: 0, numerator: 4, denominator: 4 } },
    ],
    instruments: [
      {
        id: 'piano',
        name: 'Piano',
        instrument_type: 'Piano',
        staves: [
          {
            id: 'staff-1',
            active_clef: 'Treble',
            staff_structural_events: [],
            voices: [
              {
                id: 'voice-1',
                interval_events: notes as Score['instruments'][0]['staves'][0]['voices'][0]['interval_events'],
                rest_events: [],
              },
            ],
          },
        ],
      },
    ],
    repeat_barlines: [],
    volta_brackets: [],
    pickup_ticks: 0,
    measure_end_ticks: [],
  };
}

describe('convertScoreToLayoutFormat — note field forwarding', () => {
  /**
   * MASTER TEST: A single note populated with EVERY optional field.
   * If any field is missing from convertScoreToLayoutFormat's whitelist,
   * this test will fail — catching the exact class of silent-drop bug.
   */
  it('forwards all optional Note fields to layout engine', () => {
    const fullyPopulatedNote = {
      id: 'note-1',
      start_tick: 0,
      duration_ticks: 960,
      pitch: 60,
      spelling: { step: 'C', alter: 0, octave: 4 },
      beams: [{ number: 1, beam_type: 'Begin' }],
      staccato: true,
      dot_count: 1,
      tie_next: 'note-2',
      is_tie_continuation: true,
      slur_next: 'note-3',
      slur_above: true,
      is_grace: true,
      has_explicit_accidental: true,
      stem_down: true,
      fingering: [{ digit: 3, above: true }],
    };

    const score = wrapNotes([fullyPopulatedNote]);
    const result = convertScoreToLayoutFormat(score);
    const outputNote = result.instruments[0].staves[0].voices[0].notes[0];

    // Core fields (always present)
    expect(outputNote).toHaveProperty('tick', 0);
    expect(outputNote).toHaveProperty('duration', 960);
    expect(outputNote).toHaveProperty('pitch', 60);
    expect(outputNote).toHaveProperty('spelling');

    // Beam annotations
    expect(outputNote).toHaveProperty('beams');
    expect(outputNote.beams).toEqual([{ number: 1, beam_type: 'Begin' }]);

    // Articulation markers
    expect(outputNote).toHaveProperty('staccato', true);
    expect(outputNote).toHaveProperty('dot_count', 1);

    // Tie chain data
    expect(outputNote).toHaveProperty('id', 'note-1');
    expect(outputNote).toHaveProperty('tie_next', 'note-2');
    expect(outputNote).toHaveProperty('is_tie_continuation', true);

    // Slur chain data
    expect(outputNote).toHaveProperty('slur_next', 'note-3');
    expect(outputNote).toHaveProperty('slur_above', true);

    // Grace note flag
    expect(outputNote).toHaveProperty('is_grace', true);

    // Accidental flag
    expect(outputNote).toHaveProperty('has_explicit_accidental', true);

    // MusicXML <stem> direction forwarded for borderline-heuristic cases
    expect(outputNote).toHaveProperty('stem_down', true);

    // Fingering annotations (the field that caused the 2026-03 bug)
    expect(outputNote).toHaveProperty('fingering');
    expect(outputNote.fingering).toEqual([{ digit: 3, above: true }]);
  });

  it('omits optional fields when absent on the source note', () => {
    const bareNote = {
      id: 'bare-1',
      start_tick: 0,
      duration_ticks: 960,
      pitch: 64,
    };

    const score = wrapNotes([bareNote]);
    const result = convertScoreToLayoutFormat(score);
    const outputNote = result.instruments[0].staves[0].voices[0].notes[0];

    // Core fields must still be present
    expect(outputNote).toHaveProperty('tick', 0);
    expect(outputNote).toHaveProperty('duration', 960);
    expect(outputNote).toHaveProperty('pitch', 64);

    // Optional fields must NOT be present (no phantom defaults)
    expect(outputNote).not.toHaveProperty('beams');
    expect(outputNote).not.toHaveProperty('staccato');
    expect(outputNote).not.toHaveProperty('dot_count');
    expect(outputNote).not.toHaveProperty('tie_next');
    expect(outputNote).not.toHaveProperty('is_tie_continuation');
    expect(outputNote).not.toHaveProperty('slur_next');
    expect(outputNote).not.toHaveProperty('slur_above');
    expect(outputNote).not.toHaveProperty('is_grace');
    expect(outputNote).not.toHaveProperty('has_explicit_accidental');
    expect(outputNote).not.toHaveProperty('stem_down');
    expect(outputNote).not.toHaveProperty('fingering');
  });

  it('forwards multiple fingering annotations for stacking', () => {
    const chordNote = {
      id: 'chord-1',
      start_tick: 0,
      duration_ticks: 960,
      pitch: 60,
      fingering: [
        { digit: 1, above: true },
        { digit: 5, above: true },
      ],
    };

    const score = wrapNotes([chordNote]);
    const result = convertScoreToLayoutFormat(score);
    const outputNote = result.instruments[0].staves[0].voices[0].notes[0];

    expect(outputNote.fingering).toHaveLength(2);
    expect(outputNote.fingering).toEqual([
      { digit: 1, above: true },
      { digit: 5, above: true },
    ]);
  });

  it('forwards slur_above=false (not just truthy values)', () => {
    const noteBelow = {
      id: 'below-1',
      start_tick: 0,
      duration_ticks: 960,
      pitch: 60,
      slur_next: 'below-2',
      slur_above: false,
    };

    const score = wrapNotes([noteBelow]);
    const result = convertScoreToLayoutFormat(score);
    const outputNote = result.instruments[0].staves[0].voices[0].notes[0];

    expect(outputNote).toHaveProperty('slur_above', false);
  });
});
