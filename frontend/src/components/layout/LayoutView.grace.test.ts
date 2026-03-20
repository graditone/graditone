import { describe, it, expect } from 'vitest';
import { convertScoreToLayoutFormat } from './LayoutView';
import type { Score } from '../../types/score';

/**
 * T109: Grace notes must be forwarded to the WASM layout engine via is_grace flag.
 * Without this flag, the layout engine treats grace notes as normal notes,
 * rendering them at full width instead of 75% size.
 */
describe('convertScoreToLayoutFormat grace note forwarding', () => {
  it('forwards is_grace flag for grace notes', () => {
    const score: Score = {
      id: 'test-score',
      schema_version: 7,
      global_structural_events: [
        { TimeSignature: { tick: 0, numerator: 3, denominator: 8 } },
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
                  interval_events: [
                    {
                      id: 'grace-1',
                      start_tick: 24000,
                      duration_ticks: 60,
                      pitch: 65, // F4
                      is_grace: true,
                    },
                    {
                      id: 'grace-2',
                      start_tick: 24060,
                      duration_ticks: 60,
                      pitch: 69, // A4
                      is_grace: true,
                    },
                    {
                      id: 'normal-1',
                      start_tick: 24120,
                      duration_ticks: 960,
                      pitch: 72, // C5
                    },
                  ],
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

    const result = convertScoreToLayoutFormat(score);
    const notes = result.instruments[0].staves[0].voices[0].notes;

    // Grace notes must have is_grace: true
    expect(notes[0]).toHaveProperty('is_grace', true);
    expect(notes[1]).toHaveProperty('is_grace', true);
    // Normal note must NOT have is_grace
    expect(notes[2]).not.toHaveProperty('is_grace');
  });
});
