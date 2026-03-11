use crate::domain::{
    errors::DomainError,
    events::{
        global::GlobalStructuralEvent, tempo::TempoEvent, time_signature::TimeSignatureEvent,
    },
    ids::ScoreId,
    instrument::Instrument,
    repeat::RepeatBarline,
    value_objects::{BPM, Tick},
};
use serde::{Deserialize, Serialize};

/// Score is the aggregate root containing all musical elements
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Score {
    pub id: ScoreId,
    pub global_structural_events: Vec<GlobalStructuralEvent>,
    pub instruments: Vec<Instrument>,
    /// Repeat barlines parsed from the score source (Feature 041)
    #[serde(default)]
    pub repeat_barlines: Vec<RepeatBarline>,
    /// Duration of pickup/anacrusis measure in ticks (0 = no pickup)
    #[serde(default)]
    pub pickup_ticks: u32,
}

impl Score {
    /// Create a new score with default tempo (120 BPM) and time signature (4/4) at tick 0
    pub fn new() -> Self {
        let mut score = Self {
            id: ScoreId::new(),
            global_structural_events: Vec::new(),
            instruments: Vec::new(),
            repeat_barlines: Vec::new(),
            pickup_ticks: 0,
        };

        // Add default tempo (120 BPM) at tick 0
        let tempo_event = TempoEvent::new(Tick::new(0), BPM::new(120).unwrap());
        score
            .global_structural_events
            .push(GlobalStructuralEvent::Tempo(tempo_event));

        // Add default time signature (4/4) at tick 0
        let time_sig_event = TimeSignatureEvent::new(Tick::new(0), 4, 4);
        score
            .global_structural_events
            .push(GlobalStructuralEvent::TimeSignature(time_sig_event));

        score
    }

    /// Add a tempo event with duplicate tick validation
    pub fn add_tempo_event(&mut self, event: TempoEvent) -> Result<(), DomainError> {
        // Check for duplicate tempo event at the same tick
        for existing_event in &self.global_structural_events {
            if let GlobalStructuralEvent::Tempo(existing_tempo) = existing_event {
                if existing_tempo.tick == event.tick {
                    return Err(DomainError::DuplicateError(format!(
                        "Tempo event already exists at tick {}",
                        event.tick.value()
                    )));
                }
            }
        }

        self.global_structural_events
            .push(GlobalStructuralEvent::Tempo(event));
        Ok(())
    }

    /// Add a time signature event with duplicate tick validation
    pub fn add_time_signature_event(
        &mut self,
        event: TimeSignatureEvent,
    ) -> Result<(), DomainError> {
        // Check for duplicate time signature event at the same tick
        for existing_event in &self.global_structural_events {
            if let GlobalStructuralEvent::TimeSignature(existing_time_sig) = existing_event {
                if existing_time_sig.tick == event.tick {
                    return Err(DomainError::DuplicateError(format!(
                        "Time signature event already exists at tick {}",
                        event.tick.value()
                    )));
                }
            }
        }

        self.global_structural_events
            .push(GlobalStructuralEvent::TimeSignature(event));
        Ok(())
    }

    /// Add an instrument to the score
    pub fn add_instrument(&mut self, instrument: Instrument) {
        self.instruments.push(instrument);
    }

    /// Remove a tempo event at a specific tick
    pub fn remove_tempo_event(&mut self, tick: Tick) -> Result<(), DomainError> {
        if tick == Tick::new(0) {
            return Err(DomainError::ConstraintViolation(
                "Cannot delete required tempo event at tick 0".to_string(),
            ));
        }

        let len_before = self.global_structural_events.len();
        self.global_structural_events
            .retain(|e| !matches!(e, GlobalStructuralEvent::Tempo(te) if te.tick == tick));

        if self.global_structural_events.len() == len_before {
            return Err(DomainError::NotFound(format!(
                "Tempo event not found at tick {}",
                tick.value()
            )));
        }

        Ok(())
    }

    /// Remove a time signature event at a specific tick
    pub fn remove_time_signature_event(&mut self, tick: Tick) -> Result<(), DomainError> {
        if tick == Tick::new(0) {
            return Err(DomainError::ConstraintViolation(
                "Cannot delete required time signature event at tick 0".to_string(),
            ));
        }

        let len_before = self.global_structural_events.len();
        self.global_structural_events
            .retain(|e| !matches!(e, GlobalStructuralEvent::TimeSignature(te) if te.tick == tick));

        if self.global_structural_events.len() == len_before {
            return Err(DomainError::NotFound(format!(
                "Time signature event not found at tick {}",
                tick.value()
            )));
        }

        Ok(())
    }

    /// Query structural events within a tick range
    pub fn query_structural_events_in_range(
        &self,
        start_tick: Tick,
        end_tick: Tick,
    ) -> Vec<&GlobalStructuralEvent> {
        self.global_structural_events
            .iter()
            .filter(|e| {
                let event_tick = match e {
                    GlobalStructuralEvent::Tempo(te) => te.tick,
                    GlobalStructuralEvent::TimeSignature(te) => te.tick,
                };
                event_tick >= start_tick && event_tick <= end_tick
            })
            .collect()
    }

    /// Get the active tempo at a specific tick
    pub fn get_tempo_at(&self, tick: Tick) -> Option<&TempoEvent> {
        self.global_structural_events
            .iter()
            .filter_map(|e| match e {
                GlobalStructuralEvent::Tempo(te) if te.tick <= tick => Some(te),
                _ => None,
            })
            .max_by_key(|te| te.tick)
    }

    /// Get the active time signature at a specific tick
    pub fn get_time_signature_at(&self, tick: Tick) -> Option<&TimeSignatureEvent> {
        self.global_structural_events
            .iter()
            .filter_map(|e| match e {
                GlobalStructuralEvent::TimeSignature(te) if te.tick <= tick => Some(te),
                _ => None,
            })
            .max_by_key(|te| te.tick)
    }
}

impl Default for Score {
    fn default() -> Self {
        Self::new()
    }
}
