/**
 * Volume and velocity utility functions.
 *
 * Feature: 063-midi-volume-control
 * Provides linear velocity-to-gain conversion
 * and MIDI CC scaling for the playback pipeline.
 */

/** Default velocity when no dynamic marking is present (mezzo-forte). */
export const DEFAULT_VELOCITY = 80;

/**
 * Converts a MIDI velocity (1–127) to a Tone.js amplitude gain (0–1)
 * using a linear curve for wide, clearly audible dynamic range.
 *
 * Formula: gain = velocity / 127
 *
 * This matches the approach used by MuseScore and many notation players,
 * producing ~20 dB of range from pp (vel 31, gain 0.24) to ff (vel 112,
 * gain 0.88). The wider spread makes dynamics clearly perceptible
 * compared to a square-root curve (~6 dB range).
 *
 * @param velocity MIDI velocity value (1–127). Values outside this range are clamped.
 * @returns Amplitude gain in range [0, 1].
 */
export function velocityToGain(velocity: number): number {
  const clamped = Math.max(1, Math.min(127, velocity));
  return clamped / 127;
}

/**
 * Applies MIDI CC7 (Channel Volume) and CC11 (Expression) scaling
 * to a note's velocity gain.
 *
 * Formula: effectiveGain = noteGain × (cc7 / 127) × (cc11 / 127)
 *
 * @param noteGain Base gain from velocityToGain()
 * @param channelVolume CC7 value (0–127), defaults to 127
 * @param expression CC11 value (0–127), defaults to 127
 * @returns Scaled gain in range [0, 1].
 */
export function applyCCScaling(
  noteGain: number,
  channelVolume: number = 127,
  expression: number = 127,
): number {
  return noteGain * (channelVolume / 127) * (expression / 127);
}
