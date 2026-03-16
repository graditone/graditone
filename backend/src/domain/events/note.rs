use crate::domain::{
    ids::NoteId,
    value_objects::{NoteSpelling, Pitch, Tick},
};
use serde::{Deserialize, Serialize};

/// Beam state for serialization through the layout pipeline
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NoteBeamType {
    Begin,
    Continue,
    End,
    ForwardHook,
    BackwardHook,
}

/// Beam annotation on a note for serialization through the layout pipeline
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteBeamData {
    /// Beam level (1=8th, 2=16th, 3=32nd, etc.)
    pub number: u8,
    /// Beam state at this note for this level
    pub beam_type: NoteBeamType,
}

/// Note represents a musical note with timing and pitch
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub id: NoteId,
    pub start_tick: Tick,
    pub duration_ticks: u32,
    pub pitch: Pitch,
    /// Optional enharmonic spelling (e.g., D# vs Eb) preserved from MusicXML import
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spelling: Option<NoteSpelling>,
    /// Beam annotations from MusicXML import (empty if no beams)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub beams: Vec<NoteBeamData>,
    /// Staccato articulation (dot above/below note)
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub staccato: bool,
    /// Number of augmentation dots (0 = none, 1 = dotted, 2 = double-dotted)
    #[serde(default, skip_serializing_if = "is_zero_u8")]
    pub dot_count: u8,
}

fn is_zero_u8(v: &u8) -> bool {
    *v == 0
}

impl Note {
    pub fn new(start_tick: Tick, duration_ticks: u32, pitch: Pitch) -> Result<Self, &'static str> {
        if duration_ticks == 0 {
            return Err("duration_ticks must be greater than 0");
        }

        Ok(Self {
            id: NoteId::new(),
            start_tick,
            duration_ticks,
            pitch,
            spelling: None,
            beams: Vec::new(),
            staccato: false,
            dot_count: 0,
        })
    }

    /// Set the enharmonic spelling for this note (builder pattern)
    pub fn with_spelling(mut self, spelling: NoteSpelling) -> Self {
        self.spelling = Some(spelling);
        self
    }

    /// Set beam annotations for this note (builder pattern)
    pub fn with_beams(mut self, beams: Vec<NoteBeamData>) -> Self {
        self.beams = beams;
        self
    }

    /// Set staccato flag (builder pattern)
    pub fn with_staccato(mut self) -> Self {
        self.staccato = true;
        self
    }

    /// Set augmentation dot count (builder pattern)
    pub fn with_dot_count(mut self, count: u8) -> Self {
        self.dot_count = count;
        self
    }

    pub fn end_tick(&self) -> Tick {
        self.start_tick.add(self.duration_ticks)
    }

    pub fn overlaps_with(&self, other: &Note) -> bool {
        // Two notes overlap if one starts before the other ends
        self.start_tick < other.end_tick() && other.start_tick < self.end_tick()
    }
}
