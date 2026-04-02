// WASM Bindings - Feature 011-wasm-music-engine
// Exports Rust functions to JavaScript using wasm-bindgen

use super::error_handling::import_error_to_js;
use crate::adapters::dtos::{SCORE_SCHEMA_VERSION, ScoreDto};
use crate::domain::difficulty::density::{
    compute_difficulty, compute_region_difficulty as compute_region_difficulty_domain,
};
use crate::domain::importers::musicxml::{ImportContext, MusicXMLConverter, MusicXMLParser};
use crate::domain::phrases::detect_phrases;
use crate::ports::importers::{ImportMetadata, ImportStatistics};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// WASM-specific import result that uses ScoreDto (with active_clef) instead of raw Score
#[derive(Debug, Serialize, Deserialize)]
pub struct WasmImportResult {
    /// Score as DTO with computed fields like active_clef
    pub score: ScoreDto,
    /// Import metadata (file format, version, etc.)
    pub metadata: ImportMetadata,
    /// Import statistics (note count, duration, etc.)
    pub statistics: ImportStatistics,
    /// Non-fatal warnings during import
    pub warnings: Vec<crate::domain::importers::musicxml::ImportWarning>,
    /// Indicates if import was partial (some content skipped due to errors)
    pub partial_import: bool,
}

// ============================================================================
// Schema version — single source of truth for frontend cache validation
// ============================================================================

/// Return the current score schema version so the frontend can validate
/// cached scores without maintaining a duplicate constant.
#[wasm_bindgen]
pub fn get_schema_version() -> u32 {
    SCORE_SCHEMA_VERSION
}

// ============================================================================
// Phase 3: User Story 1 - MusicXML Parsing
// ============================================================================

