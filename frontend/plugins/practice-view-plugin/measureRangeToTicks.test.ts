/**
 * Tests for the measureRangeToTicks helper and the rawTickToExpandedTick
 * boundary fix applied when converting task loop regions.
 *
 * Root cause of bug (Arabesque m7-m10 loop jumping to m3):
 *   rawTickToExpandedTick uses a <= binary search on the offset table.
 *   When endTick falls exactly on a repeat-section boundary (m10 end =
 *   m11 start), the search returns the NEXT section's offset, producing
 *   a tick that spans both repeat passes and makes loopPracticeRange
 *   include second-pass notes.
 *
 *   Fix: rawTickToExpandedTick(endTick - 1) + 1
 */

import { describe, it, expect } from 'vitest';
import { measureRangeToTicks } from './measureRangeToTicks';

// ---------------------------------------------------------------------------
// measureRangeToTicks
// ---------------------------------------------------------------------------

describe('measureRangeToTicks', () => {
  // Arabesque-like structure: 32 measures, pickup + 31 full measures.
  // Arbitrary: 480 ticks per measure (PPQ=240, 2/4 time = 480 ticks/bar).
  const PPQ = 480;
  const makeEndTicks = (count: number) =>
    Array.from({ length: count }, (_, i) => (i + 1) * PPQ);

  it('returns start=0 for measure 1', () => {
    const et = makeEndTicks(16);
    expect(measureRangeToTicks(1, 4, et)).toEqual({ startTick: 0, endTick: 4 * PPQ });
  });

  it('returns correct ticks for a mid-score range', () => {
    const et = makeEndTicks(32);
    // m7-m10: startTick = end of m6 = 6*480, endTick = end of m10 = 10*480
    expect(measureRangeToTicks(7, 10, et)).toEqual({
      startTick: 6 * PPQ,
      endTick: 10 * PPQ,
    });
  });

  it('returns null for out-of-range inputs', () => {
    const et = makeEndTicks(10);
    expect(measureRangeToTicks(0, 5, et)).toBeNull();   // startMeasure < 1
    expect(measureRangeToTicks(5, 11, et)).toBeNull();  // endMeasure > array length
    expect(measureRangeToTicks(8, 5, et)).toBeNull();   // start > end
  });
});

// ---------------------------------------------------------------------------
// rawTickToExpandedTick boundary fix simulation
// ---------------------------------------------------------------------------

describe('rawTickToExpandedTick boundary: endTick at repeat-section edge', () => {
  /**
   * Simulate rawTickToExpandedTick using the same <= binary search logic as
   * scorePlayerContext.ts. offsets is an array of { raw, offset } sorted by raw.
   */
  function rawToExpanded(
    offsets: Array<{ raw: number; offset: number }>,
    rawTick: number,
  ): number {
    let lo = 0, hi = offsets.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid].raw <= rawTick) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    const offset = best >= 0 ? offsets[best].offset : offsets[0].offset;
    return rawTick + offset;
  }

  // Reproduce the Arabesque scenario:
  //   PPQ=240, 4/4 time → 960 ticks/measure
  //   m3 forward repeat at raw tick 1920 (end of m2)
  //   m10 backward repeat at raw tick 9600 (end of m10)
  //   section duration = 9600 - 1920 = 7680
  //
  //   Expanded offset table:
  //     raw 0..1919     → offset 0   (m1-m2, before repeat)
  //     raw 1920..9599  → offset 0   (first pass m3-m10)
  //     raw 9600..17279 → offset 7680 (second pass m3-m10, shifted)
  //     raw 17280+      → offset 7680 (m11+, also shifted)
  //
  //   So rawToExpanded(9600) = 9600 + 7680 = 17280  ← WRONG for endTick
  //   But rawToExpanded(9599) = 9599 + 0   = 9599   ← correct last tick in section
  //   And rawToExpanded(9599) + 1           = 9600   ← correct exclusive endTick

  const PPQ = 240;
  const measureTicks = PPQ * 4; // 4/4 time

  const sectionStart = 2 * measureTicks;  // m3 starts at end of m2 = 1920
  const sectionEnd   = 10 * measureTicks; // m10 end = 9600
  const sectionDur   = sectionEnd - sectionStart; // 7680

  const offsets = [
    { raw: 0,           offset: 0 },           // m1-m2 and first pass m3-m10
    { raw: sectionEnd,  offset: sectionDur },   // second pass starts here
  ];

  it('rawToExpanded(endTick) returns the wrong expanded tick at the boundary', () => {
    // This is the BUG: endTick of m10 = sectionEnd = 9600 hits the second-pass offset
    const wrongEndTick = rawToExpanded(offsets, sectionEnd);
    expect(wrongEndTick).toBe(sectionEnd + sectionDur); // 17280 — spans both passes
  });

  it('fix: rawToExpanded(endTick - 1) + 1 returns the correct expanded endTick', () => {
    // This is the FIX applied in PracticeViewPlugin when computing pendingTaskLoopRegion
    const fixedEndTick = rawToExpanded(offsets, sectionEnd - 1) + 1;
    expect(fixedEndTick).toBe(sectionEnd); // 9600 — stays in first pass
  });

  it('loopPracticeRange endIndex excludes second-pass notes with the fix', () => {
    // Simulate notes: first pass m7-m10 (raw 5760..9599), second pass m3-m10 (expanded 9600..17279)
    const m7start = 6 * measureTicks; // 5760
    const notes = [
      // first pass m7-m10 notes (tick = raw, offset=0)
      { tick: m7start },
      { tick: m7start + 240 },
      { tick: m7start + 480 },
      { tick: sectionEnd - 240 }, // last note of first-pass m10
      // second pass notes (tick = raw + sectionDur)
      { tick: sectionStart + sectionDur },       // second-pass m3 note 1
      { tick: sectionStart + sectionDur + 240 }, // second-pass m3 note 2
    ];

    const loopStartTick = rawToExpanded(offsets, m7start);            // 5760
    const wrongEndTick  = rawToExpanded(offsets, sectionEnd);         // 17280 — BUG
    const fixedEndTick  = rawToExpanded(offsets, sectionEnd - 1) + 1; // 9600  — FIX

    function computeEndIndex(endTick: number): number {
      let endIndex = 0;
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].tick < endTick) endIndex = i;
        else break;
      }
      return endIndex;
    }

    // With the bug, endIndex includes second-pass notes
    expect(computeEndIndex(wrongEndTick)).toBe(notes.length - 1); // 5 — includes m3 second pass!

    // With the fix, endIndex stops at the last note of first-pass m10
    expect(computeEndIndex(fixedEndTick)).toBe(3); // index 3 = last note of first-pass m10
  });
});
