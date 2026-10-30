/**
 * scaleOptions.ts — Musical scale catalog shared through the Plugin API.
 *
 * Moved here from `frontend/plugins/train-view/exerciseGenerator.ts` so the
 * catalog is host-owned shared data rather than an internal of one plugin.
 * Plugins (e.g. train-view, the private sessions-plugin) consume it through
 * the Plugin API barrel — never by importing another plugin's internals.
 *
 * Additive export: no `PLUGIN_API_VERSION` bump.
 */

/** Semitone intervals for one ascending octave of a major scale (root → octave). */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12] as const;

/** Semitone intervals for one ascending octave of a natural minor scale. */
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12] as const;

export interface ScaleOption {
  id: string;
  displayName: string;
  /** MIDI pitch of the root in octave 4 */
  rootMidi: number;
  intervals: readonly number[];
  /** MusicXML fifths value: positive = sharps, negative = flats, 0 = C major/A minor */
  fifths: number;
}

/** All 24 scales in circle-of-fifths order (majors then minors). */
export const SCALE_OPTIONS: readonly ScaleOption[] = [
  // Major scales  (fifths: positive = sharps, negative = flats)
  { id: 'c-major',  displayName: 'C Major',       rootMidi: 60, intervals: MAJOR_INTERVALS, fifths:  0 },
  { id: 'g-major',  displayName: 'G Major',       rootMidi: 67, intervals: MAJOR_INTERVALS, fifths:  1 },
  { id: 'd-major',  displayName: 'D Major',       rootMidi: 62, intervals: MAJOR_INTERVALS, fifths:  2 },
  { id: 'a-major',  displayName: 'A Major',       rootMidi: 69, intervals: MAJOR_INTERVALS, fifths:  3 },
  { id: 'e-major',  displayName: 'E Major',       rootMidi: 64, intervals: MAJOR_INTERVALS, fifths:  4 },
  { id: 'b-major',  displayName: 'B Major',       rootMidi: 71, intervals: MAJOR_INTERVALS, fifths:  5 },
  { id: 'fs-major', displayName: 'F\u266f Major', rootMidi: 66, intervals: MAJOR_INTERVALS, fifths:  6 },
  { id: 'db-major', displayName: 'D\u266d Major', rootMidi: 61, intervals: MAJOR_INTERVALS, fifths: -5 },
  { id: 'ab-major', displayName: 'A\u266d Major', rootMidi: 68, intervals: MAJOR_INTERVALS, fifths: -4 },
  { id: 'eb-major', displayName: 'E\u266d Major', rootMidi: 63, intervals: MAJOR_INTERVALS, fifths: -3 },
  { id: 'bb-major', displayName: 'B\u266d Major', rootMidi: 70, intervals: MAJOR_INTERVALS, fifths: -2 },
  { id: 'f-major',  displayName: 'F Major',       rootMidi: 65, intervals: MAJOR_INTERVALS, fifths: -1 },
  // Natural minor scales (relative minor shares key sig with its relative major)
  { id: 'a-minor',  displayName: 'A Minor',       rootMidi: 69, intervals: MINOR_INTERVALS, fifths:  0 },
  { id: 'e-minor',  displayName: 'E Minor',       rootMidi: 64, intervals: MINOR_INTERVALS, fifths:  1 },
  { id: 'b-minor',  displayName: 'B Minor',       rootMidi: 71, intervals: MINOR_INTERVALS, fifths:  2 },
  { id: 'fs-minor', displayName: 'F\u266f Minor', rootMidi: 66, intervals: MINOR_INTERVALS, fifths:  3 },
  { id: 'cs-minor', displayName: 'C\u266f Minor', rootMidi: 61, intervals: MINOR_INTERVALS, fifths:  4 },
  { id: 'gs-minor', displayName: 'G\u266f Minor', rootMidi: 68, intervals: MINOR_INTERVALS, fifths:  5 },
  { id: 'ds-minor', displayName: 'D\u266f Minor', rootMidi: 63, intervals: MINOR_INTERVALS, fifths:  6 },
  { id: 'bb-minor', displayName: 'B\u266d Minor', rootMidi: 70, intervals: MINOR_INTERVALS, fifths: -5 },
  { id: 'f-minor',  displayName: 'F Minor',       rootMidi: 65, intervals: MINOR_INTERVALS, fifths: -4 },
  { id: 'c-minor',  displayName: 'C Minor',       rootMidi: 60, intervals: MINOR_INTERVALS, fifths: -3 },
  { id: 'g-minor',  displayName: 'G Minor',       rootMidi: 67, intervals: MINOR_INTERVALS, fifths: -2 },
  { id: 'd-minor',  displayName: 'D Minor',       rootMidi: 62, intervals: MINOR_INTERVALS, fifths: -1 },
];
