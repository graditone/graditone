/**
 * freePractice.helpers.ts
 * Features 092 + 094: Free Practice Option — onset-derived measure detection.
 *
 * Pure types and functions for reconstructing the musical beat grid from
 * recorded MIDI onsets during free (score-less) practice sessions.
 *
 * Feature 094 rationale (research D1/D2): measure boundaries and note values
 * are ALWAYS derived from the recorded note onsets — never from the metronome
 * clock and never from a free-running wall-clock timer. When a musician follows
 * a metronome, the onsets carry the beat phase; when no metronome is used the
 * same onsets define the grid. Detection is therefore metronome-agnostic.
 *
 * No React imports (hexagonal purity — Constitution Principle II).
 */

import type { PluginNoteEvent } from '../../src/plugin-api/types';

/** 4/4: numerator (beats per measure). */
export const MEASURE_NUMERATOR = 4;
/** 4/4 in 960-PPQ terms: 16 sixteenth-note steps per measure. */
export const STEPS_PER_MEASURE = 16;
/** Shortest detectable remainder that still counts as a deliberate silence. */
export const MIN_REST_STEPS = 4;

/** Input event shape accepted by `detectMeasures` (superset of FreeMidiEvent). */
export type FreeMidiEventLike = {
  midiNote: number;
  timestampMs: number;
  durationMs?: number;
};

/** A detected note assigned to a measure (16th-step grid). */
export interface DetectedNote {
  midiNote: number;
  /** 0..15 — position within the measure. */
  startStep: number;
  /** Clamped to the measure (1..16-startStep) for completeness accounting. */
  durationSteps: number;
  /** Full (unclamped) held duration in steps — display length incl. carry. */
  fullDurationSteps: number;
  /** True when the held duration extends past the measure boundary (display concern). */
  acrossBarLine: boolean;
}

/** A detected rest (silence of >= 1 beat). */
export interface DetectedRest {
  startStep: number;
  durationSteps: number; // >= MIN_REST_STEPS
}

/** A detected (sub)measure. */
export interface DetectedMeasure {
  index: number;
  startMs: number;
  endMs: number;
  /** True when detected content sums exactly to the measure length (16 steps). */
  complete: boolean;
  notes: DetectedNote[];
  rests: DetectedRest[];
}

/**
 * Conventional note value label for a step count on the 16th grid.
 */
export function computeNoteValue(steps: number): string {
  const v = Math.max(1, Math.round(steps));
  switch (v) {
    case 1: return '1/16';
    case 2: return '1/8';
    case 3: return 'dotted 1/8';
    case 4: return '1/4';
    case 6: return 'dotted 1/4';
    case 8: return 'half';
    case 12: return 'dotted half';
    case 16: return 'whole';
    default: return `1/${Math.max(1, Math.round(16 / v))}`;
  }
}

/**
 * Quantize a single onset to the 16th grid cell. Pure cell rounding; the
 * value-driven snapping is handled inside `detectMeasures`.
 */
export function quantizeNote(
  relMs: number,
  durationMs: number,
  msPerBeat: number,
): { startStep: number; durationSteps: number } {
  const cell = msPerBeat / 4;
  const startStep = Math.max(0, Math.min(STEPS_PER_MEASURE - 1, Math.round(relMs / cell)));
  const durSteps = Math.max(1, Math.round(durationMs / cell));
  const durationSteps = Math.min(durSteps, STEPS_PER_MEASURE - startStep);
  return { startStep, durationSteps };
}

/** Greedy decomposition of a gap (in steps) into >= MIN_REST_STEPS rests. */
const REST_TABLE: Array<{ steps: number; label: string }> = [
  { steps: 16, label: 'whole' },
  { steps: 8, label: 'half' },
  { steps: 4, label: '1/4' },
  { steps: 2, label: '1/8' },
  { steps: 1, label: '1/16' },
];

function decomposeRests(gapSteps: number, startStep: number): DetectedRest[] {
  const rests: DetectedRest[] = [];
  let remaining = Math.max(0, gapSteps);
  let step = startStep;
  for (const { steps } of REST_TABLE) {
    while (remaining >= steps) {
      rests.push({ startStep: step, durationSteps: steps });
      step += steps;
      remaining -= steps;
    }
  }
  return rests;
}

/** True when the onset is a genuine re-trigger/overlap anyway (no new grid pos). */
function isDistinctOnset(
  prev: FreeMidiEventLike,
  cur: FreeMidiEventLike,
  cellMs: number,
): boolean {
  return cur.timestampMs - prev.timestampMs >= cellMs / 2;
}

/**
 * A coarse cluster of near-simultaneous onsets (a chord / repeated attack),
 * snapped to a 16th-grid position within its measure.
 */
interface OnsetSpot {
  onsetMs: number;
  mIdx: number;
  /** 0..15 — snapped grid position within the measure. */
  step: number;
  events: FreeMidiEventLike[];
}

