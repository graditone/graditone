/* tslint:disable */
/* eslint-disable */

/**
 * WASM-compatible version of LayoutConfig for TypeScript bindings
 *
 * Exists as a separate type to provide cleaner TypeScript interface
 */
export class LayoutConfigWasm {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create new LayoutConfig with default values
     */
    constructor();
    /**
     * Convert to JSON string
     */
    to_json(): string;
    /**
     * Get max system width
     */
    max_system_width: number;
    /**
     * Get system height
     */
    system_height: number;
    /**
     * Get system spacing
     */
    system_spacing: number;
    /**
     * Get units per space
     */
    units_per_space: number;
}

/**
 * Add a clef change event to a staff
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `staff_id` - UUID of the target staff
 * * `tick` - Absolute position in score timeline
 * * `clef_type` - Clef type (treble, bass, alto, tenor)
 *
 * # Returns
 * * JsValue representing the updated Score with added clef event
 */
export function add_clef_event(score_js: any, staff_id: string, tick: number, clef_type: string): any;

/**
 * Add an instrument to a score
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `name` - Instrument name (e.g., "Piano", "Violin")
 *
 * # Returns
 * * JsValue representing the updated Score with added instrument
 */
export function add_instrument(score_js: any, name: string): any;

/**
 * Add a key signature change event to a staff
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `staff_id` - UUID of the target staff
 * * `tick` - Absolute position in score timeline
 * * `key` - Key signature (e.g., "C", "G", "Dm", "F#")
 *
 * # Returns
 * * JsValue representing the updated Score with added key signature event
 */
export function add_key_signature_event(score_js: any, staff_id: string, tick: number, key: string): any;

/**
 * Add a note to a voice with domain validation
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `voice_id` - UUID of the target voice
 * * `note_js` - Note to add as JsValue
 *
 * # Returns
 * * JsValue representing the updated Score with added note
 */
export function add_note(score_js: any, voice_id: string, note_js: any): any;

/**
 * Add a staff to an instrument
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `instrument_id` - UUID of the target instrument
 *
 * # Returns
 * * JsValue representing the updated Score with added staff
 */
export function add_staff(score_js: any, instrument_id: string): any;

/**
 * Add a tempo change event
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `tick` - Absolute position in score timeline (960 PPQ resolution)
 * * `bpm` - Beats per minute
 *
 * # Returns
 * * JsValue representing the updated Score with added tempo event
 */
export function add_tempo_event(score_js: any, tick: number, bpm: number): any;

/**
 * Add a time signature change event
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `tick` - Absolute position in score timeline
 * * `numerator` - Top number (e.g., 4 in 4/4)
 * * `denominator` - Bottom number (e.g., 4 in 4/4, must be power of 2)
 *
 * # Returns
 * * JsValue representing the updated Score with added time signature event
 */
export function add_time_signature_event(score_js: any, tick: number, numerator: number, denominator: number): any;

/**
 * Add a voice to a staff
 *
 * # Arguments
 * * `score_js` - Current score as JsValue
 * * `staff_id` - UUID of the target staff
 *
 * # Returns
 * * JsValue representing the updated Score with added voice
 */
export function add_voice(score_js: any, staff_id: string): any;

/**
 * WASM-compatible wrapper for compute_layout
 *
 * Takes JSON strings as input and returns JsValue output to avoid
 * Unicode encoding issues with string serialization.
 *
 * # Arguments
 * * `score_json` - CompiledScore as JSON string
 * * `config_json` - LayoutConfig as JSON string (optional, uses defaults if empty)
 *
 * # Returns
 * GlobalLayout as JsValue (JavaScript object)
 *
 * # Errors
 * Returns JS error if JSON parsing or layout computation fails
 */
export function compute_layout_wasm(score_json: string, config_json: string): any;

export function compute_region_difficulty(score_js: any, start_measure: number, end_measure: number, staff_index: number): any;

/**
 * Create a new empty score with default structural events
 *
 * # Arguments
 * * `title` - Optional score title (will be ignored as Score doesn't have title field)
 *
 * # Returns
 * * JsValue representing the new Score with default tempo (120 BPM) and time signature (4/4)
 */
export function create_score(_title?: string | null): any;

/**
 * Return the current score schema version so the frontend can validate
 * cached scores without maintaining a duplicate constant.
 */
export function get_schema_version(): number;

/**
 * Parse MusicXML content and return ImportResult with Score, metadata, statistics, and warnings
 *
 * # Arguments
 * * `xml_content` - MusicXML file content as string
 *
 * # Returns
 * * JsValue representing ImportResult (Score with warnings and statistics)
 *
 * # Errors
 * * Returns JsValue error if parsing or conversion fails
 */
export function parse_musicxml(xml_content: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_layoutconfigwasm_free: (a: number, b: number) => void;
    readonly add_clef_event: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly add_instrument: (a: number, b: number, c: number, d: number) => void;
    readonly add_key_signature_event: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly add_note: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly add_staff: (a: number, b: number, c: number, d: number) => void;
    readonly add_tempo_event: (a: number, b: number, c: number, d: number) => void;
    readonly add_time_signature_event: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly add_voice: (a: number, b: number, c: number, d: number) => void;
    readonly compute_layout_wasm: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly compute_region_difficulty: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly create_score: (a: number, b: number, c: number) => void;
    readonly get_schema_version: () => number;
    readonly layoutconfigwasm_max_system_width: (a: number) => number;
    readonly layoutconfigwasm_new: () => number;
    readonly layoutconfigwasm_set_max_system_width: (a: number, b: number) => void;
    readonly layoutconfigwasm_set_system_height: (a: number, b: number) => void;
    readonly layoutconfigwasm_set_system_spacing: (a: number, b: number) => void;
    readonly layoutconfigwasm_set_units_per_space: (a: number, b: number) => void;
    readonly layoutconfigwasm_system_height: (a: number) => number;
    readonly layoutconfigwasm_system_spacing: (a: number) => number;
    readonly layoutconfigwasm_to_json: (a: number, b: number) => void;
    readonly layoutconfigwasm_units_per_space: (a: number) => number;
    readonly parse_musicxml: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
