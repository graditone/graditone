use crate::domain::{
    ids::NoteId,
    value_objects::{NoteSpelling, Pitch, Tick},
};
use serde::{Deserialize, Serialize};

/// The role this note plays in a tie relationship (domain-level).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TieType {
    Start,
    Continue,
    Stop,
}

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
    /// If this note starts or continues a tie, the ID of the next tied note.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tie_next: Option<NoteId>,
    /// True if this note is a continuation (no new attack in playback/practice).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_tie_continuation: bool,
    /// If a slur starts on this note, the ID of the note where it ends.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slur_next: Option<NoteId>,
    /// Slur direction from MusicXML: true=above, false=below, None=auto.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slur_above: Option<bool>,
    /// Grace note (ornamental, no rhythmic duration)
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_grace: bool,
    /// Explicit accidental from MusicXML (courtesy/editorial — always display)
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub has_explicit_accidental: bool,
    /// Explicit stem direction from MusicXML `<stem>` element.
    /// `Some(true)` = stem down, `Some(false)` = stem up, `None` = not specified.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stem_down: Option<bool>,
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
            tie_next: None,
            is_tie_continuation: false,
            slur_next: None,
            slur_above: None,
            is_grace: false,
            has_explicit_accidental: false,
            stem_down: None,
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

    /// Set tie_next (builder pattern)
    pub fn with_tie_next(mut self, next_id: NoteId) -> Self {
        self.tie_next = Some(next_id);
        self
    }

    /// Mark as tie continuation (builder pattern)
    pub fn with_tie_continuation(mut self) -> Self {
        self.is_tie_continuation = true;
        self
    }

    /// Mark as having an explicit MusicXML accidental (builder pattern)
    pub fn with_explicit_accidental(mut self) -> Self {
        self.has_explicit_accidental = true;
        self
    }

    /// Set explicit stem direction from MusicXML (builder pattern)
    pub fn with_stem_down(mut self, down: bool) -> Self {
        self.stem_down = Some(down);
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
