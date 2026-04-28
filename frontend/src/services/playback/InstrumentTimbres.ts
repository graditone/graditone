/**
 * Timbre registry for multi-instrument audio playback.
 *
 * Maps canonical instrument type strings (from Rust `classify_instrument_type`)
 * to `TimbreConfig` objects that `PlaybackChannel` uses to build Tone.js nodes.
 *
 * Feature 088: Piano and Violin Playback Support
 */

export type TimbreSource = 'sampler' | 'polysynth';

export interface SynthEnvelope {
  /** Attack time in seconds */
  attack: number;
  /** Decay time in seconds */
  decay: number;
  /** Sustain level (0.0–1.0) */
  sustain: number;
  /** Release time in seconds */
  release: number;
}

export interface TimbreConfig {
  /** Audio source type — determines which Tone.js node is created */
  source: TimbreSource;
  /** Oscillator waveform — only used when source === 'polysynth' */
  oscillatorType?: OscillatorType;
  /** ADSR envelope — only used when source === 'polysynth' */
  envelope?: SynthEnvelope;
  /** Initial channel gain in dBFS (applied to Tone.Volume node) */
  volumeDb: number;
  /**
   * Note → filename map for Tone.Sampler — only used when source === 'sampler'
   * and the instrument has its own sample set (non-piano).
   * Piano uses the Salamander samples managed directly by ToneAdapter.
   */
  sampleUrls?: Record<string, string>;
  /**
   * Base URL path relative to BASE_URL for Tone.Sampler.
   * E.g. 'audio/violin/' → resolved as `${BASE_URL}audio/violin/`.
   * Only used when source === 'sampler' and sampleUrls is set.
   */
  sampleBaseUrl?: string;
  /** Sampler release time in seconds. Only used when source === 'sampler'. */
  sampleRelease?: number;
}

/** OscillatorType values used in the registry (subset of Web Audio API) */
type OscillatorType = 'sine' | 'triangle' | 'square' | 'sawtooth';

const TIMBRE_REGISTRY: Readonly<Record<string, TimbreConfig>> = {
  piano: {
    source: 'sampler',
    volumeDb: 0,
  },
  // Violin: real sampled instrument (public/audio/violin/). 15 samples covering
  // the full violin range (G3–C7). Tone.Sampler pitch-shifts between sample points.
  violin: {
    source: 'sampler',
    sampleUrls: {
      G3: 'G3.mp3', A3: 'A3.mp3',
      C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3',
      C5: 'C5.mp3', E5: 'E5.mp3', G5: 'G5.mp3', A5: 'A5.mp3',
      C6: 'C6.mp3', E6: 'E6.mp3', G6: 'G6.mp3', A6: 'A6.mp3',
      C7: 'C7.mp3',
    },
    sampleBaseUrl: 'audio/violin/',
    sampleRelease: 0.5,
    volumeDb: -3,
  },
  // Other bowed strings: sawtooth PolySynth (no dedicated samples yet)
  viola: {
    source: 'polysynth',
    oscillatorType: 'sawtooth',
    envelope: { attack: 0.08, decay: 0.02, sustain: 0.90, release: 0.45 },
    volumeDb: -8,
  },
  cello: {
    source: 'polysynth',
    oscillatorType: 'sawtooth',
    envelope: { attack: 0.10, decay: 0.02, sustain: 0.90, release: 0.50 },
    volumeDb: -8,
  },
  contrabass: {
    source: 'polysynth',
    oscillatorType: 'sawtooth',
    envelope: { attack: 0.12, decay: 0.03, sustain: 0.90, release: 0.60 },
    volumeDb: -6,
  },
  guitar: {
    source: 'polysynth',
    oscillatorType: 'triangle',
    envelope: { attack: 0.01, decay: 0.30, sustain: 0.30, release: 0.50 },
    volumeDb: -3,
  },
  flute: {
    source: 'polysynth',
    oscillatorType: 'sine',
    envelope: { attack: 0.05, decay: 0.02, sustain: 0.85, release: 0.25 },
    volumeDb: -6,
  },
  oboe: {
    source: 'polysynth',
    oscillatorType: 'triangle',
    envelope: { attack: 0.04, decay: 0.03, sustain: 0.80, release: 0.30 },
    volumeDb: -6,
  },
  clarinet: {
    source: 'polysynth',
    oscillatorType: 'triangle',
    envelope: { attack: 0.04, decay: 0.03, sustain: 0.75, release: 0.30 },
    volumeDb: -6,
  },
  trumpet: {
    source: 'polysynth',
    oscillatorType: 'sawtooth',
    envelope: { attack: 0.03, decay: 0.05, sustain: 0.70, release: 0.20 },
    volumeDb: -4,
  },
  default: {
    source: 'polysynth',
    oscillatorType: 'triangle',
    envelope: { attack: 0.05, decay: 0.10, sustain: 0.50, release: 0.30 },
    volumeDb: -3,
  },
};

/**
 * Look up the timbre config for a given canonical instrument type.
 * Returns a deep copy to prevent callers from mutating the registry.
 * Falls back to `"default"` for unrecognised types.
 *
 * @param instrumentType - canonical type string from `Instrument.instrument_type`
 */
export function getTimbre(instrumentType: string): TimbreConfig {
  const config = TIMBRE_REGISTRY[instrumentType] ?? TIMBRE_REGISTRY['default'];
  // Deep copy to prevent registry mutation
  return {
    ...config,
    envelope: config.envelope ? { ...config.envelope } : undefined,
    sampleUrls: config.sampleUrls ? { ...config.sampleUrls } : undefined,
  };
}

/**
 * Re-classify an instrument type from its display name when the stored type is
 * "default". This handles scores cached in IndexedDB before a WASM classifier
 * update (the cache stores the parsed result, not the raw MusicXML).
 *
 * The patterns mirror `classify_instrument_type()` in the Rust backend.
 * English, French, Italian, and German names are covered.
 *
 * @param instrumentType - stored canonical type (may be stale "default")
 * @param displayName    - human-readable instrument name from the score
 * @returns resolved canonical type string
 */
export function resolveInstrumentType(instrumentType: string, displayName: string): string {
  if (instrumentType !== 'default') return instrumentType;

  const lower = displayName.toLowerCase();

  // Contrabass first — "contrebasse" must not match violin/cello checks below
  if (lower.includes('contrabass') || lower.includes('double bass') || lower.includes('contrebasse') || lower.includes('kontrabass')) return 'contrabass';
  // "violoncell" covers "violoncello" (It.) and "violoncelle" (Fr.)
  if (lower.includes('violoncell') || lower.includes('cello')) return 'cello';
  if (lower.includes('viola') || lower.includes('bratsche')) return 'viola';
  // "violon" (Fr.) — must come after violoncell check
  if (lower.includes('violino') || lower.includes('violin') || lower.includes('violon')) return 'violin';
  if (lower.includes('piano') || lower.includes('keyboard') || lower.includes('clavier') || lower.includes('fortepiano')) return 'piano';
  if (lower.includes('guitare') || lower.includes('guitar') || lower.includes('gitarre')) return 'guitar';
  if (lower.includes('flauto') || lower.includes('flute') || lower.includes('flöte') || lower.includes('flûte')) return 'flute';
  if (lower.includes('oboe') || lower.includes('hautbois')) return 'oboe';
  if (lower.includes('clarinette') || lower.includes('clarinet') || lower.includes('klarinette')) return 'clarinet';
  if (lower.includes('trompette') || lower.includes('trumpet') || lower.includes('trompete')) return 'trumpet';

  return 'default';
}
