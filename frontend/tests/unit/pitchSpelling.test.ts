/**
 * Tests for buildSpellingTable — ensures correct enharmonic spelling
 * of MIDI pitch classes given a key signature (fifths value).
 *
 * Key insight: in flat keys, certain pitch classes must be spelled as flats
 * (e.g. pc 10 = Bb not A# in F major). In sharp keys, sharps are already
 * the default spelling so no changes are needed.
 */
import { describe, it, expect } from 'vitest';
import { buildSpellingTable } from '../../src/plugin-api/pitchSpelling';

describe('buildSpellingTable', () => {
  // ── C major (0 fifths) ──────────────────────────────────────────────────
  it('C major: all naturals + default sharp spelling for chromatic notes', () => {
    const t = buildSpellingTable(0);
    expect(t[0]).toEqual({ step: 'C', alter: 0 });   // C
    expect(t[1]).toEqual({ step: 'C', alter: 1 });   // C#
    expect(t[2]).toEqual({ step: 'D', alter: 0 });   // D
    expect(t[3]).toEqual({ step: 'D', alter: 1 });   // D#
    expect(t[4]).toEqual({ step: 'E', alter: 0 });   // E
    expect(t[5]).toEqual({ step: 'F', alter: 0 });   // F
    expect(t[6]).toEqual({ step: 'F', alter: 1 });   // F#
    expect(t[7]).toEqual({ step: 'G', alter: 0 });   // G
    expect(t[8]).toEqual({ step: 'G', alter: 1 });   // G#
    expect(t[9]).toEqual({ step: 'A', alter: 0 });   // A
    expect(t[10]).toEqual({ step: 'A', alter: 1 });  // A# (no flat key context)
    expect(t[11]).toEqual({ step: 'B', alter: 0 });  // B
  });

  // ── G major (1♯ = F#) ──────────────────────────────────────────────────
  it('G major: F# is default sharp spelling, already correct', () => {
    const t = buildSpellingTable(1);
    expect(t[6]).toEqual({ step: 'F', alter: 1 });  // F# (in key sig)
    expect(t[5]).toEqual({ step: 'F', alter: 0 });  // F natural
  });

  // ── D major (2♯ = F#, C#) ──────────────────────────────────────────────
  it('D major: F# and C# default spelling correct', () => {
    const t = buildSpellingTable(2);
    expect(t[6]).toEqual({ step: 'F', alter: 1 });  // F#
    expect(t[1]).toEqual({ step: 'C', alter: 1 });  // C#
  });

  // ── F major (1♭ = Bb) ──────────────────────────────────────────────────
  it('F major: pc 10 is spelled as Bb (not A#)', () => {
    const t = buildSpellingTable(-1);
    expect(t[10]).toEqual({ step: 'B', alter: -1 });  // Bb
    // Other notes remain unchanged
    expect(t[9]).toEqual({ step: 'A', alter: 0 });    // A natural
    expect(t[11]).toEqual({ step: 'B', alter: 0 });   // B natural
  });

  // ── Bb major (2♭ = Bb, Eb) ─────────────────────────────────────────────
  it('Bb major: pc 10 = Bb, pc 3 = Eb', () => {
    const t = buildSpellingTable(-2);
    expect(t[10]).toEqual({ step: 'B', alter: -1 });  // Bb
    expect(t[3]).toEqual({ step: 'E', alter: -1 });   // Eb
  });

  // ── Eb major (3♭ = Bb, Eb, Ab) ─────────────────────────────────────────
  it('Eb major: Bb, Eb, Ab', () => {
    const t = buildSpellingTable(-3);
    expect(t[10]).toEqual({ step: 'B', alter: -1 });  // Bb
    expect(t[3]).toEqual({ step: 'E', alter: -1 });   // Eb
    expect(t[8]).toEqual({ step: 'A', alter: -1 });   // Ab
  });

  // ── Ab major (4♭ = Bb, Eb, Ab, Db) ─────────────────────────────────────
  it('Ab major: Bb, Eb, Ab, Db', () => {
    const t = buildSpellingTable(-4);
    expect(t[10]).toEqual({ step: 'B', alter: -1 });  // Bb
    expect(t[3]).toEqual({ step: 'E', alter: -1 });   // Eb
    expect(t[8]).toEqual({ step: 'A', alter: -1 });   // Ab
    expect(t[1]).toEqual({ step: 'D', alter: -1 });   // Db
  });

  // ── Db major (5♭ = Bb, Eb, Ab, Db, Gb) ─────────────────────────────────
  it('Db major: Bb, Eb, Ab, Db, Gb', () => {
    const t = buildSpellingTable(-5);
    expect(t[10]).toEqual({ step: 'B', alter: -1 });  // Bb
    expect(t[3]).toEqual({ step: 'E', alter: -1 });   // Eb
    expect(t[8]).toEqual({ step: 'A', alter: -1 });   // Ab
    expect(t[1]).toEqual({ step: 'D', alter: -1 });   // Db
    expect(t[6]).toEqual({ step: 'G', alter: -1 });   // Gb
  });

  // ── Consistency: sharp keys don't change flat pitch classes ─────────────
  it.each([1, 2, 3, 4, 5, 6])('sharp key fifths=%d: no flat spellings introduced', (fifths) => {
    const t = buildSpellingTable(fifths);
    for (let pc = 0; pc < 12; pc++) {
      expect(t[pc].alter).toBeGreaterThanOrEqual(0);
    }
  });

  // ── F# major (6♯) ──────────────────────────────────────────────────────
  it('F# major (6♯): E# spelled correctly (pc 5 = E# not F)', () => {
    const t = buildSpellingTable(6);
    // F C G D A E are the sharped notes — their sounding pitch classes:
    // F#(6), C#(1), G#(8), D#(3), A#(10), E#(5≡F but spelled E#)
    expect(t[6]).toEqual({ step: 'F', alter: 1 });   // F#
    expect(t[1]).toEqual({ step: 'C', alter: 1 });   // C#
    expect(t[8]).toEqual({ step: 'G', alter: 1 });   // G#
    expect(t[3]).toEqual({ step: 'D', alter: 1 });   // D#
    expect(t[10]).toEqual({ step: 'A', alter: 1 });  // A#
    // pc 5 is E# in F# major — NOT F natural
    expect(t[5]).toEqual({ step: 'E', alter: 1 });   // E# (was F natural before fix)
  });

  // ── C# major (7♯) ──────────────────────────────────────────────────────
  it('C# major (7♯): B# spelled correctly (pc 0 = B# not C)', () => {
    const t = buildSpellingTable(7);
    expect(t[5]).toEqual({ step: 'E', alter: 1 });   // E#
    expect(t[0]).toEqual({ step: 'B', alter: 1 });   // B# (was C natural)
  });
});
