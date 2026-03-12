/**
 * Contract: VoltaBracket — Feature 047-repeat-volta-playback
 *
 * Defines the TypeScript contract between the Rust/WASM backend and the
 * frontend for volta bracket data (first/second endings).
 *
 * These types mirror the Rust structs in:
 *   backend/src/domain/repeat.rs    — VoltaBracket, VoltaEndType
 *   backend/src/layout/types.rs     — VoltaBracketLayout
 *   backend/src/adapters/dtos.rs    — ScoreDto.volta_brackets
 *
 * Serialization: JSON via serde. Field names use snake_case (Rust convention,
 * preserved by serde_wasm_bindgen).
 */

// ---------------------------------------------------------------------------
// Score domain contract
// ---------------------------------------------------------------------------

/**
 * Whether the right end of a volta bracket is closed (with a vertical stroke)
 * or open (no closing stroke).
 *
 * Maps to MusicXML `<ending type="stop">` → 'Stop'
 *              and `<ending type="discontinue">` → 'Discontinue'
 */
export type VoltaEndType = 'Stop' | 'Discontinue';

/**
 * A single volta bracket region in the score (one first or second ending).
 *
 * Stored in `Score.volta_brackets[]` (schema v7+).
 * Pre-v7 scores deserialize with an empty array via serde `#[serde(default)]`.
 */
export interface VoltaBracket {
  /** Ending number: 1 = first ending, 2 = second ending */
  number: 1 | 2;
  /** 0-based measure index of the first measure under the bracket */
  start_measure_index: number;
  /** 0-based measure index of the last measure under the bracket (inclusive) */
  end_measure_index: number;
  /**
   * Tick position at the start of the first measure under the bracket (inclusive).
   * Integer, 960 PPQ. Mirrors the RepeatBarline.start_tick convention.
   */
  start_tick: number;
  /**
   * Tick position at the end of the last measure under the bracket (exclusive).
   * Integer, 960 PPQ. Mirrors the RepeatBarline.end_tick convention.
   */
  end_tick: number;
  /** Right-end style of the bracket */
  end_type: VoltaEndType;
}

// ---------------------------------------------------------------------------
// Score wire shape (subset relevant to this feature)
// ---------------------------------------------------------------------------

/**
 * Wire shape of the Score JSON returned by `parse_musicxml` / stored in IndexedDB.
 * Shows only fields relevant to this feature; other Score fields are omitted.
 */
export interface ScoreWireShape {
  schema_version: number; // 7 for scores containing volta_brackets
  /** Optional — absent in pre-v7 scores, treated as [] */
  repeat_barlines?: RepeatBarlineWire[];
  /** Optional — absent in pre-v7 scores, treated as [] */
  volta_brackets?: VoltaBracket[];
}

/** Minimal repeat barline wire shape used by RepeatNoteExpander */
export interface RepeatBarlineWire {
  measure_index: number;
  start_tick: number;
  end_tick: number;
  barline_type: 'Start' | 'End' | 'Both';
}

// ---------------------------------------------------------------------------
// Layout output contract
// ---------------------------------------------------------------------------

/**
 * A positioned volta bracket produced by the Rust layout engine.
 *
 * Lives in `System.volta_bracket_layouts[]` in the layout output.
 * All coordinates are in logical units (system-relative).
 * Frontend renders these without performing any coordinate calculations
 * (Constitution Principle VI).
 */
export interface VoltaBracketLayout {
  /** Ending number (1 or 2) */
  number: 1 | 2;
  /** Display label text, e.g. "1." */
  label: string;
  /** x-position of the left edge of the horizontal bracket line (logical units) */
  x_start: number;
  /** x-position of the right edge of the horizontal bracket line (logical units) */
  x_end: number;
  /**
   * y-position of the bracket line (logical units).
   * Positioned above the topmost staff line of the topmost staff in the system.
   */
  y: number;
  /** If true, render a closing vertical stroke at the right end of the bracket */
  closed_right: boolean;
}

// ---------------------------------------------------------------------------
// Playback expander function contract
// ---------------------------------------------------------------------------

/**
 * Extended signature for expandNotesWithRepeats (RepeatNoteExpander.ts).
 *
 * When voltaBrackets is provided and non-empty, the expander skips
 * first-ending notes on the second pass through each repeat section,
 * and adjusts tickOffset to keep second-ending and post-repeat notes
 * correctly positioned in virtual playback time.
 */
export type ExpandNotesWithRepeats = (
  notes: Note[],
  repeatBarlines: RepeatBarlineWire[] | undefined,
  voltaBrackets?: VoltaBracket[],
) => Note[];

/** Minimal Note shape needed for the contract */
export interface Note {
  id: string;
  start_tick: number;
  // ... other Note fields omitted
}