/// Parse MusicXML content and return ImportResult with Score, metadata, statistics, and warnings
///
/// # Arguments
/// * `xml_content` - MusicXML file content as string
///
/// # Returns
/// * JsValue representing ImportResult (Score with warnings and statistics)
///
/// # Errors
/// * Returns JsValue error if parsing or conversion fails
#[wasm_bindgen]
pub fn parse_musicxml(xml_content: &str) -> Result<JsValue, JsValue> {
    // Create import context for warning collection
    let mut context = ImportContext::new();

    // Parse XML into intermediate MusicXMLDocument
    let doc = MusicXMLParser::parse(xml_content, &mut context).map_err(import_error_to_js)?;

    // Store format for metadata
    let format = format!("MusicXML {}", doc.version);

    // Feature 022: Extract title metadata before doc is consumed by convert()
    let work_title = doc.work_title.clone().or(doc.movement_title.clone());
    let composer = doc.composer.clone();

    // Convert MusicXMLDocument to domain Score
    let mut score = MusicXMLConverter::convert(doc, &mut context).map_err(import_error_to_js)?;

    // Feature 055: Compute difficulty rating from note density
    score.difficulty_rating = compute_difficulty(&score);

    // Feature 062: Detect musical phrases
    score.phrases = detect_phrases(&score);

    // Extract warnings and counts from context
    let skipped_element_count = context.skipped_element_count();
    let warnings = context.finish();

    // Calculate statistics
    let instrument_count = score.instruments.len();
    let staff_count = score.instruments.iter().map(|inst| inst.staves.len()).sum();
    let voice_count = score
        .instruments
        .iter()
        .flat_map(|inst| &inst.staves)
        .map(|staff| staff.voices.len())
        .sum();
    let note_count = score
        .instruments
        .iter()
        .flat_map(|inst| &inst.staves)
        .flat_map(|staff| &staff.voices)
        .map(|voice| voice.interval_events.len())
        .sum();
    let duration_ticks = score
        .instruments
        .iter()
        .flat_map(|inst| &inst.staves)
        .flat_map(|staff| &staff.voices)
        .flat_map(|voice| &voice.interval_events)
        .map(|note| note.end_tick().value())
        .max()
        .unwrap_or(0);

    // Check if any Error-severity warnings exist (indicates partial import)
    let partial_import = warnings.iter().any(|w| {
        matches!(
            w.severity,
            crate::domain::importers::musicxml::WarningSeverity::Error
        )
    });

    let warning_count = warnings.len();

    // Convert Score to DTO with active_clef field
    let score_dto = ScoreDto::from(&score);

    // Build WasmImportResult using ScoreDto (has active_clef)
    let result = WasmImportResult {
        score: score_dto, // Use DTO instead of raw Score
        metadata: ImportMetadata {
            format,
            file_name: None,
            work_title, // Feature 022: Populated from MusicXML metadata
            composer,   // Feature 022: Populated from MusicXML metadata
        },
        statistics: ImportStatistics {
            instrument_count,
            staff_count,
            voice_count,
            note_count,
            duration_ticks,
            warning_count,
            skipped_element_count,
        },
        warnings,
        partial_import,
    };

    // Serialize WasmImportResult to JsValue for JavaScript
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn compute_region_difficulty(
    score_js: JsValue,
    start_measure: usize,
    end_measure: usize,
    staff_index: i32,
) -> Result<JsValue, JsValue> {
    let score_dto: ScoreDto = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;
    let score = score_dto.to_domain_score();

    let measure_count = score.measure_end_ticks.len();
    if start_measure > end_measure {
        return Err(JsValue::from_str("Invalid measure range"));
    }
    if measure_count == 0 || end_measure >= measure_count {
        return Err(JsValue::from_str("Measure index out of bounds"));
    }
    if staff_index < -1 {
        return Err(JsValue::from_str("Invalid staff index"));
    }

    let staff_filter = if staff_index == -1 {
        None
    } else {
        Some(staff_index as usize)
    };

    let difficulty =
        compute_region_difficulty_domain(&score, start_measure, end_measure, staff_filter);

    // Convert to DTO so `level` is serialized as integer (1/2/3) matching the TS DifficultyLevel type
    let dto = difficulty.map(|r| crate::adapters::dtos::DifficultyRatingDto::from(&r));

    serde_wasm_bindgen::to_value(&dto)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// Phase 4: User Story 2 - Domain Operations
// ============================================================================

use super::error_handling::to_js_error;
use crate::domain::{
    events::{
        clef::ClefEvent, key_signature::KeySignatureEvent, note::Note, tempo::TempoEvent,
        time_signature::TimeSignatureEvent,
    },
    ids::{InstrumentId, StaffId, VoiceId},
    instrument::Instrument,
    score::Score,
    staff::Staff,
    value_objects::{BPM, Clef, KeySignature, Tick},
    voice::Voice,
};

/// Helper function to parse key signature string to sharps/flats count
/// Examples: "C" -> 0, "G" -> 1, "D" -> 2, "F" -> -1, "Bb" -> -2
fn parse_key_signature(key: &str) -> Result<i8, JsValue> {
    match key {
        // Major keys with sharps
        "C" => Ok(0),
        "G" => Ok(1),
        "D" => Ok(2),
        "A" => Ok(3),
        "E" => Ok(4),
        "B" => Ok(5),
        "F#" => Ok(6),
        "C#" => Ok(7),
        // Major keys with flats
        "F" => Ok(-1),
        "Bb" => Ok(-2),
        "Eb" => Ok(-3),
        "Ab" => Ok(-4),
        "Db" => Ok(-5),
        "Gb" => Ok(-6),
        "Cb" => Ok(-7),
        // Minor keys with sharps
        "Am" => Ok(0),
        "Em" => Ok(1),
        "Bm" => Ok(2),
        "F#m" => Ok(3),
        "C#m" => Ok(4),
        "G#m" => Ok(5),
        "D#m" => Ok(6),
        "A#m" => Ok(7),
        // Minor keys with flats
        "Dm" => Ok(-1),
        "Gm" => Ok(-2),
        "Cm" => Ok(-3),
        "Fm" => Ok(-4),
        "Bbm" => Ok(-5),
        "Ebm" => Ok(-6),
        "Abm" => Ok(-7),
        _ => Err(JsValue::from_str(&format!(
            "Invalid key signature: {}",
            key
        ))),
    }
}

/// Create a new empty score with default structural events
///
/// # Arguments
/// * `title` - Optional score title (will be ignored as Score doesn't have title field)
///
/// # Returns
/// * JsValue representing the new Score with default tempo (120 BPM) and time signature (4/4)
#[wasm_bindgen]
pub fn create_score(_title: Option<String>) -> Result<JsValue, JsValue> {
    let score = Score::new();

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add an instrument to a score
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `name` - Instrument name (e.g., "Piano", "Violin")
///
/// # Returns
/// * JsValue representing the updated Score with added instrument
#[wasm_bindgen]
pub fn add_instrument(score_js: JsValue, name: &str) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let instrument = Instrument::new(name.to_string());
    score.add_instrument(instrument);

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a staff to an instrument
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `instrument_id` - UUID of the target instrument
///
/// # Returns
/// * JsValue representing the updated Score with added staff
#[wasm_bindgen]
pub fn add_staff(score_js: JsValue, instrument_id: &str) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let instrument_id = InstrumentId::parse(instrument_id)
        .map_err(|e| JsValue::from_str(&format!("Invalid instrument ID: {}", e)))?;

    let instrument = score
        .instruments
        .iter_mut()
        .find(|i| i.id == instrument_id)
        .ok_or_else(|| JsValue::from_str("Instrument not found"))?;

    let staff = Staff::new();
    instrument.add_staff(staff);

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a voice to a staff
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `staff_id` - UUID of the target staff
///
/// # Returns
/// * JsValue representing the updated Score with added voice
#[wasm_bindgen]
pub fn add_voice(score_js: JsValue, staff_id: &str) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let staff_id = StaffId::parse(staff_id)
        .map_err(|e| JsValue::from_str(&format!("Invalid staff ID: {}", e)))?;

    // Find the staff in any instrument
    let mut found = false;
    for instrument in &mut score.instruments {
        if let Ok(staff) = instrument.get_staff_mut(staff_id) {
            let voice = Voice::new();
            staff.add_voice(voice);
            found = true;
            break;
        }
    }

    if !found {
        return Err(JsValue::from_str("Staff not found"));
    }

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a note to a voice with domain validation
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `voice_id` - UUID of the target voice
/// * `note_js` - Note to add as JsValue
///
/// # Returns
/// * JsValue representing the updated Score with added note
#[wasm_bindgen]
pub fn add_note(score_js: JsValue, voice_id: &str, note_js: JsValue) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let note: Note = serde_wasm_bindgen::from_value(note_js)
        .map_err(|e| JsValue::from_str(&format!("Note deserialization error: {}", e)))?;

    let voice_id = VoiceId::parse(voice_id)
        .map_err(|e| JsValue::from_str(&format!("Invalid voice ID: {}", e)))?;

    // Find the voice in any staff in any instrument
    let mut found = false;
    'outer: for instrument in &mut score.instruments {
        for staff in &mut instrument.staves {
            if let Ok(voice) = staff.get_voice_mut(voice_id) {
                voice.add_note(note.clone()).map_err(to_js_error)?;
                found = true;
                break 'outer;
            }
        }
    }

    if !found {
        return Err(JsValue::from_str("Voice not found"));
    }

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a tempo change event
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `tick` - Absolute position in score timeline (960 PPQ resolution)
/// * `bpm` - Beats per minute
///
/// # Returns
/// * JsValue representing the updated Score with added tempo event
#[wasm_bindgen]
pub fn add_tempo_event(score_js: JsValue, tick: u32, bpm: u16) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let bpm_value = BPM::new(bpm).map_err(|e| JsValue::from_str(e))?;

    let tempo_event = TempoEvent::new(Tick::new(tick), bpm_value);

    score.add_tempo_event(tempo_event).map_err(to_js_error)?;

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a time signature change event
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `tick` - Absolute position in score timeline
/// * `numerator` - Top number (e.g., 4 in 4/4)
/// * `denominator` - Bottom number (e.g., 4 in 4/4, must be power of 2)
///
/// # Returns
/// * JsValue representing the updated Score with added time signature event
#[wasm_bindgen]
pub fn add_time_signature_event(
    score_js: JsValue,
    tick: u32,
    numerator: u8,
    denominator: u8,
) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let time_sig_event = TimeSignatureEvent::new(Tick::new(tick), numerator, denominator);

    score
        .add_time_signature_event(time_sig_event)
        .map_err(to_js_error)?;

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a clef change event to a staff
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `staff_id` - UUID of the target staff
/// * `tick` - Absolute position in score timeline
/// * `clef_type` - Clef type (treble, bass, alto, tenor)
///
/// # Returns
/// * JsValue representing the updated Score with added clef event
#[wasm_bindgen]
pub fn add_clef_event(
    score_js: JsValue,
    staff_id: &str,
    tick: u32,
    clef_type: &str,
) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let staff_id = StaffId::parse(staff_id)
        .map_err(|e| JsValue::from_str(&format!("Invalid staff ID: {}", e)))?;

    let clef = match clef_type.to_lowercase().as_str() {
        "treble" => Clef::Treble,
        "bass" => Clef::Bass,
        "alto" => Clef::Alto,
        "tenor" => Clef::Tenor,
        _ => {
            return Err(JsValue::from_str(&format!(
                "Invalid clef type: {}",
                clef_type
            )));
        }
    };

    let clef_event = ClefEvent::new(Tick::new(tick), clef);

    // Find the staff in any instrument
    let mut found = false;
    for instrument in &mut score.instruments {
        if let Ok(staff) = instrument.get_staff_mut(staff_id) {
            staff.add_clef_event(clef_event).map_err(to_js_error)?;
            found = true;
            break;
        }
    }

    if !found {
        return Err(JsValue::from_str("Staff not found"));
    }

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Add a key signature change event to a staff
///
/// # Arguments
/// * `score_js` - Current score as JsValue
/// * `staff_id` - UUID of the target staff
/// * `tick` - Absolute position in score timeline
/// * `key` - Key signature (e.g., "C", "G", "Dm", "F#")
///
/// # Returns
/// * JsValue representing the updated Score with added key signature event
#[wasm_bindgen]
pub fn add_key_signature_event(
    score_js: JsValue,
    staff_id: &str,
    tick: u32,
    key: &str,
) -> Result<JsValue, JsValue> {
    let mut score: Score = serde_wasm_bindgen::from_value(score_js)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let staff_id = StaffId::parse(staff_id)
        .map_err(|e| JsValue::from_str(&format!("Invalid staff ID: {}", e)))?;

    let sharps = parse_key_signature(key)?;
    let key_signature = KeySignature::new(sharps).map_err(|e| JsValue::from_str(e))?;

    let key_sig_event = KeySignatureEvent::new(Tick::new(tick), key_signature);

    // Find the staff in any instrument
    let mut found = false;
    for instrument in &mut score.instruments {
        if let Ok(staff) = instrument.get_staff_mut(staff_id) {
            staff
                .add_key_signature_event(key_sig_event)
                .map_err(to_js_error)?;
            found = true;
            break;
        }
    }

    if !found {
        return Err(JsValue::from_str("Staff not found"));
    }

    serde_wasm_bindgen::to_value(&score)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
