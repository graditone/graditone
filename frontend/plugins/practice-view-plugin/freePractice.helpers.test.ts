/**
 * freePractice.helpers.test.ts
 * Feature 094 — onset-derived measure detection.
 *
 * The SC-001 regression below encodes the reported Issue #1 directly and
 * remains as the permanent guard (Constitution Principle VII).
 */

import { describe, it, expect } from 'vitest';
import {
  MEASURE_NUMERATOR,
  STEPS_PER_MEASURE,
  MIN_REST_STEPS,
  detectMeasures,
  quantizeNote,
  computeNoteValue,
  freeModeToPluginNotes,
} from './freePractice.helpers';
import type { FreeMidiEventLike } from './freePractice.helpers';

/** Build a quarter-note event at `onsetMs`, held `durMs`. */
const q = (onsetMs: number, durMs = 750, midiNote = 60): FreeMidiEventLike => ({
  midiNote,
  timestampMs: onsetMs,
  durationMs: durMs,
});

/** Sum of a measure's note steps + rest steps (content accounting). */
function measureContent(measure: { notes: Array<{ durationSteps: number }>; rests: Array<{ durationSteps: number }> }) {
  const noteSteps = measure.notes.reduce((s, n) => s + Math.min(n.durationSteps, STEPS_PER_MEASURE - n.startStep), 0);
  const restSteps = measure.rests.reduce((s, r) => s + r.durationSteps, 0);
  return noteSteps + restSteps;
}

describe('Issue #1 regression — eight beat-aligned quarter notes (SC-001)', () => {
  it('produces exactly two complete measures of four quarters, zero rests, sums of 16', () => {
    // 80 BPM: beat = 750 ms, 16th cell = 187.5 ms.
    const events = Array.from({ length: 8 }, (_, i) => q(i * 750, 750));
    const measures = detectMeasures(events, 80);

    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measure.notes).toHaveLength(4);
      expect(measure.rests).toHaveLength(0);
      expect(measureContent(measure)).toBe(STEPS_PER_MEASURE);
      for (const note of measure.notes) {
        expect(computeNoteValue(note.durationSteps)).toBe('1/4');
      }
    }
  });

  it('is deterministic and metronome-agnostic: same events -> same structure (SC-007)', () => {
    const events = Array.from({ length: 8 }, (_, i) => q(i * 750, 750));
    const a = detectMeasures(events, 80);
    const b = detectMeasures(events, 80);
    expect(a).toEqual(b);
    // bpm is the only wall-clock-meta input; no metronome state exists.
    expect(events[0].timestampMs).toBe(0);
  });
});

describe('detectMeasures — empty / partial / tempo behavior', () => {
  it('returns [] for no events', () => {
    expect(detectMeasures([], 80)).toEqual([]);
  });

  it('honestly preserves a trailing partial measure (FR-006): 3 quarters then stop', () => {
    const events = [q(0), q(750), q(1500)];
    const measures = detectMeasures(events, 80);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(false);
    expect(measures[0].notes).toHaveLength(3);
    expect(measures[0].rests).toHaveLength(0); // no auto-fill (FR-006)
    expect(measureContent(measures[0])).toBe(12);
  });

  it('is tempo-invariant in structure (SC-004): identical measure structure at 20/60/120/240/300 BPM', () => {
    const template = [q(0), q(1), q(2), q(3), q(4), q(5), q(6), q(7)];
    const tempos = [20, 60, 120, 240, 300];
    const first = detectMeasures(
      template.map((e) => q(e.timestampMs * (60_000 / 80 / (60_000 / tempos[0])), (60_000 / tempos[0]) * 0.75)),
      tempos[0],
    );
    const signature = (ms: typeof first) =>
      ms.map((m) => ({
        complete: m.complete,
        noteSteps: m.notes.map((n) => n.durationSteps),
        rests: m.rests.length,
      }));

    for (const bpm of tempos) {
      const msPerBeat = 60_000 / bpm;
      const events = template.map((e) => q(e.timestampMs * (msPerBeat / 750), msPerBeat * 0.75));
      const measures = detectMeasures(events, bpm);
      expect(signature(measures)).toEqual(signature(first));
      for (const m of measures) expect(m.complete).toBe(true);
    }
  });

  it('detects a 1/16 run as 1/16 and never finer (SC-008)', () => {
    const cell = 187.5;
    const events = Array.from({ length: 16 }, (_, i) => q(i * cell, cell));
    const measures = detectMeasures(events, 80);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    expect(measures[0].notes).toHaveLength(16);
    for (const note of measures[0].notes) {
      expect(computeNoteValue(note.durationSteps)).toBe('1/16');
      expect(note.durationSteps).toBeGreaterThanOrEqual(1);
    }
  });

  it('is fast over 500 synthetic events (<100 ms — R-008)', () => {
    const msPerBeat = 750;
    const events = Array.from({ length: 500 }, (_, i) => q(i * (msPerBeat / 4) * 0.999, msPerBeat / 4));
    const t0 = performance.now();
    detectMeasures(events, 80);
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(100);
  });
});

