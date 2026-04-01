/**
 * Recording domain types for the debug-mode Recording View feature.
 * All entities are in-memory only; no persistence.
 */

/** State of an active recording session */
export type RecordingSessionState =
  | 'idle'         // No recording active, no error
  | 'requesting'   // Awaiting getUserMedia permission
  | 'recording'    // AudioWorklet active, mic open
  | 'error';       // Capture failed or resources unavailable

/** Active microphone capture session */
export interface RecordingSession {
  state: RecordingSessionState;
  /** Epoch ms when recording started; null when not recording */
  startTimestamp: number | null;
  /** Human-readable error description; null when no error */
  errorMessage: string | null;
}

/**
 * PCM sample buffer posted from AudioWorklet processor to main thread.
 * Batched at 2048 samples (≈46 ms at 44100 Hz).
 */
export interface AudioFrame {
  /** Raw PCM samples, range [-1, 1] */
  buffer: Float32Array;
  /** Sample rate in Hz (always 44100) */
  sampleRate: number;
}

/**
 * Output of one pitch detection cycle (McLeod Pitch Method via pitchy).
 * Only produced when clarity >= CONFIDENCE_THRESHOLD.
 */
export interface PitchSample {
  /** Detected fundamental frequency in Hz */
  hz: number;
  /** Detection confidence in [0, 1]; values >= 0.9 are considered reliable */
  confidence: number;
  /** Note name with accidental, e.g. "A", "C#" */
  note: string;
  /** Scientific octave number, e.g. 4 for A4 */
  octave: number;
  /** Full note label, e.g. "A4", "C#5" */
  label: string;
}

/**
 * A note onset appended to the note history list.
 * Created when pitch changes or a 300 ms silence gap elapses between identical pitches.
 */
export interface NoteOnset {
  /** Full note label, e.g. "A4" */
  label: string;
  /** Note name, e.g. "A" */
  note: string;
  /** Octave number */
  octave: number;
  /** Detection confidence at time of onset */
  confidence: number;
  /** Elapsed ms since session startTimestamp */
  elapsedMs: number;
  /** MIDI key velocity 1–127. undefined when input source is microphone. FR-001/FR-006. */
  velocity?: number;
  /** MIDI channel 1–16. undefined when input source is microphone. FR-003/FR-006. */
  channel?: number;
  /** Raw MIDI message bytes, e.g. [0x90, 60, 100]. undefined for mic input. FR-004. */
  rawBytes?: readonly number[];
}

/** Current waveform buffer used to render the oscilloscope */
export interface OscilloscopeState {
  /** Latest PCM amplitude values (Float32Array slice), or null when not recording */
  waveform: Float32Array | null;
}

// ─── MIDI Input types (feature 029-midi-input) ────────────────────────────────

/** A connected MIDI input device */
export interface MidiDevice {
  /** Unique port ID assigned by the browser */
  id: string;
  /** Human-readable device name; falls back to "Unknown Device" if empty */
  name: string;
  /** Manufacturer name; may be empty string */
  manufacturer: string;
  /** Current connection state */
  state: 'connected' | 'disconnected';
}

/** Active capture source — exactly one is active at any time */
export type InputSource =
  | { kind: 'microphone' }
  | { kind: 'midi'; deviceName: string; deviceId: string };

/** A single MIDI note-on event received from the active MIDI device */
export interface MidiNoteEvent {
  /** MIDI note number 0–127 */
  noteNumber: number;
  /** Key velocity 1–127 (events with velocity 0 are filtered out — they are note-offs) */
  velocity: number;
  /** MIDI channel 1–16; all channels are captured with no filtering */
  channel: number;
  /** Milliseconds elapsed since session startTimestamp */
  timestampMs: number;
  /** Derived scientific pitch name, e.g. "A4", "C#5" */
  label: string;
  /** Raw MIDI message bytes, e.g. [0x90, 60, 100]. Set in useMidiInput from ev.data. FR-004. */
  rawBytes?: readonly number[];
}

/** A device-level connection lifecycle event */
export interface MidiConnectionEvent {
  device: MidiDevice;
  kind: 'connected' | 'disconnected';
  timestamp: number;
}
