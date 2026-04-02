// Music Engine TypeScript Wrapper - Feature 011-wasm-music-engine
// Provides a TypeScript-friendly interface to WASM music functions

import { getWasmModule, initWasm } from './loader';
import type { WasmError } from '../../types/wasm-error';
import { isWasmError, WasmEngineError } from '../../types/wasm-error';
import type { Score } from '../../types/score';
import type { DifficultyRating } from '../../types/score';
import type { ImportWarning } from '../../types/import-warning';

/**
 * Ensure WASM is initialized before calling functions
 * @throws WasmEngineError if WASM is not initialized
 */
async function ensureWasmInitialized(): Promise<void> {
  const module = getWasmModule();
  if (!module) {
    try {
      await initWasm();
    } catch (error) {
      throw new WasmEngineError(
        'Failed to initialize WASM engine',
        error instanceof Error ? undefined : error as WasmError
      );
    }
  }
}

/**
 * Handle WASM function errors
 * Converts WASM errors to WasmEngineError instances
 */
function handleWasmError(error: unknown): never {
  if (isWasmError(error)) {
    throw WasmEngineError.fromWasmError(error);
  }
  
  if (error instanceof Error) {
    throw new WasmEngineError(error.message);
  }
  
  throw new WasmEngineError('Unknown WASM error occurred');
}

// ============================================================================
// Schema version — single source of truth from WASM
// ============================================================================

/**
 * Return the current score schema version from the WASM backend.
 * Use this instead of a hardcoded constant so frontend and backend
 * can never go out of sync.
 */
export async function getSchemaVersion(): Promise<number> {
  await ensureWasmInitialized();
  const wasmModule = getWasmModule();
  if (!wasmModule) {
    throw new WasmEngineError('WASM module not initialized');
  }
  return wasmModule.get_schema_version() as number;
}

// ============================================================================
// Phase 3: User Story 1 - MusicXML Parsing
// ============================================================================

/**
 * WASM ImportResult structure returned by parse_musicxml
 * Matches backend ImportResult from backend/src/ports/importers.rs
 */
export interface WasmImportResult {
  score: Score;
  statistics: {
    instrument_count: number;
    staff_count: number;
    voice_count: number;
    note_count: number;
    duration_ticks: number;
    warning_count: number;
    skipped_element_count: number;
  };
  warnings: ImportWarning[];
  partial_import: boolean;
  /** Feature 022: Import metadata including title from MusicXML */
  metadata: {
    format: string;
    file_name?: string;
    work_title?: string;
    composer?: string;
  };
}

/**
 * Parse MusicXML content using WASM engine
 * 
 * @param xmlContent - MusicXML file content as string
 * @returns ImportResult with parsed score, statistics, and warnings
 * @throws WasmEngineError if parsing fails
 */
export async function parseMusicXML(xmlContent: string): Promise<WasmImportResult> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    // Call the WASM function - now returns ImportResult with score, statistics, warnings
    const result = wasmModule.parse_musicxml(xmlContent);
    
    // The result is already a JavaScript object (deserialized by wasm-bindgen)
    return result as WasmImportResult;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Compute difficulty for a score region and optional staff.
 *
 * staffIndex: -1 for both hands, 0+ for a specific staff.
 * Returns null when the region has no notes.
 */
export function computeRegionDifficulty(
  score: Score,
  startMeasure: number,
  endMeasure: number,
  staffIndex: number,
): DifficultyRating | null {
  const wasmModule = getWasmModule();
  if (!wasmModule) {
    throw new WasmEngineError('WASM module not initialized');
  }

  try {
    const result = wasmModule.compute_region_difficulty(score, startMeasure, endMeasure, staffIndex);
    return (result as DifficultyRating | null) ?? null;
  } catch (error) {
    console.error('[WASM] compute_region_difficulty THREW:', error, { startMeasure, endMeasure, staffIndex });
    handleWasmError(error);
  }
}

