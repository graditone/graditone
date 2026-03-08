/**
 * DEPRECATED: TypeScript wrapper for Rust layout engine WASM module
 *
 * This file is now DEPRECATED and unused. WASM loading is handled by:
 * - services/wasm/loader.ts (initialization and caching)
 * - services/wasm/layoutService.ts (layout computation)
 *
 * Kept for backward compatibility only. Will be removed in future cleanup.
 */

import { initWasm, getWasmModule } from '../services/wasm/loader';

// ============================================================================
// TypeScript interfaces matching Rust layout types
// ============================================================================

/**
 * Root container for entire score layout
 */
export interface GlobalLayout {
  /** Ordered array of systems from top to bottom */
  systems: System[];
  /** Width of widest system in logical units */
  total_width: number;
  /** Sum of all system heights + inter-system spacing */
  total_height: number;
  /** Scaling factor: logical units per staff space (default: 10.0) */
  units_per_space: number;
}

/**
 * System containing 1-N measures of music arranged horizontally
 *
 * Primary virtualization boundary for efficient rendering
 */
export interface System {
  /** 0-based system number (sequential: 0, 1, 2, ...) */
  index: number;
  /** Screen region occupied by system */
  bounding_box: BoundingBox;
  /** Instruments/staff groups in this system */
  staff_groups: StaffGroup[];
  /** Musical time span covered by system (960 PPQ ticks) */
  tick_range: TickRange;
  /** Measure number displayed at start of system (1-based) */
  measure_number?: MeasureNumber;
}

/**
 * Positioned measure number at the start of a system
 *
 * Displays the 1-based measure number above the topmost staff line,
 * horizontally aligned with the clef glyph.
 */
export interface MeasureNumber {
  /** 1-based measure number */
  number: number;
  /** Absolute (x, y) coordinates for rendering */
  position: Point;
}

/**
 * Groups related staves for multi-staff instruments
 */
export interface StaffGroup {
  /** Links to CompiledScore.Instrument.id */
  instrument_id: string;
  /** Human-readable instrument name (FR-009) */
  instrument_name: string;
  /** 1-2 staves per group (MVP limit) */
  staves: Staff[];
  /** Visual grouping indicator */
  bracket_type: BracketType;
  /** Bracket/brace glyph with positioning and scale (calculated by Rust layout engine) */
  bracket_glyph?: BracketGlyph;
  /** Positioned instrument name label for rendering (FR-003) */
  name_label?: NameLabel;
}

/**
 * Positioned text label for instrument name at system start
 */
export interface NameLabel {
  /** The instrument name text to render */
  text: string;
  /** Absolute (x, y) coordinates for rendering */
  position: Point;
  /** Font size in logical units */
  font_size: number;
  /** Font family (e.g., "serif") */
  font_family: string;
  /** RGBA text color */
  color: Color;
}

/**
 * Bracket/brace glyph with vertical scaling information
 */
export interface BracketGlyph {
  /** SMuFL codepoint (e.g., "\u{E000}" for brace) */
  codepoint: string;
  /** X position (left margin) */
  x: number;
  /** Y position (vertical center point for transform) */
  y: number;
  /** Vertical scale factor (height / natural_glyph_height) */
  scale_y: number;
  /** Bounding box for the scaled glyph */
  bounding_box: BoundingBox;
}

/**
 * Single 5-line staff with positioned glyphs
 */
export interface Staff {
  /** Exactly 5 horizontal lines (standard music staff) */
  staff_lines: StaffLine[];
  /** Batched glyphs for efficient rendering */
  glyph_runs: GlyphRun[];
  /** Clefs, key signatures, time signatures at staff start */
  structural_glyphs: Glyph[];
  /** Vertical bar lines that separate measures */
  bar_lines: BarLine[];
  /** Ledger lines for notes above/below staff */
  ledger_lines: LedgerLine[];
}

/**
 * Short horizontal line for notes outside the 5-line staff range
 */
export interface LedgerLine {
  /** Vertical position in logical units (system-relative) */
  y_position: number;
  /** Left edge of ledger line in logical units */
  start_x: number;
  /** Right edge of ledger line in logical units */
  end_x: number;
}

/**
 * Single horizontal line in a staff
 */
export interface StaffLine {
  /** Vertical position in logical units (system-relative) */
  y_position: number;
  /** Left edge of line in logical units */
  start_x: number;
  /** Right edge of line in logical units */
  end_x: number;
}

/**
 * Vertical bar line that separates measures
 */
/**
 * Vertical bar line that separates measures
 */
export interface BarLine {
  /** Individual line segments (1 for Single, 2 for Double/Final/Repeat) */
  segments: BarLineSegment[];
  /** Type of bar line (single, double, final, repeat) */
  bar_type: BarLineType;
  /** Repeat dots for repeat barline types (empty for non-repeat types) */
  dots?: RepeatDot[];
}

/**
 * Individual line segment within a bar line
 */
export interface BarLineSegment {
  /** Horizontal position in logical units */
  x_position: number;
  /** Top of bar line (y-coordinate of top staff line) */
  y_start: number;
  /** Bottom of bar line (y-coordinate of bottom staff line) */
  y_end: number;
  /** Stroke width (1.5 for thin, 4.0 for thick) */
  stroke_width: number;
}