describe('detectMeasures — mixed beat-aligned input (SC-002)', () => {
  it('two half notes + four quarter notes span two complete measures', () => {
    // Halves at 0 and 2 beats; quarters at 4,5,6,7 beats.
    const msPerBeat = 750;
    const events = [
      q(0, 2 * msPerBeat),
      q(2 * msPerBeat, 2 * msPerBeat),
      q(4 * msPerBeat, msPerBeat),
      q(5 * msPerBeat, msPerBeat),
      q(6 * msPerBeat, msPerBeat),
      q(7 * msPerBeat, msPerBeat),
    ];
    const measures = detectMeasures(events, 80);
    expect(measures).toHaveLength(2);
    expect(measures[0].complete).toBe(true);
    expect(measures[1].complete).toBe(true);
    expect(computeNoteValue(measures[0].notes[0].durationSteps)).toBe('half');
    expect(computeNoteValue(measures[0].notes[1].durationSteps)).toBe('half');
    expect(computeNoteValue(measures[1].notes[0].durationSteps)).toBe('1/4');
  });

  it('an eighth-note run over a measure is all 1/8 and complete', () => {
    const msPerBeat = 750;
    const events = Array.from({ length: 8 }, (_, i) => q(i * msPerBeat / 2, msPerBeat / 2));
    const measures = detectMeasures(events, 80);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    expect(measures[0].notes).toHaveLength(8);
    for (const note of measures[0].notes) {
      expect(computeNoteValue(note.durationSteps)).toBe('1/8');
    }
  });
});