/**
 * Build the onset spots for a segment: every onset gets a 16th-grid slot, and
 * onsets that land in the same grid slot (or occur within half a grid cell) are
 * merged into one chord spot (FR-010). The 16th grid is the position graph;
 * note values are derived from the slot gaps, not from per-note time ratios.
 *
 * The measure (spot.mIdx) is derived from the ROUNDED grid cell, not from the
 * raw time floor: an onset just before a measure boundary (e.g. the first note
 * of the next measure played a few tens of ms early) must snap to step 0 of the
 * NEXT measure — otherwise it is clamped to step 15 of the previous measure and
 * splits the final beat into three notes (Issue #8).
 */
function buildOnsetSpots(
  segment: FreeMidiEventLike[],
  anchor: number,
  cell: number,
): OnsetSpot[] {
  const spots: OnsetSpot[] = [];
  for (const ev of segment) {
    const rel = ev.timestampMs - anchor;
    const snappedCell = Math.round(rel / cell);
    const mIdx = Math.max(0, Math.floor(snappedCell / STEPS_PER_MEASURE));
    const step = Math.max(0, Math.min(STEPS_PER_MEASURE - 1, snappedCell - mIdx * STEPS_PER_MEASURE));
    const last = spots[spots.length - 1];
    if (
      last &&
      ((last.mIdx === mIdx && last.step === step) ||
        !isDistinctOnset(
          { midiNote: 0, timestampMs: last.onsetMs } as FreeMidiEventLike,
          ev,
          cell,
        ))
    ) {
      last.events.push(ev);
    } else {
      spots.push({ onsetMs: ev.timestampMs, mIdx, step, events: [ev] });
    }
  }
  return spots;
}

/**
 * Derived-detection grid (Feature 094b): note values are computed from GRID
 * positions, not from time-to-next ratios. Every onset is snapped to the 16th
 * grid (±half a cell ≈ half a 1/8 note), then a note's value is the distance in
 * grid steps to the next onset, CAPPED by the note's own held duration.
 *
 * Why the held-duration cap: onset gaps alone cannot distinguish "held half
 * note" from "quarter note + a beat of rest" (both put the next onset a whole
 * note away). `min(heldSteps, gapSteps)` keeps each note honest — a short hold
 * shortens it and the remainder becomes a rest — while the grid positions
 * absorb the human timing jitter that previously flipped accurate eighth runs
 * into quarters (Issue #7).
 */
function detectFromSpots(
  spots: OnsetSpot[],
  anchor: number,
  cell: number,
  measureMs: number,
): Map<number, DetectedMeasure> {
  const measuresMap = new Map<number, DetectedMeasure>();

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const firstEv = spot.events[0];
    const heldSteps = Math.max(1, Math.round((firstEv.durationMs ?? cell) / cell));

    let valueSteps: number;
    if (i + 1 < spots.length) {
      const next = spots[i + 1];
      const gapSteps = Math.max(
        1,
        next.mIdx * STEPS_PER_MEASURE + next.step - (spot.mIdx * STEPS_PER_MEASURE + spot.step),
      );
      valueSteps = Math.min(heldSteps, gapSteps);
    } else {
      // Last note of the segment: honor its held length (may carry across the
      // bar line — FR-009) so a sustained final note is not truncated.
      valueSteps = heldSteps;
    }

    const fullDurSteps = valueSteps;
    const clampedSteps = Math.min(fullDurSteps, STEPS_PER_MEASURE - spot.step);
    const acrossBarLine = spot.step + fullDurSteps > STEPS_PER_MEASURE;

    let measure = measuresMap.get(spot.mIdx);
    if (!measure) {
      measure = {
        index: spot.mIdx,
        startMs: anchor + spot.mIdx * measureMs,
        endMs: anchor + (spot.mIdx + 1) * measureMs,
        complete: false,
        notes: [],
        rests: [],
      };
      measuresMap.set(spot.mIdx, measure);
    }
    for (const ev of spot.events) {
      measure.notes.push({
        midiNote: ev.midiNote,
        startStep: spot.step,
        durationSteps: Math.max(1, clampedSteps),
        fullDurationSteps: Math.max(1, fullDurSteps),
        acrossBarLine,
      });
    }
  }

  return measuresMap;
}

/**
 * Build a measure list for one contiguous segment of onsets (anchored at the
 * segment's first onset). Returns DetectedMeasure[] for the span actually
 * played, with trailing partial measures preserved (FR-006).
 */
