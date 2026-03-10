use crate::domain::{
    errors::DomainError, events::note::Note, events::rest::RestEvent, ids::VoiceId,
};
use serde::{Deserialize, Serialize};

/// Voice contains interval events (notes) and rest events within a staff
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Voice {
    pub id: VoiceId,
    pub interval_events: Vec<Note>,
    /// Rest events parsed from MusicXML, ordered by start_tick.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rest_events: Vec<RestEvent>,
}

impl Voice {
    pub fn new() -> Self {
        Self {
            id: VoiceId::new(),
            interval_events: Vec::new(),
            rest_events: Vec::new(),
        }
    }

    /// Add a note to this voice with overlap validation
    pub fn add_note(&mut self, note: Note) -> Result<(), DomainError> {
        // Check for overlapping notes with the same pitch
        for existing_note in &self.interval_events {
            if existing_note.pitch == note.pitch && existing_note.overlaps_with(&note) {
                return Err(DomainError::ConstraintViolation(format!(
                    "Note with pitch {} overlaps with existing note at the same pitch",
                    note.pitch.value()
                )));
            }
        }

        self.interval_events.push(note);
        Ok(())
    }

    /// Check if a note can be added without overlapping (non-mutating)
    ///
    /// Returns true if the note can be added safely, false if it would overlap
    /// with an existing note of the same pitch.
    pub fn can_add_note(&self, note: &Note) -> bool {
        !self.has_overlapping_note(note)
    }

    /// Check if a note with a specific pitch overlaps with any existing notes
    pub fn has_overlapping_note(&self, note: &Note) -> bool {
        self.interval_events
            .iter()
            .any(|existing| existing.pitch == note.pitch && existing.overlaps_with(note))
    }
}

impl Default for Voice {
    fn default() -> Self {
        Self::new()
    }
}