describe('detectMeasures — robust / complex performances (US3)', () => {
  it('SC-006: 8 quarters with realistic human jitter (~±5% beat) and normal holds stay two complete measures', () => {
    const msPerBeat = 750;
    // Realistic "accurate" playing: attacks drift by up to ~40ms (5.3% of the
    // 750ms beat — well inside the ±half-cell capture radius of ~94ms), holds
    // 700..800ms (a quarter's length). The previous ±25% fixture was dropped:
    // at ±24% of a beat the inter-onset gaps (0.6..1.4 beat) are physically
    // indistinguishable from an eighth-note run (0.5 beat), so no positional
    // detector can classify them reliably (see Issue #7).
    const drifts = [20, -40, 30, -20, 35, -25, 40, -30];
    const holds = [720, 780, 700, 800, 740, 760, 710, 790];
    const events = drifts.map((drift, i) => {
      const onset = i * msPerBeat + drift;
      const base = i + 1 < holds.length ? (i + 1) * msPerBeat + drifts[i + 1] : (i + 1) * msPerBeat;
      return q(Math.max(0, onset), Math.min(base - onset, holds[i]), 60);
    });
    const measures = detectMeasures(events, 80);

    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measure.notes).toHaveLength(4);
      expect(measure.rests).toHaveLength(0);
      expect(measureContent(measure)).toBe(STEPS_PER_MEASURE);
      for (const note of measure.notes) {
        expect(computeNoteValue(note.durationSteps)).toBe('1/4');
      }
    }
  });

  it('T-NEW-11 (Issue #7): an accurate eighth-note run over two measures (La Candeur M1-2) is all 1/8 — no quarters, no chords, no rests', () => {
    // 60 BPM (beat 1000ms, 1/8 = 500ms). Realistic human timing: attacks drift
    // by up to ±40ms, eighth notes held until the next attack (slightly short).
    const beat = 1000;
    const drifts = [0, -25, 18, -32, 26, -18, 35, -28, 22, -30, 15, -35, 30, -22, 16, -20];
    const onsets = [];
    let t = 0;
    for (let i = 0; i < 16; i++) {
      onsets.push(t + drifts[i]);
      t += beat / 2;
    }
    const events = onsets.map((tt, i) =>
      q(tt, i < 15 ? onsets[i + 1] - tt - 15 : beat / 2 - 20, 60 + i),
    );

    const measures = detectMeasures(events, 60);

    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measure.notes).toHaveLength(8);   // 8 eighth notes per measure
      expect(measure.rests).toHaveLength(0);
      expect(measureContent(measure)).toBe(STEPS_PER_MEASURE);
      const steps = new Set(measure.notes.map((n) => n.startStep));
      expect(steps.size).toBe(8);              // no two notes share a grid slot (no "chords")
      for (const note of measure.notes) {
        expect(computeNoteValue(note.durationSteps)).toBe('1/8');
      }
    }
  });

  it('T-NEW-12: an eighth run where the holds slightly exceed the gap (legato overlap) stays all 1/8', () => {
    const beat = 1000;
    // Each eighth held 30ms past its nominal length (overlap into the next note).
    const events = Array.from({ length: 16 }, (_, i) => q(i * (beat / 2), beat / 2 + 30, 60 + i));
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measure.notes).toHaveLength(8);
      expect(measure.rests).toHaveLength(0);
      for (const note of measure.notes) {
        expect(computeNoteValue(note.durationSteps)).toBe('1/8');
      }
    }
  });

  it('T-NEW-13: mixed rhythm bar — quarter + two eighths + half keeps correct values (held-duration cap)', () => {
    const beat = 1000;
    const events = [
      q(0, beat, 60),
      q(beat, beat / 2, 62),
      q(beat * 1.5, beat / 2, 64),
      q(beat * 2, beat * 2, 66),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true); // 1 + 0.5 + 0.5 + 2 = 4 beats
    const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
    expect(values).toEqual(['1/4', '1/8', '1/8', 'half']);
    expect(measures[0].notes.map((n) => n.startStep)).toEqual([0, 4, 6, 8]);
    expect(measures[0].rests).toHaveLength(0);
  });

  it('T-NEW-17 (Issue #10): a note released slightly early is still a full note — the measure stays complete', () => {
    // Four quarter notes at 60 BPM (beat 1000ms, cell 250ms). The second note is
    // released 250ms early (held 750ms) but the next attack still lands on time.
    // The old `min(heldSteps, gapSteps)` capped it to a "dotted 1/8" leaving the
    // measure at 15/16 — incomplete, short an 1/8. Now the early release is only
    // honoured when the resulting silence is a genuine rest (>= 1 beat).
    const beat = 1000;
    const events = [
      q(0, beat, 60),
      q(beat, beat * 0.75, 62),
      q(2 * beat, beat, 64),
      q(3 * beat, beat, 66),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    expect(measureContent(measures[0])).toBe(STEPS_PER_MEASURE);
    expect(measures[0].rests).toHaveLength(0);
    const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
    expect(values).toEqual(['1/4', '1/4', '1/4', '1/4']);
  });

  it('T-NEW-18 (Issue #10): a genuinely short note followed by >= 1 beat of silence remains short + rest (not over-extended)', () => {
    // Quarter slot at beat 0 held for only half a beat (an eighth), then a beat
    // and a half of deliberate silence before the next attack. Must stay an
    // eighth with a resulting rest, NOT be stretched to a quarter.
    const beat = 1000;
    const events = [
      q(0, beat / 2, 60),
      q(2 * beat, beat, 62),
      q(3 * beat, beat, 64),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
    expect(values[0]).toBe('1/8');
    expect(measures[0].rests.length).toBeGreaterThan(0);
  });

  it('T-NEW-19 (Issue #10 follow-up): the LAST note released slightly early stays a full note — measure completes (regression: 3x1/4 + 1x1/8)', () => {
    // End of session: four quarters, the last released ~300ms early (held 700ms
    // of a 1000ms beat). The pre-fix last-note branch used rounded held steps,
    // producing "dotted 1/8" (700ms→3 cells) or "1/8" (500ms→2 cells) and an
    // incomplete measure — exactly the reported "3x1/4 + 1x1/8, missing a 1/8".
    const beat = 1000;
    for (const hold of [700, 500]) {
      const events = [
        q(0, beat, 60),
        q(beat, beat, 62),
        q(2 * beat, beat, 64),
        q(3 * beat, hold, 66),
      ];
      const measures = detectMeasures(events, 60);
      expect(measures).toHaveLength(1);
      expect(measures[0].complete).toBe(true);
      expect(measureContent(measures[0])).toBe(STEPS_PER_MEASURE);
      const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
      expect(values).toEqual(['1/4', '1/4', '1/4', '1/4']);
    }
  });

  it('T-NEW-21 (Issue #10 follow-up): a note drifting off its beat slot mid-measure no longer leaves the measure incomplete', () => {
    // Two measures of quarters. In measure 1 the LAST attack arrives ~0.5 beat
    // early (drifts to an off-quarter grid slot at step ~10) and is held short.
    // The produced sub-beat remnants must never leave measure 1 incomplete:
    // sub-beat holes are folded/extended and the measure must report complete.
    const beat = 1000;
    const events = [
      q(0, 900, 60),
      q(beat, 900, 62),
      q(2 * beat, 900, 64),
      q(2 * beat + 500, 700, 66), // drifts to ~step 10, held short
      q(4 * beat, 900, 68),
      q(5 * beat, 900, 70),
      q(6 * beat, 900, 72),
      q(7 * beat, 900, 74),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measureContent(measure)).toBe(STEPS_PER_MEASURE);
    }
  });

  it('T-NEW-22 (Issue #10 follow-up): a non-final measure ending with >= 1 beat of genuine silence emits a trailing rest (not incomplete)', () => {
    // Measure 1: 3 quarters then a beat of silence (player pauses before the
    // next measure). That trailing silence is a genuine rest — measure 1 must
    // read complete (3x1/4 + 1/4 rest), NOT be left incomplete.
    const beat = 1000;
    const events = [
      q(0, beat, 60),
      q(beat, beat, 62),
      q(2 * beat, beat, 64),
      q(4 * beat, beat, 68),
      q(5 * beat, beat, 70),
      q(6 * beat, beat, 72),
      q(7 * beat, beat, 74),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(2);
    expect(measures[0].complete).toBe(true);
    expect(measures[0].rests.length).toBeGreaterThan(0); // the trailing 1/4 rest
    expect(measures[1].complete).toBe(true);
  });

  it('T-NEW-23 (Issue #10 follow-up): cumulative tempo drift on quarter notes re-aligns to the beat grid (no off-quarter 1/8)', () => {
    // A slightly fast/slow quarter performance: each onset drifts -50ms per beat
    // (cumulative). The pre-fix 16th-grid snap landed the last note on an
    // off-quarter cell (10 instead of 12), splitting the measure into
    // "2x1/4 + 1/8 + 1/4" and leaving it incomplete. The beat-grid snap must
    // re-align it to four clean quarters.
    const beat = 1000;
    const events = [
      q(0, 900, 60),
      q(beat - 50, 900, 62),
      q(2 * beat - 100, 900, 64),
      q(3 * beat - 150, 900, 66),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    const steps = measures[0].notes.map((n) => n.startStep);
    expect(steps).toEqual([0, 4, 8, 12]);
    const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
    expect(values).toEqual(['1/4', '1/4', '1/4', '1/4']);
    expect(measures[0].rests).toHaveLength(0);
  });

  it('T-NEW-24 (Issue #10 follow-up): eighth-note content still snaps to the 16th grid (beat snap not applied)', () => {
    // Eighths must NOT be re-aligned to quarters; the 16th grid preserves them.
    const beat = 1000;
    const events = Array.from({ length: 8 }, (_, i) => q(i * (beat / 2), beat / 2 - 20, 60 + i));
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    const values = measures[0].notes.map((n) => computeNoteValue(n.durationSteps));
    expect(values).toEqual(Array(8).fill('1/8'));
  });

  it('T-NEW-20 (Issue #10 follow-up): the same holds before a >= 1-measure pause also complete their measure', () => {
    // Measure 1's last note released early, then a full-measure pause (segment
    // split). Note 4 is the LAST of its segment — it must complete measure 1.
    const beat = 1000;
    const events = [
      q(0, beat, 60),
      q(beat, beat, 62),
      q(2 * beat, beat, 64),
      q(3 * beat, 700, 66),
      q(8 * beat, beat, 68),
      q(9 * beat, beat, 70),
      q(10 * beat, beat, 72),
      q(11 * beat, beat, 74),
    ];
    const measures = detectMeasures(events, 60);
    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      const values = measure.notes.map((n) => computeNoteValue(n.durationSteps));
      expect(values).toEqual(['1/4', '1/4', '1/4', '1/4']);
    }
  });

  it('T-NEW-14 (Issue #8): a measure-crossing eighth played slightly early snaps to the NEXT measure — no 3-notes-in-a-beat split', () => {
    // First quarter of the second measure is played 60ms early (just before the
    // boundary). The raw-time floor previously clamped it to step 15 of the
    // first measure, splitting the final beat into 8th + 16th + 16th.
    const beat = 1000;
    const onsets = Array.from({ length: 16 }, (_, i) => i * (beat / 2));
    onsets[8] = 8 * (beat / 2) - 60; // first note of measure 2, 60ms early

    const events = onsets.map((tt, i) =>
      q(tt, i < 15 ? Math.max(200, onsets[i + 1] - tt - 20) : beat / 2 - 20, 60 + i),
    );
    const measures = detectMeasures(events, 60);

    expect(measures).toHaveLength(2);
    for (const measure of measures) {
      expect(measure.complete).toBe(true);
      expect(measure.notes).toHaveLength(8);   // transcribed into the right measure
      expect(measure.rests).toHaveLength(0);
      const steps = new Set(measure.notes.map((n) => n.startStep));
      expect(steps.size).toBe(8);              // exactly one note per eighth slot
      for (const note of measure.notes) {
        expect(computeNoteValue(note.durationSteps)).toBe('1/8');
      }
    }
  });

  it('SC-003: legato stream (gaps < 1 beat) produces zero rests', () => {
    const msPerBeat = 750;
    // 8 quarter notes where holds slightly undershoot the next attack but the
    // gap between note-end and next onset stays below a full beat.
    const events = Array.from({ length: 8 }, (_, i) => q(i * msPerBeat, msPerBeat * 0.9));
    const measures = detectMeasures(events, 80);
    for (const measure of measures) {
      expect(measure.rests).toHaveLength(0);
    }
  });

  it('SC-003: a genuine 1-beat gap yields a quarter rest; 2-beat gap a half rest', () => {
    const msPerBeat = 750;
    // Measure: quarter at 0, [1-beat silence], quarters at 2 and 3.
    const oneBeatGap = [q(0, msPerBeat), q(2 * msPerBeat, msPerBeat), q(3 * msPerBeat, msPerBeat)];
    const m1 = detectMeasures(oneBeatGap, 80);
    expect(m1[0].rests).toHaveLength(1);
    expect(m1[0].rests[0].durationSteps).toBe(MIN_REST_STEPS); // quarter rest
    expect(m1[0].complete).toBe(true);

    // Measure: quarter at 0, [2-beat silence], quarter at 3.
    const twoBeatGap = [q(0, msPerBeat), q(3 * msPerBeat, msPerBeat)];
    const m2 = detectMeasures(twoBeatGap, 80);
    expect(m2[0].rests).toHaveLength(1);
    expect(m2[0].rests[0].durationSteps).toBe(8); // half rest
    expect(m2[0].complete).toBe(true);
  });

  it('FR-009: a held-across-bar-line note clamps in its attack measure and is carried', () => {
    const msPerBeat = 750;
    // Quarter, quarter at beats 0-1, then a whole note (4 beats) starting on
    // beat 3 (step 8) — held across the bar line.
    const events = [
      q(0, msPerBeat),
      q(msPerBeat, msPerBeat),
      q(3 * msPerBeat, 4 * msPerBeat),
    ];
    const measures = detectMeasures(events, 80);
    expect(measures.length).toBeGreaterThanOrEqual(2);
    const m0 = measures[0];
    const lastNote = m0.notes[m0.notes.length - 1];
    expect(lastNote.acrossBarLine).toBe(true);
    expect(lastNote.startStep).toBe(12); // beat 4
    expect(m0.complete).toBe(true);
    expect(measureContent(m0)).toBe(STEPS_PER_MEASURE);
    // The continuation measure represents the carried time without auto-fill.
    const m1 = measures[1];
    expect(m1.notes).toHaveLength(0);
    expect(m1.rests).toHaveLength(0);
    expect(m1.complete).toBe(false);
  });

  it('FR-010: a chord on one beat counts as a single grid position and keeps measure complete', () => {
    const msPerBeat = 750;
    const events = [
      q(0, msPerBeat, 60),
      q(0, msPerBeat, 64),
      q(0, msPerBeat, 67),
      q(msPerBeat, msPerBeat, 60),
      q(2 * msPerBeat, msPerBeat, 60),
      q(3 * msPerBeat, msPerBeat, 60),
    ];
    const measures = detectMeasures(events, 80);
    expect(measures).toHaveLength(1);
    expect(measures[0].complete).toBe(true);
    // 4 grid positions: chord (3 pitches) + 3 single quarters.
    expect(measures[0].notes).toHaveLength(6);
    const steps = new Set(measures[0].notes.map((n) => n.startStep));
    expect(steps.size).toBe(4);
  });

  it('FR-012: a pause of a full measure re-anchors a fresh segment, preserving the partial tail', () => {
    const msPerBeat = 750;
    const tail = [q(0, msPerBeat), q(msPerBeat, msPerBeat), q(2 * msPerBeat, msPerBeat)];
    // Silence spanning >= 1 measure (3 beats held + 1+ measure of nothing), then resume.
    const resumedOnset = 6 * msPerBeat; // gap from 2.75 beats to here >= measure length
    const resume = [q(resumedOnset, msPerBeat), q(resumedOnset + msPerBeat, msPerBeat),
      q(resumedOnset + 2 * msPerBeat, msPerBeat), q(resumedOnset + 3 * msPerBeat, msPerBeat)];
    const events = [...tail, ...resume];
    const measures = detectMeasures(events, 80);
    expect(measures.length).toBeGreaterThanOrEqual(2);
    expect(measures[0].complete).toBe(false); // partial tail
    expect(measures[0].notes).toHaveLength(3);
    // Fresh segment is re-anchored and complete with 4 quarters.
    const fresh = measures[measures.length - 1];
    expect(fresh.complete).toBe(true);
    expect(fresh.notes).toHaveLength(4);
    expect(fresh.startMs).toBe(resumedOnset);
  });

  it('FR-011: same events quantified against different bpm grids remain correct per tempo', () => {
    const events = Array.from({ length: 8 }, (_, i) => q(i * 750, 750));
    expect(detectMeasures(events, 60)[0].complete).toBe(true);
    expect(detectMeasures(events, 180)[0].complete).toBe(true);
  });
});

