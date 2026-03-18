// TypeScript types mirroring backend domain entities

// ============================================================================
// Value Objects
// ============================================================================

/** Tick represents a time position at 960 PPQ (Pulses Per Quarter note) */
export type Tick = number;

/** BPM (Beats Per Minute) - valid range: 20-400 */
export type BPM = number;

/** MIDI pitch - valid range: 0-127 */
export type Pitch = number;

/** Clef types */
export type ClefType = "Treble" | "Bass" | "Alto" | "Tenor";

/** Key signature: sharps/flats count from Rust KeySignature(i8) — range -7 to +7 */
export type KeySignature = number;

// ============================================================================
// Events
// ============================================================================

/** Tempo change event */
export interface TempoEvent {
  tick: Tick;
  bpm: BPM;
}

/** Time signature change event */
export interface TimeSignatureEvent {
  tick: Tick;
  numerator: number;
  denominator: number;
}

/** Clef change event */
export interface ClefEvent {
  tick: Tick;
  clef_type: ClefType;
}

/** Key signature change event */
export interface KeySignatureEvent {
  tick: Tick;
  key: KeySignature;
}

/** Global structural events (tempo, time signature) */
export type GlobalStructuralEvent =
  | { Tempo: TempoEvent }
  | { TimeSignature: TimeSignatureEvent };

/** Staff-scoped structural events (clef, key signature) */
export type StaffStructuralEvent =
  | { Clef: ClefEvent }
  | { KeySignature: KeySignatureEvent };

/** Note spelling preserving enharmonic representation (e.g., D# vs Eb) */
export interface NoteSpelling {
  step: string;  // Note letter: 'C', 'D', 'E', 'F', 'G', 'A', 'B'
  alter: number; // Chromatic alteration: -1=flat, 0=natural, 1=sharp
}

/** Note event */
/** Beam annotation on a note from MusicXML import */
export interface NoteBeamData {
  number: number; // Beam level (1=8th, 2=16th, 3=32nd)
  beam_type: 'Begin' | 'Continue' | 'End' | 'ForwardHook' | 'BackwardHook';
}

export interface Note {
  id: string; // UUID
  start_tick: Tick;
  duration_ticks: number;
  pitch: Pitch;
  spelling?: NoteSpelling;
  beams?: NoteBeamData[];
  staccato?: boolean;
  dot_count?: number;
  /** ID of the next note in this tie chain. Present only on tie-start notes. */
  tie_next?: string;
  /** True if this note is a tied continuation (no new attack). */
  is_tie_continuation?: boolean;
  /** ID of the next note in this slur chain. Present only on slur-start notes. */
  slur_next?: string;
  /** Slur direction from MusicXML: true=above, false=below. */
  slur_above?: boolean;
}

// ============================================================================
// Domain Entities
// ============================================================================

/** Voice contains notes with overlap validation */
export interface Voice {
  id: string; // UUID
  interval_events: Note[];
  rest_events?: RestEvent[];
}

/** Rest event within a voice */
export interface RestEvent {
  id: string;
  start_tick: number;
  duration_ticks: number;
  note_type?: string;
  voice: number;
  staff: number;
}

/** Staff contains voices and staff-scoped structural events */
export interface Staff {
  id: string; // UUID
  active_clef: ClefType; // Feature 007: Active clef derived from first ClefEvent
  staff_structural_events: StaffStructuralEvent[];
  voices: Voice[];
}

/** Instrument contains staves */
export interface Instrument {
  id: string; // UUID
  name: string;
  /** Type of instrument for playback (e.g., "piano", "guitar") - Feature 003: Music Playback */
  instrument_type: string;
  staves: Staff[];
}

/** Score is the aggregate root containing all musical elements */
export interface Score {
  id: string; // UUID
  
  /** Schema version for data structure evolution (v2 added active_clef) */
  schema_version: number;
  
  global_structural_events: GlobalStructuralEvent[];
  instruments: Instrument[];

  /** Repeat barlines parsed from the score source (Feature 041) */
  repeat_barlines?: RepeatBarline[];

  /** Volta brackets / first-second endings (Feature 047) */
  volta_brackets?: VoltaBracket[];

  /** Duration of pickup/anacrusis measure in ticks (0 = no pickup) */
  pickup_ticks?: number;

  /** Actual cumulative tick at end of each measure, for shortened measures */
  measure_end_ticks?: number[];
}

/** Type of repeat barline (Feature 041) */
export type RepeatBarlineType = 'Start' | 'End' | 'Both';

/** A repeat barline anchored to a specific measure (Feature 041) */
export interface RepeatBarline {
  /** 0-based measure index within the score */
  measure_index: number;
  /** Tick position at the start of this measure (inclusive) */
  start_tick: number;
  /** Tick position at the end of this measure (exclusive) */
  end_tick: number;
  /** Whether this is a start-repeat, end-repeat, or both */
  barline_type: RepeatBarlineType;
}

/** Right-end style of a volta bracket (Feature 047) */
export type VoltaEndType = 'Stop' | 'Discontinue';

/** A volta bracket (first or second ending) in the score (Feature 047) */
export interface VoltaBracket {
  /** 1 = first ending, 2 = second ending */
  number: 1 | 2;
  /** 0-based measure index of the first measure under the bracket */
  start_measure_index: number;
  /** 0-based measure index of the last measure under the bracket (inclusive) */
  end_measure_index: number;
  /** Tick position at the start of the bracket (inclusive) */
  start_tick: number;
  /** Tick position at the end of the bracket (exclusive) */
  end_tick: number;
  /** Whether the right end is closed (stop) or open (discontinue) */
  end_type: VoltaEndType;
}

/**
 * Get the instrument for playback from a score
 * Feature 003: Music Playback - MVP uses first instrument only
 * Provides backward compatibility for scores without instruments
 */
export function getScoreInstrument(score: Score): Instrument {
  if (score.instruments.length === 0) {
    // Backward compatibility: no instruments → default piano
    return {
      id: 'default',
      name: 'Default Piano',
      instrument_type: 'piano',
      staves: [],
    };
  }
  return score.instruments[0]; // MVP: Use first instrument only
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Request to create a new score */
export interface CreateScoreRequest {
  title?: string;
}

/** Request to add an instrument */
export interface AddInstrumentRequest {
  name: string;
}

/** Request to add a note */
export interface AddNoteRequest {
  start_tick: Tick;
  duration_ticks: number;
  pitch: Pitch;
}

/** Request to add a tempo event */
export interface AddTempoEventRequest {
  tick: Tick;
  bpm: BPM;
}

/** Request to add a time signature event */
export interface AddTimeSignatureEventRequest {
  tick: Tick;
  numerator: number;
  denominator: number;
}

/** Request to add a clef event */
export interface AddClefEventRequest {
  tick: Tick;
  clef_type: ClefType;
}

/** Request to add a key signature event */
export interface AddKeySignatureEventRequest {
  tick: Tick;
  key: KeySignature;
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
}

/** API response wrapper for async operations */
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
