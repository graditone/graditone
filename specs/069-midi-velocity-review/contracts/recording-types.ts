/**
 * contracts/recording-types.ts
 * Feature 069: Review MIDI Keys Velocity
 *
 * TypeScript interface contracts for the extended recording domain types.
 * These are the EXPECTED final shapes of the changed interfaces.
 * Actual implementation files live in frontend/src/types/recording.ts
 * and frontend/src/services/recording/midiUtils.ts.
 */

// ─── NoteOnset (extended) ──────────────────────────────────────────────────────
// Change surface: frontend/src/types/recording.ts
// Adds optional MIDI fields — backward-compatible with mic input path.

export interface NoteOnset {
  // Existing fields (unchanged)
  label: string;
  note: string;
  octave: number;
  confidence: number;
  elapsedMs: number;

  // New optional MIDI fields (Feature 069)
  /** MIDI key velocity 1–127. undefined for mic input. FR-001 / FR-006. */
  velocity?: number;
  /** MIDI channel 1–16. undefined for mic input. FR-003 / FR-006. */
  channel?: number;
  /** Raw MIDI bytes [statusByte, noteByte, velocityByte]. undefined for mic input. FR-004. */
  rawBytes?: readonly number[];
}

// ─── MidiNoteEvent (extended) ──────────────────────────────────────────────────
// Change surface: frontend/src/types/recording.ts
// Adds rawBytes so the full data can flow from useMidiInput to RecordingView.

export interface MidiNoteEvent {
  // Existing fields (unchanged)
  noteNumber: number;
  velocity: number;
  channel: number;
  timestampMs: number;
  label: string;

  // New optional field (Feature 069, P4)
  /** Raw MIDI message bytes. Populated in useMidiInput from ev.data. FR-004. */
  rawBytes?: readonly number[];
}

// ─── MidiCCEvent (no changes) ──────────────────────────────────────────────────
// Defined in frontend/src/services/recording/midiUtils.ts — not modified.

export interface MidiCCEvent {
  controller: number; // 0–127
  value: number;      // 0–127
  channel: number;    // 1–16
  // Note: no timestampMs in current definition — RecordingView adds elapsed via state
}

// ─── NoteHistoryList props contract ────────────────────────────────────────────
// Change surface: frontend/src/components/recording/NoteHistoryList.tsx
// Props are unchanged (still takes NoteOnset[]); rendering logic changes internally.

export interface NoteHistoryListProps {
  entries: NoteOnset[];
  onClear: () => void;
}

// ─── RecordingView useMidiInput wiring (P4) ────────────────────────────────────
// The RecordingView now wires onCC to handleMidiCC.
// useMidiInput routes ALL CC (not just CC7/CC11) when onCC is present.
// The CC7/CC11 filter is moved to the score player (its only other consumer).

export interface UseMidiInputCallbacksUpdated {
  onNoteOn: (event: MidiNoteEvent) => void;
  onNoteOff?: (noteNumber: number) => void;
  onConnectionChange: (event: { device: unknown; kind: string; timestamp: number }) => void;
  /** Now receives ALL CC messages (0–127), not just CC7/CC11. P4. */
  onCC?: (event: MidiCCEvent) => void;
  sessionStartMs?: number;
}