// ============================================================================
// Phase 4: User Story 2 - Domain Operations
// ============================================================================

/**
 * Create a new empty score with default structural events
 * 
 * @param title - Optional score title
 * @returns New Score with default tempo (120 BPM) and time signature (4/4)
 * @throws WasmEngineError if creation fails
 */
export async function createScore(title?: string): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.create_score(title);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add an instrument to a score
 * 
 * @param score - Current score
 * @param name - Instrument name (e.g., "Piano", "Violin")
 * @returns Updated score with added instrument
 * @throws WasmEngineError if operation fails
 */
export async function addInstrument(score: Score, name: string): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_instrument(score, name);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a staff to an instrument
 * 
 * @param score - Current score
 * @param instrumentId - UUID of the target instrument
 * @returns Updated score with added staff
 * @throws WasmEngineError if instrument not found or operation fails
 */
export async function addStaff(score: Score, instrumentId: string): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_staff(score, instrumentId);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a voice to a staff
 * 
 * @param score - Current score
 * @param staffId - UUID of the target staff
 * @returns Updated score with added voice
 * @throws WasmEngineError if staff not found or operation fails
 */
export async function addVoice(score: Score, staffId: string): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_voice(score, staffId);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a note to a voice with domain validation
 * 
 * @param score - Current score
 * @param voiceId - UUID of the target voice
 * @param note - Note to add (must have tick, duration, pitch)
 * @returns Updated score with added note
 * @throws WasmEngineError if validation fails or voice not found
 */
export async function addNote(
  score: Score,
  voiceId: string,
  note: { id: string; tick: number; duration: number; pitch: number }
): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_note(score, voiceId, note);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a tempo change event
 * 
 * @param score - Current score
 * @param tick - Absolute position in score timeline (960 PPQ resolution)
 * @param bpm - Beats per minute
 * @returns Updated score with added tempo event
 * @throws WasmEngineError if validation fails
 */
export async function addTempoEvent(
  score: Score,
  tick: number,
  bpm: number
): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_tempo_event(score, tick, bpm);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a time signature change event
 * 
 * @param score - Current score
 * @param tick - Absolute position in score timeline
 * @param numerator - Top number (e.g., 4 in 4/4)
 * @param denominator - Bottom number (e.g., 4 in 4/4, must be power of 2)
 * @returns Updated score with added time signature event
 * @throws WasmEngineError if validation fails
 */
export async function addTimeSignatureEvent(
  score: Score,
  tick: number,
  numerator: number,
  denominator: number
): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_time_signature_event(score, tick, numerator, denominator);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a clef change event to a staff
 * 
 * @param score - Current score
 * @param staffId - UUID of the target staff
 * @param tick - Absolute position in score timeline
 * @param clefType - Clef type (treble, bass, alto, tenor)
 * @returns Updated score with added clef event
 * @throws WasmEngineError if staff not found or validation fails
 */
export async function addClefEvent(
  score: Score,
  staffId: string,
  tick: number,
  clefType: 'treble' | 'bass' | 'alto' | 'tenor'
): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_clef_event(score, staffId, tick, clefType);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Add a key signature change event to a staff
 * 
 * @param score - Current score
 * @param staffId - UUID of the target staff
 * @param tick - Absolute position in score timeline
 * @param key - Key signature (e.g., "C", "G", "Dm", "F#")
 * @returns Updated score with added key signature event
 * @throws WasmEngineError if staff not found or invalid key
 */
export async function addKeySignatureEvent(
  score: Score,
  staffId: string,
  tick: number,
  key: string
): Promise<Score> {
  await ensureWasmInitialized();
  
  try {
    const wasmModule = getWasmModule();
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    const result = wasmModule.add_key_signature_event(score, staffId, tick, key);
    return result as Score;
  } catch (error) {
    handleWasmError(error);
  }
}

/**
 * Export utility functions for use in other modules
 */
export { ensureWasmInitialized, handleWasmError };
