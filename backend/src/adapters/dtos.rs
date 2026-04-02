// Shared DTOs for API and WASM adapters
// These DTOs add computed fields like active_clef to domain entities

use crate::domain::{
    difficulty::DifficultyRating,
    events::{
        dynamics::{DynamicMarking, GradualDynamic},
        global::GlobalStructuralEvent,
        staff::StaffStructuralEvent,
    },
    instrument::Instrument,
    phrases::PhraseRegion,
    repeat::{RepeatBarline, VoltaBracket},
    score::{OctaveShiftRegion, Score},
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
/// v8: octave_shift_regions added to ScoreDto (050-fix-layout-preloaded-scores)
/// v9: fingering annotations added to Note (fingering-layout)
/// v10: difficulty_rating added to ScoreDto (055-score-difficulty-density)
/// v11: phrases added to ScoreDto (062-score-phrase-detection)
/// v12: dynamics and gradual_dynamics added to ScoreDto (063-midi-volume-control)
pub const SCORE_SCHEMA_VERSION: u32 = 12;

/// DTO for difficulty rating serialization (Feature 055)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRatingDto {
    pub density_rate: f64,
    pub level: u8,
}

impl From<&DifficultyRating> for DifficultyRatingDto {
    fn from(rating: &DifficultyRating) -> Self {
        Self {
            density_rate: rating.density_rate,
            level: rating.level as u8,
        }
    }
}

/// DTO for phrase region serialization (Feature 062)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhraseRegionDto {
    pub instrument_index: usize,
    pub start_measure: usize,
    pub end_measure: usize,
    pub start_tick: u32,
    pub end_tick: u32,
}

impl From<&PhraseRegion> for PhraseRegionDto {
    fn from(phrase: &PhraseRegion) -> Self {
        Self {
            instrument_index: phrase.instrument_index,
            start_measure: phrase.start_measure,
            end_measure: phrase.end_measure,
            start_tick: phrase.start_tick,
            end_tick: phrase.end_tick,
        }
    }
}

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
    /// Octave-shift regions (8va/8vb brackets) per staff (Feature 050)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub octave_shift_regions: Vec<OctaveShiftRegion>,
    /// Computed difficulty rating based on note density (Feature 055)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub difficulty_rating: Option<DifficultyRatingDto>,
    /// Detected phrase regions per instrument (Feature 062)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub phrases: Vec<PhraseRegionDto>,
    /// Dynamic markings extracted from MusicXML (Feature 063)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dynamics: Vec<DynamicMarking>,
    /// Gradual dynamics (crescendo/diminuendo) from MusicXML (Feature 063)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gradual_dynamics: Vec<GradualDynamic>,
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
            octave_shift_regions: score.octave_shift_regions.clone(),
            difficulty_rating: score
                .difficulty_rating
                .as_ref()
                .map(DifficultyRatingDto::from),
            phrases: score.phrases.iter().map(PhraseRegionDto::from).collect(),
            dynamics: score.dynamics.clone(),
            gradual_dynamics: score.gradual_dynamics.clone(),
        }
    }
}

impl ScoreDto {
    /// Convert a ScoreDto back to a domain Score.
    ///
    /// Used by WASM bindings that receive a JS Score object (which is always
    /// serialized in DTO shape) and need a domain Score for domain functions.
    pub fn to_domain_score(&self) -> Score {
        use crate::domain::ids::{InstrumentId, ScoreId, StaffId};

        let score_id = ScoreId::parse(&self.id).unwrap_or_default();

        let instruments = self
            .instruments
            .iter()
            .map(|inst_dto| {
                let inst_id = InstrumentId::parse(&inst_dto.id).unwrap_or_default();
                let staves = inst_dto
                    .staves
                    .iter()
                    .map(|staff_dto| {
                        let staff_id = StaffId::parse(&staff_dto.id).unwrap_or_default();
                        Staff {
                            id: staff_id,
                            staff_structural_events: staff_dto.staff_structural_events.clone(),
                            voices: staff_dto.voices.clone(),
                        }
                    })
                    .collect();

                Instrument {
                    id: inst_id,
                    name: inst_dto.name.clone(),
                    instrument_type: inst_dto.instrument_type.clone(),
                    staves,
                }
            })
            .collect();

        let difficulty_rating = self.difficulty_rating.as_ref().map(|dto| {
            use crate::domain::difficulty::DifficultyLevel;
            DifficultyRating {
                density_rate: dto.density_rate,
                level: DifficultyLevel::from_density_rate(dto.density_rate),
            }
        });

        let phrases = self
            .phrases
            .iter()
            .map(|dto| PhraseRegion {
                instrument_index: dto.instrument_index,
                start_measure: dto.start_measure,
                end_measure: dto.end_measure,
                start_tick: dto.start_tick,
                end_tick: dto.end_tick,
            })
            .collect();

        Score {
            id: score_id,
            global_structural_events: self.global_structural_events.clone(),
            instruments,
            repeat_barlines: self.repeat_barlines.clone(),
            volta_brackets: self.volta_brackets.clone(),
            pickup_ticks: self.pickup_ticks,
            measure_end_ticks: self.measure_end_ticks.clone(),
            octave_shift_regions: self.octave_shift_regions.clone(),
            difficulty_rating,
            phrases,
            dynamics: self.dynamics.clone(),
            gradual_dynamics: self.gradual_dynamics.clone(),
        }
    }
}
