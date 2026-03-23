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
    det = new ChordDetector({ windowMs: 200 });
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

  it('completes when all three are pressed spread across 150 ms (realistic chord)', () => {
    det.press(60, T0);
    det.press(64, T0 + 70);
    const result = det.press(67, T0 + 150);
    expect(result.complete).toBe(true);
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
    // Third press arrives 210 ms after first — window exceeded, collection restarted
    const result = det.press(67, T0 + 210);
    expect(result.complete).toBe(false);
    // 60 and 64 should have been discarded; only 67 collected
    expect(result.collected).not.toContain(60);
    expect(result.collected).not.toContain(64);
  });

  it('a non-chord note press does NOT reset the window', () => {
    det.press(60, T0);
    det.press(64, T0 + 50);
    // Non-chord note arrives between chord presses — must not evict the earlier ones
    det.press(99, T0 + 100);
    const result = det.press(67, T0 + 150);
    expect(result.complete).toBe(true);
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
  it('accepts presses exactly at the window edge (windowMs = 200)', () => {
    const det = new ChordDetector({ windowMs: 200 });
    det.reset([60, 64]);
    det.press(60, T0);
    // Exactly 200 ms later — still within window (not strictly greater)
    const result = det.press(64, T0 + 200);
    expect(result.complete).toBe(true);
  });

  it('rejects presses 1 ms past the window edge', () => {
    const det = new ChordDetector({ windowMs: 200 });
    det.reset([60, 64]);
    det.press(60, T0);
    // 201 ms — first press is now 1 ms outside the window
    const result = det.press(64, T0 + 201);
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

// ---------------------------------------------------------------------------
// Pin — held pitches survive window expiry
// ---------------------------------------------------------------------------

describe('ChordDetector — pin()', () => {
  it('pinned pitch counts as collected even without a press', () => {
    const det = new ChordDetector({ windowMs: 80 });
    det.reset([60, 64]);
    det.pin(60);
    const result = det.press(64, T0);
    expect(result.complete).toBe(true);
    expect(result.collected).toEqual([60, 64]);
  });

  it('pinned pitch survives window expiry', () => {
    const det = new ChordDetector({ windowMs: 80 });
    det.reset([60, 64, 67]);
    // Simulate: user holds 60 from a prior beat
    det.pin(60);
    // First press: 64 at T0
    det.press(64, T0);
    // Second press: 67 at T0 + 200 (outside 80 ms window — clears 64)
    const result = det.press(67, T0 + 200);
    // 60 is pinned (survives), 67 just pressed; 64 was evicted
    expect(result.complete).toBe(false);
    expect(result.collected).toContain(60);
    expect(result.collected).toContain(67);
    expect(result.missing).toEqual([64]);
  });

  it('re-pinning after window expiry completes the chord', () => {
    const det = new ChordDetector({ windowMs: 80 });
    det.reset([63, 79]); // D#5 = 63, G5 = 79
    // User presses G5 first
    det.press(79, T0);
    // 200 ms later presses D#5 — window clears G5
    let result = det.press(63, T0 + 200);
    expect(result.complete).toBe(false);
    // MIDI handler detects G5 is still held → pins it
    det.pin(79);
    result = det.press(63, T0 + 200);
    expect(result.complete).toBe(true);
    expect(result.collected).toEqual([63, 79]);
  });
});

// ---------------------------------------------------------------------------
// Unpin behaviour
// ---------------------------------------------------------------------------

describe('ChordDetector — unpin()', () => {
  it('unpinning a pinned pitch makes chord incomplete again', () => {
    const det = new ChordDetector();
    det.reset([60, 64, 67]);
    det.pin(60);
    det.pin(64);
    // With 60 and 64 pinned, pressing 67 would complete the chord
    let result = det.press(67, T0);
    expect(result.complete).toBe(true);

    // Reset and re-pin, then unpin 64
    det.reset([60, 64, 67]);
    det.pin(60);
    det.pin(64);
    det.unpin(64);
    result = det.press(67, T0);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain(64);
  });

  it('unpin is a no-op for pitches not pinned', () => {
    const det = new ChordDetector();
    det.reset([60, 64]);
    det.unpin(60); // Not pinned — should not throw
    const result = det.press(60, T0);
    expect(result.collected).toContain(60);
  });

  it('stale pin scenario: pin then unpin sustained pitch before press', () => {
    const det = new ChordDetector();
    // Chord: [79] onset + [48, 52, 55] sustained
    det.reset([79, 48, 52, 55]);
    // Pin sustained pitches (simulating useEffect at beat start)
    det.pin(48);
    det.pin(52);
    det.pin(55);
    // User releases chord keys — unpin them
    det.unpin(48);
    det.unpin(52);
    det.unpin(55);
    // Now pressing only 79 should NOT complete
    const result = det.press(79, T0);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining([48, 52, 55]));
  });
});

// ---------------------------------------------------------------------------
// Reset recovery — simulates the rest-gap WRONG_MIDI scenario
// ---------------------------------------------------------------------------

describe('ChordDetector — reset recovery after premature reset([])', () => {
  it('is permanently stuck after reset([]): press always returns incomplete', () => {
    const det = new ChordDetector();
    det.reset([60, 67]);
    // Chord completes
    det.press(60, T0);
    const r1 = det.press(67, T0 + 10);
    expect(r1.complete).toBe(true);
    // Premature reset — detector disabled
    det.reset([]);
    // Any press now returns incomplete (required is empty)
    const r2 = det.press(60, T0 + 100);
    expect(r2.complete).toBe(false);
    const r3 = det.press(67, T0 + 110);
    expect(r3.complete).toBe(false);
  });

  it('recovers after reset([]) followed by reset(requiredPitches)', () => {
    const det = new ChordDetector();
    det.reset([60, 67]);
    det.press(60, T0);
    const r1 = det.press(67, T0 + 10);
    expect(r1.complete).toBe(true);
    // Premature reset
    det.reset([]);
    // Restore required pitches (as the fix does)
    det.reset([60, 67]);
    // Chord works again on retry
    det.press(60, T0 + 200);
    const r2 = det.press(67, T0 + 210);
    expect(r2.complete).toBe(true);
  });

  it('recovers with pin after reset(requiredPitches) for held sustained note', () => {
    const det = new ChordDetector();
    det.reset([60, 67]);
    det.press(60, T0);
    const r1 = det.press(67, T0 + 10);
    expect(r1.complete).toBe(true);
    // Premature reset then restore
    det.reset([]);
    det.reset([60, 67]);
    // Pin a held pitch (simulating re-pin of sustained note)
    det.pin(67);
    // Only pressing the remaining note completes
    const r2 = det.press(60, T0 + 300);
    expect(r2.complete).toBe(true);
    expect(r2.collected).toEqual([60, 67]);
  });
});