describe('quantizeNote / computeNoteValue', () => {
  it('rounds to nearest 16th cell and clamps to the measure', () => {
    expect(quantizeNote(0, 750, 750)).toEqual({ startStep: 0, durationSteps: 4 });
    expect(quantizeNote(750, 750, 750)).toEqual({ startStep: 4, durationSteps: 4 });
    expect(quantizeNote(7000, 400, 750).startStep).toBeLessThanOrEqual(15);
    expect(quantizeNote(4000, 750, 750).startStep).toBe(15); // clamped
    expect(quantizeNote(0, 5000, 750).durationSteps).toBe(16); // clamped to 16 - start(0)
  });

  it('computeNoteValue maps conventional values', () => {
    expect(computeNoteValue(1)).toBe('1/16');
    expect(computeNoteValue(2)).toBe('1/8');
    expect(computeNoteValue(4)).toBe('1/4');
    expect(computeNoteValue(8)).toBe('half');
    expect(computeNoteValue(16)).toBe('whole');
  });
});

describe('freeModeToPluginNotes', () => {
  it('round-trips detected measures into staff/replay events with identical structure (SC-005)', () => {
    const events = Array.from({ length: 8 }, (_, i) => q(i * 750, 750));
    const measures = detectMeasures(events, 80);
    const noteEvents = freeModeToPluginNotes(measures, 80);
    expect(noteEvents).toHaveLength(8);
    for (const n of noteEvents) {
      expect(n.type).toBe('attack');
      // Quarter note = one beat (750 ms) at 80 BPM.
      expect(Math.round((n.durationMs ?? 0) / 750)).toBe(1);
    }
    const sorted = [...noteEvents].every((n, i, arr) => i === 0 || arr[i - 1].timestamp <= n.timestamp);
    expect(sorted).toBe(true);
  });

  it('detectMeasures stays a pure derived view (MEASURE_NUMERATOR=4)', () => {
    expect(MEASURE_NUMERATOR).toBe(4);
    expect(STEPS_PER_MEASURE).toBe(16);
  });
});