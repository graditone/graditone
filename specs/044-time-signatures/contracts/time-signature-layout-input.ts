/**
 * Contract: Time Signature in Layout Input
 * Feature: 044-time-signatures
 *
 * This file documents the interface between the frontend (LayoutView.tsx)
 * and the Rust/WASM layout engine (compute_layout_wasm).
 *
 * The time signature is passed per-staff as part of the StaffInput.
 * All staves in a score share the same time signature for this feature.
 *
 * STATUS: No changes to this interface are required for 044-time-signatures.
 * The interface already supports any time signature. The bug was that the
 * converter always populated numerator=4, denominator=4 regardless of the
 * score's actual time signature.
 */

// ─── Time Signature ──────────────────────────────────────────────────────────

/**
 * A time signature expressed as numerator over denominator.
 *
 * @example { numerator: 2, denominator: 4 }  // 2/4 (Arabesque)
 * @example { numerator: 4, denominator: 4 }  // 4/4 (Canon in D)
 * @example { numerator: 6, denominator: 8 }  // 6/8 (Nocturne)
 */
export interface TimeSignature {
  /** Beats per measure. Positive integer. Examples: 2, 3, 4, 6, 9, 12 */
  numerator: number;
  /**
   * Beat unit as a note-value denominator.
   * Always a power of 2. Examples: 2 (half), 4 (quarter), 8 (eighth), 16 (sixteenth).
   */
  denominator: number;
}

// ─── Computed Value (Rust side only, not in JSON contract) ───────────────────

/**
 * ticks_per_measure is DERIVED in Rust from TimeSignature.
 * It is NOT a field in the JSON contract.
 *
 * Formula (integer, 960 PPQ):
 *   ticks_per_measure = (3840 * numerator) / denominator
 *
 * Examples:
 *   2/4 → 1920 ticks
 *   3/4 → 2880 ticks
 *   4/4 → 3840 ticks
 *   6/8 → 2880 ticks
 *   9/8 → 4320 ticks
 */

// ─── Layout Input Shape (simplified excerpt) ─────────────────────────────────

/**
 * The JSON input to compute_layout_wasm contains a `staffs` array.
 * Each staff element includes a `time_signature` field.
 *
 * This interface documents the time-signature-relevant portion.
 * See full input shape in LayoutView.tsx :: ConvertedScore.
 */
export interface StaffLayoutInput {
  clef: string;
  /** Time signature for this staff. Must match the score's global time signature. */
  time_signature: TimeSignature;
  key_signature: { sharps: number };
  voices: VoiceLayoutInput[];
}

export interface VoiceLayoutInput {
  notes: NoteLayoutInput[];
}

export interface NoteLayoutInput {
  tick: number;
  duration: number;
  pitch: string | null;
  articulation: string | null;
  spelling: string | null;
}