function detectSegment(segment: FreeMidiEventLike[], bpm: number): DetectedMeasure[] {
  if (segment.length === 0) return [];
  const msPerBeat = 60_000 / bpm;
  const cell = msPerBeat / 4;
  const measureMs = msPerBeat * MEASURE_NUMERATOR;
  const anchor = segment[0].timestampMs;

  const spots = buildOnsetSpots(segment, anchor, cell);
  const measuresMap = detectFromSpots(spots, anchor, cell, measureMs);

  // Forward-carry accounting: a note that spans the bar line supplies its
  // overflow steps to the following measure's content.
  const measures = [...measuresMap.entries()].sort((a, b) => a[0] - b[0]);
  const carriedInto = new Map<number, number>();
  for (const [idx, measure] of measures) {
    for (const note of measure.notes) {
      if (note.acrossBarLine) {
        const overflow = note.fullDurationSteps - (STEPS_PER_MEASURE - note.startStep);
        if (overflow > 0) {
          carriedInto.set(idx + 1, (carriedInto.get(idx + 1) ?? 0) + overflow);
        }
      }
    }
  }

  const result: DetectedMeasure[] = [];
  for (const [idx, measure] of measures) {
    const notes = measure.notes.sort((a, b) => a.startStep - b.startStep);
    const rests: DetectedRest[] = [];

    let accounted = 0;
    let prevEnd = 0;
    for (const note of notes) {
      if (note.startStep > prevEnd) {
        const gap = note.startStep - prevEnd;
        if (gap >= MIN_REST_STEPS) {
          rests.push(...decomposeRests(gap, prevEnd));
          accounted += gap;
        }
      }
      const within = Math.min(note.durationSteps, STEPS_PER_MEASURE - note.startStep);
      accounted += within;
      prevEnd = note.startStep + within;
    }

    const carried = carriedInto.get(idx) ?? 0;
    const total = accounted + carried;
    result.push({
      index: idx,
      startMs: measure.startMs,
      endMs: measure.endMs,
      complete: total >= STEPS_PER_MEASURE,
      notes,
      rests,
    });
  }

  // A bar-line carry may extend into a measure that has no onsets (a held note
  // sustaining across the boundary). Represent that trailing continuation so
  // the carried time is honestly preserved (FR-009 / FR-006).
  if (measures.length > 0) {
    const lastIdx = measures[measures.length - 1][0];
    const overflow = carriedInto.get(lastIdx + 1) ?? 0;
    if (overflow > 0) {
      result.push({
        index: lastIdx + 1,
        startMs: anchor + (lastIdx + 1) * measureMs,
        endMs: anchor + (lastIdx + 2) * measureMs,
        complete: overflow >= STEPS_PER_MEASURE,
        notes: [],
        rests: [],
      });
    }
  }

  return result;
}

/**
 * Detect measures for a full free-practice session.
 *
 * The beat grid is reconstructed SOLELY from note onsets (FR-001). A gap of one
 * full measure or more of silence starts a new segment re-anchored at the next
 * onset (FR-012), so pauses do not create phantom measures. At most the final
 * measure of each segment may be partial (FR-006).
 */
export function detectMeasures(events: FreeMidiEventLike[], bpm: number): DetectedMeasure[] {
  if (events.length === 0) return [];
  const msPerBeat = 60_000 / bpm;
  const measureMs = msPerBeat * MEASURE_NUMERATOR;

  // Split into contiguous segments when silence spans a full measure or more.
  const segments: FreeMidiEventLike[][] = [[events[0]]];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timestampMs - events[i - 1].timestampMs;
    if (gap >= measureMs) {
      segments.push([events[i]]);
    } else {
      segments[segments.length - 1].push(events[i]);
    }
  }

  const measures: DetectedMeasure[] = [];
  for (const segment of segments) {
    measures.push(...detectSegment(segment, bpm));
  }
  return measures;
}

/**
 * Convert detected measures back into `PluginNoteEvent[]` for the staff viewer,
 * save and replay. Timestamps are absolute ms anchored at the first onset of
 * the session (measure-1 grid origin) — identical for display and replay
 * (FR-007 / SC-005). When `sessionOriginMs` is given, timestamps are shifted to
 * be relative to that wall-clock origin (same as the existing
 * `freeDisplayOriginMs` semantics).
 */
export function freeModeToPluginNotes(
  measures: DetectedMeasure[],
  bpm: number,
  sessionOriginMs = 0,
): PluginNoteEvent[] {
  const msPerBeat = 60_000 / bpm;
  const cell = msPerBeat / 4;

  const notes: PluginNoteEvent[] = [];
  for (const measure of measures) {
    for (const note of measure.notes) {
      const displaySteps = note.acrossBarLine
        ? note.fullDurationSteps
        : note.durationSteps;
      const startMs = measure.startMs + note.startStep * cell;
      notes.push({
        midiNote: note.midiNote,
        timestamp: Math.max(0, Math.round(startMs - sessionOriginMs)),
        type: 'attack' as const,
        durationMs: displaySteps * cell,
      });
    }
  }
  return notes.sort((a, b) => a.timestamp - b.timestamp);
}