/**
 * Type of bar line
 */
export type BarLineType = 'Single' | 'Double' | 'Final' | 'RepeatStart' | 'RepeatEnd' | 'RepeatBoth';

/**
 * A single repeat dot position in layout coordinates (Feature 041)
 */
export interface RepeatDot {
  /** Horizontal center of dot in logical units */
  x: number;
  /** Vertical center of dot in logical units */
  y: number;
  /** Dot radius in logical units */
  radius: number;
}

/**
 * Batches consecutive glyphs with identical drawing properties
 */
export interface GlyphRun {
  /** All glyphs in this batch (non-empty) */
  glyphs: Glyph[];
  /** Font name (typically "Bravura" for SMuFL) */
  font_family: string;
  /** Font size in logical units (typically 40.0 = 4 staff spaces) */
  font_size: number;
  /** RGBA color for all glyphs */
  color: Color;
  /** Additional opacity multiplier (range [0.0, 1.0]) */
  opacity: number;
}

/**
 * Single drawable musical symbol with position and source linkage
 */
export interface Glyph {
  /** (x, y) coordinates in logical units (system-relative) */
  position: Point;
  /** Hit-testing rectangle including ledger lines */
  bounding_box: BoundingBox;
  /** SMuFL Unicode codepoint (e.g., '\u{E0A4}' = quarter notehead) */
  codepoint: string;
  /** Link back to CompiledScore element for interaction */
  source_reference: SourceReference;
}

/**
 * 2D coordinate in logical units
 */
export interface Point {
  /** X-coordinate (left-to-right, positive = rightward) */
  x: number;
  /** Y-coordinate (top-to-bottom, positive = downward) */
  y: number;
}

/**
 * Rectangular hit-testing and clipping region
 */
export interface BoundingBox {
  /** X-coordinate of top-left corner in logical units */
  x: number;
  /** Y-coordinate of top-left corner in logical units */
  y: number;
  /** Width in logical units */
  width: number;
  /** Height in logical units */
  height: number;
}

/**
 * Musical time span using 960 PPQ resolution
 */
export interface TickRange {
  /** First tick in range (inclusive, 960 PPQ) */
  start_tick: number;
  /** Last tick in range (exclusive, 960 PPQ) */
  end_tick: number;
}

/**
 * Links layout glyphs back to CompiledScore domain entities
 */
export interface SourceReference {
  /** CompiledScore instrument identifier */
  instrument_id: string;
  /** Staff number within instrument (0 = treble, 1 = bass for piano) */
  staff_index: number;
  /** Voice number within staff (0-3 for polyphonic notation) */
  voice_index: number;
  /** Index into voice's event array */
  event_index: number;
}

/**
 * Visual grouping indicator for multi-staff instruments
 */
export type BracketType = 'Brace' | 'Bracket' | 'None';

/**
 * RGBA color representation
 */
export interface Color {
  /** Red channel (0-255) */
  r: number;
  /** Green channel (0-255) */
  g: number;
  /** Blue channel (0-255) */
  b: number;
  /** Alpha channel (0-255) */
  a: number;
}

/**
 * Layout computation configuration
 */
export interface LayoutConfig {
  /** Maximum width for a system before line breaking (logical units) */
  max_system_width?: number;
  /** Vertical height allocated per system (logical units) */
  system_height?: number;
  /** Vertical spacing between systems (logical units) */
  system_spacing?: number;
  /** Scaling factor: logical units per staff space */
  units_per_space?: number;
}

// ============================================================================
// Main layout computation function
// ============================================================================

/**
 * Compute music layout from compiled score
 *
 * Converts abstract musical data into positioned glyphs suitable for rendering.
 * Uses Rust layout engine via WASM for performance.
 *
 * @param score - CompiledScore object from domain layer
 * @param config - Optional layout configuration (uses defaults if omitted)
 * @returns GlobalLayout with all systems, staves, and positioned glyphs
 *
 * @throws Error if score is invalid or layout computation fails
 *
 * @example
 * ```typescript
 * const score = await compileScore(musicXML);
 * const layout = await computeLayout(score, {
 *   max_system_width: 1200,
 *   system_height: 200,
 * });
 *
 * // Render visible systems
 * const visibleSystems = getVisibleSystems(layout, viewport);
 * visibleSystems.forEach(system => renderSystem(system));
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeLayout(score: any, config?: LayoutConfig): Promise<GlobalLayout> {
  // Ensure WASM is initialized
  await initWasm();
  
  // Get the WASM module
  const wasm = getWasmModule();
  if (!wasm || !wasm.compute_layout_wasm) {
    throw new Error('WASM module not initialized');
  }

  // Serialize score to JSON string
  const scoreJson = JSON.stringify(score);

  // Serialize config to JSON string (empty object if not provided)
  const configJson = JSON.stringify(config || {});

  // Call WASM function (returns JsValue/JavaScript object via serde-wasm-bindgen)
  const layout: GlobalLayout = wasm.compute_layout_wasm(scoreJson, configJson) as GlobalLayout;

  return layout;
}
