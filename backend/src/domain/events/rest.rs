use crate::domain::{ids::RestEventId, value_objects::Tick};
use serde::{Deserialize, Serialize};

/// RestEvent represents a period of silence in a voice.
///
/// Carries enough information for the layout engine to select the correct
/// SMuFL glyph and position it on the staff.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RestEvent {
    pub id: RestEventId,
    pub start_tick: Tick,
    /// Duration in 960 PPQ ticks — must be > 0.
    pub duration_ticks: u32,
    /// MusicXML note-type string (e.g., "whole", "half", "quarter", "eighth",
    /// "16th", "32nd", "64th"). Used as primary glyph selection key; falls back
    /// to duration-based selection when `None`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_type: Option<String>,
    /// MusicXML voice number (1-indexed). Used for vertical positioning in
    /// multi-voice staves: odd voices shift up, even voices shift down.
    pub voice: usize,
    /// MusicXML staff number (1-indexed).
    pub staff: usize,

    /// `<rest measure="yes"/>` — a rest that fills the entire measure regardless of duration.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_measure_rest: bool,
}

impl RestEvent {
    /// Create a new RestEvent.
    ///
    /// # Panics
    /// Panics if `duration_ticks == 0`.
    pub fn new(
        start_tick: Tick,
        duration_ticks: u32,
        note_type: Option<String>,
        voice: usize,
        staff: usize,
    ) -> Self {
        assert!(duration_ticks > 0, "RestEvent duration_ticks must be > 0");
        Self {
            id: RestEventId::new(),
            start_tick,
            duration_ticks,
            note_type,
            voice,
            staff,
            is_measure_rest: false,
        }
    }

    /// Create a new RestEvent marked as a full-measure rest.
    pub fn new_measure_rest(
        start_tick: Tick,
        duration_ticks: u32,
        note_type: Option<String>,
        voice: usize,
        staff: usize,
    ) -> Self {
        assert!(duration_ticks > 0, "RestEvent duration_ticks must be > 0");
        Self {
            id: RestEventId::new(),
            start_tick,
            duration_ticks,
            note_type,
            voice,
            staff,
            is_measure_rest: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rest_event_new_valid() {
        let rest = RestEvent::new(Tick::new(0), 960, Some("quarter".to_string()), 1, 1);
        assert_eq!(rest.duration_ticks, 960);
        assert_eq!(rest.voice, 1);
        assert_eq!(rest.staff, 1);
        assert_eq!(rest.note_type.as_deref(), Some("quarter"));
    }

    #[test]
    #[should_panic(expected = "duration_ticks must be > 0")]
    fn test_rest_event_zero_duration_panics() {
        RestEvent::new(Tick::new(0), 0, None, 1, 1);
    }

    #[test]
    fn test_rest_event_no_note_type() {
        let rest = RestEvent::new(Tick::new(3840), 480, None, 2, 1);
        assert_eq!(rest.note_type, None);
        assert_eq!(rest.voice, 2);
    }
}
