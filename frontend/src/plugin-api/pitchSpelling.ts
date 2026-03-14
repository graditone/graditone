// ── Pitch spelling helper ────────────────────────────────────────────────────
// Given a MIDI pitch and a key signature (fifths), return { step, alter } so the
// WASM layout engine places the note on the correct diatonic line/space and
// suppresses accidentals already present in the key signature.

/** Flat order (reverse circle): B E A D G C F — pitch classes */
const FLAT_ORDER = [11, 4, 9, 2, 7, 0, 5] as const;

/** Sharp order (circle of fifths): F C G D A E B — pitch classes */
const SHARP_ORDER = [5, 0, 7, 2, 9, 4, 11] as const;

/** Diatonic step names indexed by white-key pitch class (0=C … 11=B). */
const PC_TO_STEP: Record<number, string> = {
  0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B',
};

/**
 * Pitch class → default (sharp-biased) spelling when no key signature context.
 * Each entry is [step, alter].
 */
const DEFAULT_SHARP_SPELLING: [string, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0],
  ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

/**
 * Build a spelling lookup for a given key signature.
 * Returns a 12-element array mapping pitch class → { step, alter }.
 *
 * For flat keys, re-spells the relevant chromatic pitch classes as flats
 * (e.g. pc 10 → B♭ instead of A♯). For sharp keys, re-spells colliding
 * pitch classes (e.g. pc 5 → E♯ instead of F natural in F♯ major).
 */
export function buildSpellingTable(fifths: number): { step: string; alter: number }[] {
  const table = DEFAULT_SHARP_SPELLING.map(([step, alter]) => ({ step, alter }));

  if (fifths > 0) {
    // Sharp key: for each sharped diatonic note, remap the sounding pitch class.
    // For 1–5 sharps (F#, C#, G#, D#, A#) the default table already has the
    // correct spelling so the writes are no-ops. For 6+ sharps the sounding pc
    // collides with a natural note (E#=pc5 collides with F, B#=pc0 with C) and
    // the remap is essential.
    const numSharps = Math.min(fifths, 7);
    for (let i = 0; i < numSharps; i++) {
      const diatonicPc = SHARP_ORDER[i];
      const soundingPc = (diatonicPc + 1) % 12;
      table[soundingPc] = { step: PC_TO_STEP[diatonicPc], alter: 1 };
    }
  } else if (fifths < 0) {
    const numFlats = Math.min(Math.abs(fifths), 7);
    for (let i = 0; i < numFlats; i++) {
      const diatonicPc = FLAT_ORDER[i]; // the natural pitch class being flatted
      const soundingPc = (diatonicPc + 11) % 12; // one semitone lower
      const step = PC_TO_STEP[diatonicPc]; // keep the step letter of the diatonic note
      table[soundingPc] = { step, alter: -1 };
    }
  }

  return table;
}
