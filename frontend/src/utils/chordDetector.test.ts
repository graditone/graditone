/**
 * Tests for ChordDetector — T046
 * Feature 037: Practice View Plugin (Amendment — chord detection)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChordDetector } from './chordDetector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const T0 = 1000; // arbitrary base timestamp in ms

// ---------------------------------------------------------------------------
// Single-note entries
// ---------------------------------------------------------------------------

describe('ChordDetector — single note', () => {
  it('completes immediately on the first matching press', () => {
    const det = new ChordDetector();
    det.reset([60]);
    const result = det.press(60, T0);
    expect(result.complete).toBe(true);
    expect(result.collected).toEqual([60]);
    expect(result.missing).toEqual([]);
  });

  it('does not complete when a different note is pressed', () => {
    const det = new ChordDetector();
    det.reset([60]);
    const result = det.press(61, T0);
    expect(result.complete).toBe(false);
    expect(result.collected).toEqual([]);
    expect(result.missing).toEqual([60]);
  });
});

// ---------------------------------------------------------------------------
// Chord (C-major: C4-E4-G4 = [60, 64, 67])
// ---------------------------------------------------------------------------

describe('ChordDetector — three-note chord [60, 64, 67]', () => {
  let det: ChordDetector;

  beforeEach(() => {
    det = new ChordDetector({ windowMs: 80 });
    det.reset([60, 64, 67]);
  });

  it('completes when all three are pressed within the window', () => {
    det.press(60, T0);
    det.press(64, T0 + 30);
    const result = det.press(67, T0 + 60);
    expect(result.complete).toBe(true);
    expect(result.collected).toEqual(expect.arrayContaining([60, 64, 67]));
    expect(result.missing).toEqual([]);
  });

  it('does not complete when only two are pressed', () => {
    det.press(60, T0);
    const result = det.press(64, T0 + 20);
    expect(result.complete).toBe(false);
    expect(result.collected).toEqual(expect.arrayContaining([60, 64]));
    expect(result.missing).toEqual([67]);
  });

  it('does not complete when only one is pressed', () => {
    const result = det.press(64, T0);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining([60, 67]));
  });

  it('does not complete when the first press has expired (> windowMs)', () => {
    det.press(60, T0);
    det.press(64, T0 + 50);
    // Third press arrives 90 ms after first — first has expired
    const result = det.press(67, T0 + 90);
    expect(result.complete).toBe(false);
    // 60 should have been evicted
    expect(result.collected).not.toContain(60);
  });

  it('ignores pitches not in the required set', () => {
    det.press(62, T0); // D4 — not in C major chord
    const result = det.press(62, T0 + 10);
    expect(result.complete).toBe(false);
    expect(result.collected).toEqual([]);
    expect(result.missing).toEqual(expect.arrayContaining([60, 64, 67]));
  });

  it('pressing an out-of-set note does not affect collected/missing', () => {
    det.press(60, T0);
    det.press(99, T0 + 10); // random irrelevant pitch
    const result = det.press(64, T0 + 20);
    expect(result.collected).toEqual(expect.arrayContaining([60, 64]));
    expect(result.missing).toEqual([67]);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('ChordDetector — reset()', () => {
  it('clears prior presses when reset is called', () => {
    const det = new ChordDetector();
    det.reset([60, 64]);
    det.press(60, T0);
    // Switch target
    det.reset([72, 76]);
    // Old press for 60 must be gone
    const result = det.press(72, T0 + 10);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain(76);
    expect(result.collected).toContain(72);
  });

  it('sets new required pitches after reset', () => {
    const det = new ChordDetector();
    det.reset([60]);
    det.reset([72, 76]);
    const result = det.press(72, T0);
    expect(result.missing).toContain(76);
  });

  it('reset([]) — empty set never reports complete', () => {
    const det = new ChordDetector();
    det.reset([]);
    const result = det.press(60, T0);
    expect(result.complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Window boundary (exact-edge behaviour)
// ---------------------------------------------------------------------------

describe('ChordDetector — window boundary', () => {
  it('accepts presses exactly at the window edge (windowMs = 80)', () => {
    const det = new ChordDetector({ windowMs: 80 });
    det.reset([60, 64]);
    det.press(60, T0);
    // Exactly 80 ms later — still within window (cutoff = timestamp - 80, press at T0)
    const result = det.press(64, T0 + 80);
    expect(result.complete).toBe(true);
  });

  it('rejects presses 1 ms past the window edge', () => {
    const det = new ChordDetector({ windowMs: 80 });
    det.reset([60, 64]);
    det.press(60, T0);
    // 81 ms — first press is now 1 ms outside the window
    const result = det.press(64, T0 + 81);
    expect(result.complete).toBe(false);
  });

  it('uses custom windowMs option', () => {
    const det = new ChordDetector({ windowMs: 200 });
    det.reset([60, 64]);
    det.press(60, T0);
    const result = det.press(64, T0 + 150);
    expect(result.complete).toBe(true);
  });
});
