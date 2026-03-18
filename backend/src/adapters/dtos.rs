// Shared DTOs for API and WASM adapters
// These DTOs add computed fields like active_clef to domain entities

use crate::domain::{
    events::{global::GlobalStructuralEvent, staff::StaffStructuralEvent},
    instrument::Instrument,
    repeat::{RepeatBarline, VoltaBracket},
    score::Score,
    staff::Staff,
    value_objects::Clef,
    voice::Voice,
};
use serde::{Deserialize, Serialize};

// ===== Response DTOs with computed fields (Feature 007) =====

/// DTO for Staff with active_clef field derived from first ClefEvent
#[derive(Debug, Serialize, Deserialize)]
pub struct StaffDto {
    pub id: String,
    pub active_clef: Clef, // NEW: Derived from first ClefEvent
    pub staff_structural_events: Vec<StaffStructuralEvent>,
    pub voices: Vec<Voice>,
}

impl From<&Staff> for StaffDto {
    fn from(staff: &Staff) -> Self {
        // Find first ClefEvent in staff_structural_events, default to Treble
        let active_clef = staff
            .staff_structural_events
            .iter()
            .find_map(|event| match event {
                StaffStructuralEvent::Clef(clef_event) => Some(clef_event.clef),
                _ => None,
            })
            .unwrap_or(Clef::Treble);

        Self {
            id: staff.id.to_string(),
            active_clef,
            staff_structural_events: staff.staff_structural_events.clone(),
            voices: staff.voices.clone(),
        }
    }
}

/// DTO for Instrument containing StaffDtos
#[derive(Debug, Serialize, Deserialize)]
pub struct InstrumentDto {
    pub id: String,
    pub name: String,
    pub instrument_type: String,
    pub staves: Vec<StaffDto>,
}

impl From<&Instrument> for InstrumentDto {
    fn from(instrument: &Instrument) -> Self {
        Self {
            id: instrument.id.to_string(),
            name: instrument.name.clone(),
            instrument_type: instrument.instrument_type.clone(),
            staves: instrument.staves.iter().map(StaffDto::from).collect(),
        }
    }
}

/// Schema version for the Score DTO structure
/// Increment when adding/changing fields
/// v2: active_clef added to StaffDto
/// v3: WASM now returns ScoreDto instead of raw Score
/// v4: repeat_barlines added to ScoreDto
/// v5: rest_events added to Voice (043-score-rests)
/// v6: pickup_ticks added to ScoreDto (044-time-signatures)
/// v7: volta_brackets added to ScoreDto (047-repeat-volta-playback)
const SCORE_SCHEMA_VERSION: u32 = 7;

/// DTO for Score containing InstrumentDtos with schema versioning
#[derive(Debug, Serialize, Deserialize)]
pub struct ScoreDto {
    pub id: String,

    /// Schema version for data structure evolution
    /// v1: Original structure
    /// v2: Added active_clef to StaffDto
    /// v4: Added repeat_barlines
    /// v5: Added rest_events to Voice
    /// v6: Added pickup_ticks for anacrusis/pickup measure support
    /// v7: Added volta_brackets for volta bracket playback (Feature 047)
    pub schema_version: u32,

    pub global_structural_events: Vec<GlobalStructuralEvent>,
    pub instruments: Vec<InstrumentDto>,
    #[serde(default)]
    pub repeat_barlines: Vec<RepeatBarline>,
    /// Volta brackets (first/second endings) (Feature 047); serde default = [] for pre-v7 scores
    #[serde(default)]
    pub volta_brackets: Vec<VoltaBracket>,
    /// Duration of pickup/anacrusis measure in ticks (0 = no pickup)
    #[serde(default)]
    pub pickup_ticks: u32,
    /// Actual cumulative tick at the end of each measure, computed from content.
    /// Empty = fall back to formula-based calculation.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub measure_end_ticks: Vec<u32>,
}

impl From<&Score> for ScoreDto {
    fn from(score: &Score) -> Self {
        Self {
            id: score.id.to_string(),
            schema_version: SCORE_SCHEMA_VERSION,
            global_structural_events: score.global_structural_events.clone(),
            instruments: score.instruments.iter().map(InstrumentDto::from).collect(),
            repeat_barlines: score.repeat_barlines.clone(),
            volta_brackets: score.volta_brackets.clone(),
            pickup_ticks: score.pickup_ticks,
            measure_end_ticks: score.measure_end_ticks.clone(),
        }
    }
}
