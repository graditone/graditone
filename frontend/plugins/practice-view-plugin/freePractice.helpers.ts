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

/** Steps spanned by a single segment of a note value (16th grid). */
function computeSteps(value: number): number {
  return value * 4; // 1 beat = 4 sixteenth steps
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
 * Infer the intended note length (in 1/16 steps) from the time until the next
 * attack (or the note's own duration for the last note). Designed to absorb
 * realistic human timing (SC-006): values within +/- 50% of a beat count as
 * that beat subdivision; shorter onsets fall to eighth / 16th tiers.
 */
function inferValueSteps(msToNext: number, msPerBeat: number): number {
  const cell = msPerBeat / 4;
  const ratio = msToNext / msPerBeat;
  // Beat-tier: quarter (4 steps), half (8), whole (16). A real eighth sits at
  // exactly 0.5 — use a strict > so it falls through to the sub-beat tier.
  if (ratio > 0.5 && ratio < 1.5) return computeSteps(1);   // 4
  if (ratio >= 1.5 && ratio < 3) return computeSteps(2);    // 8
  if (ratio >= 3) return computeSteps(4);                   // 16
  // Sub-beat tiers on the 16th cell.
  const steps = Math.max(1, Math.round(msToNext / cell));
  if (steps >= 2 && steps < 4) return 2;  // eighth-ish
  return Math.max(1, Math.min(3, steps)); // 16th / 8th boundary
}

/** Map a note's implied value (steps) to the alignment grid multiple. */
function gridMultiple(valueSteps: number): number {
  if (valueSteps >= 4) return 4; // beat grid
  if (valueSteps >= 2) return 2; // eighth grid
  return 1;                      // 16th grid
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

  // Cluster near-simultaneous onsets (chords / re-triggers) into clusters so
  // every pitch is kept but a single grid position is shared (FR-010).
  interface Cluster {
    events: FreeMidiEventLike[];
    onsetMs: number;
  }
  const clusters: Cluster[] = [];
  for (const ev of segment) {
    const last = clusters[clusters.length - 1];
    if (last && !isDistinctOnset(
      { midiNote: 0, timestampMs: last.onsetMs } as FreeMidiEventLike,
      ev,
      cell,
    )) {
      last.events.push(ev);
    } else {
      clusters.push({ events: [ev], onsetMs: ev.timestampMs });
    }
  }

  /** Index of the measure each cluster attacks. */
  const measuresMap = new Map<number, DetectedMeasure>();

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const rel = cluster.onsetMs - anchor;
    const mIdx = Math.floor(rel / measureMs);
    const relInM = rel - mIdx * measureMs;

    const msToNext =
      i + 1 < clusters.length
        ? clusters[i + 1].onsetMs - cluster.onsetMs
        : cluster.events[0].durationMs ?? cell;

    // The note's own held duration is the upper bound for its musical value —
    // a deliberate silence between notes becomes a rest, not extra note length.
    const effectiveToNext =
      cluster.events[0].durationMs != null
        ? Math.min(cluster.events[0].durationMs, msToNext)
        : msToNext;

    const valueSteps = inferValueSteps(effectiveToNext, msPerBeat);
    const grid = gridMultiple(valueSteps);
    const rawStep = relInM / cell;
    const alignedStep = Math.round(rawStep / grid) * grid;
    const startStep = Math.max(0, Math.min(STEPS_PER_MEASURE - 1, alignedStep));

    // The musical value (inferred from the held duration / next onset) governs
    // the detected full length. The raw held-duration cell rounding is noisy
    // under human timing and would create phantom bar-line carries.
    const fullDurSteps = valueSteps;
    const clampedSteps = Math.min(fullDurSteps, STEPS_PER_MEASURE - startStep);
    const acrossBarLine = startStep + fullDurSteps > STEPS_PER_MEASURE;

    let measure = measuresMap.get(mIdx);
    if (!measure) {
      measure = {
        index: mIdx,
        startMs: anchor + mIdx * measureMs,
        endMs: anchor + (mIdx + 1) * measureMs,
        complete: false,
        notes: [],
        rests: [],
      };
      measuresMap.set(mIdx, measure);
    }
    for (const ev of cluster.events) {
      measure.notes.push({
        midiNote: ev.midiNote,
        startStep,
        durationSteps: Math.max(1, clampedSteps),
        fullDurationSteps: Math.max(1, fullDurSteps),
        acrossBarLine,
      });
    }
  }

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