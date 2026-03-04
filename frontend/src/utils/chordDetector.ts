/**
 * ChordDetector — simultaneous multi-note chord press detection.
 *
 * Accumulates MIDI attack events within a configurable time window (default
 * 80 ms, which is inaudible as chord-roll delay to human ears). Reports
 * "chord complete" when every required pitch has been pressed within the
 * rolling window.
 *
 * Design goals:
 *   - Pure TypeScript: no React, no browser APIs beyond Date.now(), no side
 *     effects.
 *   - Self-contained: usable in any context (host platform, plugins, tests).
 *   - Reusable: create one instance, call `reset()` each time the target
 *     chord changes.
 *
 * Plugin access:
 *   Re-exported via `frontend/src/plugin-api/index.ts` so external plugins can
 *   import it directly from the Plugin API — no mirror copy needed.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChordDetectorOptions {
  /**
   * Maximum milliseconds between the first and last note press of a chord
   * to be considered simultaneous. Defaults to 200 ms — chosen to accommodate
   * real keyboard playing where a 3-note chord can easily spread 80–150 ms.
   */
  windowMs?: number;
}

export interface ChordResult {
  /** True when every required pitch has been collected within the window. */
  readonly complete: boolean;
  /** Required pitches that have been pressed within the rolling window. */
  readonly collected: ReadonlyArray<number>;
  /** Required pitches not yet pressed (or whose press has expired). */
  readonly missing: ReadonlyArray<number>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ChordDetector {
  private readonly windowMs: number;
  /** The set of MIDI pitches that must all be pressed to complete the chord. */
  private required: ReadonlyArray<number> = [];
  /**
   * Maps each MIDI pitch → timestamp (ms) of its most-recent press.
   * Contains only pitches that are in `required`.
   */
  private presses: Map<number, number> = new Map();

  constructor(options: ChordDetectorOptions = {}) {
    this.windowMs = options.windowMs ?? 200;
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /**
   * Set the required pitches for the next chord and clear any pending state.
   *
   * Call this each time the practice target advances to a new entry, and
   * also to deactivate the detector by passing an empty array.
   */
  reset(requiredPitches: ReadonlyArray<number>): void {
    this.required = requiredPitches;
    this.presses.clear();
  }

  /**
   * Record a MIDI attack event and return the current accumulation state.
   *
   * Pitches not in `required` are silently ignored (callers decide whether
   * to treat them as wrong-note events). Presses older than `windowMs` are
   * automatically evicted on each call.
   *
   * @param midiNote  MIDI pitch number (0–127).
   * @param timestamp Event timestamp in milliseconds (`event.timeStamp` or
   *                  `Date.now()`).
   */
  press(midiNote: number, timestamp: number): ChordResult {
    // Ignore pitches outside the required chord — the caller decides whether
    // to treat them as wrong-note events. Returning early also ensures that
    // non-chord key presses never affect the timing window.
    if (!(this.required as number[]).includes(midiNote)) {
      return this._evaluate();
    }

    // If this chord press arrives more than windowMs after the earliest
    // already-collected press, the prior accumulation is stale — discard it
    // and start a fresh window anchored to this note.
    if (this.presses.size > 0) {
      const oldestTime = Math.min(...this.presses.values());
      if (timestamp - oldestTime > this.windowMs) {
        this.presses.clear();
      }
    }

    this.presses.set(midiNote, timestamp);

    return this._evaluate();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _evaluate(): ChordResult {
    const collected = (this.required as number[]).filter((p) => this.presses.has(p));
    const missing = (this.required as number[]).filter((p) => !this.presses.has(p));
    return {
      complete: this.required.length > 0 && missing.length === 0,
      collected,
      missing,
    };
  }
}
