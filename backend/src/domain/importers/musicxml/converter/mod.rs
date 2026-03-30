//! MusicXML to domain converter — entry point and timing context.
//!
//! Orchestrates the conversion of parsed MusicXML documents into domain
//! `Score` entities. Routes single-staff and multi-staff parts to the
//! appropriate sub-modules and maintains the `TimingContext` for tick
//! position tracking during conversion.

// MusicXML to Domain Converter - Feature 006-musicxml-import
// Transforms MusicXML intermediate representation to domain entities

mod notes;
mod staff;
mod structure;
mod ties;
mod voice;

use crate::domain::events::dynamics::{DynamicMarking, GradualDirection, GradualDynamic};
use crate::domain::events::global::GlobalStructuralEvent;
use crate::domain::events::note::Note;
use crate::domain::events::rest::RestEvent;
use crate::domain::events::tempo::TempoEvent;
use crate::domain::events::time_signature::TimeSignatureEvent;
use crate::domain::instrument::Instrument;
use crate::domain::repeat::{RepeatBarline, VoltaBracket};
use crate::domain::score::{OctaveShiftRegion, Score};
use crate::domain::staff::Staff;
use crate::domain::value_objects::{BPM, Tick};
use crate::domain::voice::Voice;

use super::ImportContext;
use super::errors::ImportError;
use super::timing::Fraction;
use super::types::{MeasureData, MusicXMLDocument, NoteData, PartData};
use std::collections::HashMap;

/// Resolves the velocity for a note at a given tick and staff, considering
/// active dynamic markings and linear interpolation through gradual dynamics.
/// Returns 80 (mf default) if no dynamics exist.
fn resolve_velocity(
    tick: u32,
    staff: u8,
    dynamics: &[DynamicMarking],
    graduals: &[GradualDynamic],
) -> u8 {
    // Find the most recent dynamic marking at or before this tick for this staff
    let active_marking = dynamics
        .iter()
        .filter(|dm| dm.staff == staff && dm.start_tick.value() <= tick)
        .max_by_key(|dm| dm.start_tick);

    let base_velocity = active_marking.map(|dm| dm.velocity).unwrap_or(80);

    // Check if this note falls within an active gradual dynamic (wedge)
    let active_gradual = graduals.iter().find(|gd| {
        gd.staff == staff && gd.start_tick.value() <= tick && tick < gd.stop_tick.value()
    });

    if let Some(gd) = active_gradual {
        // Find the velocity at the start of the wedge (the most recent marking before wedge start)
        let start_vel = dynamics
            .iter()
            .filter(|dm| dm.staff == staff && dm.start_tick.value() <= gd.start_tick.value())
            .max_by_key(|dm| dm.start_tick)
            .map(|dm| dm.velocity)
            .unwrap_or(80);

        // Find the velocity at the end of the wedge (the next marking at or after wedge stop)
        let end_vel = dynamics
            .iter()
            .filter(|dm| dm.staff == staff && dm.start_tick.value() >= gd.stop_tick.value())
            .min_by_key(|dm| dm.start_tick)
            .map(|dm| dm.velocity)
            .unwrap_or_else(|| {
                // No marking after the wedge — infer target based on direction
                match gd.direction {
                    GradualDirection::Crescendo => (start_vel as u16 + 16).min(127) as u8,
                    GradualDirection::Diminuendo => start_vel.saturating_sub(16).max(1),
                }
            });

        // Linear interpolation
        let range = gd.stop_tick.value().saturating_sub(gd.start_tick.value());
        if range == 0 {
            return start_vel;
        }
        let progress = tick.saturating_sub(gd.start_tick.value());
        let ratio = progress as f64 / range as f64;
        let interpolated = start_vel as f64 + (end_vel as f64 - start_vel as f64) * ratio;
        return (interpolated.round() as u8).clamp(1, 127);
    }

    base_velocity
}

/// Compute the start tick of a measure, accounting for pickup/anacrusis.
fn measure_start_tick(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32 {
    if pickup_ticks == 0 || measure_index == 0 {
        if pickup_ticks > 0 && measure_index == 0 {
            0
        } else {
            measure_index as u32 * ticks_per_measure
        }
    } else {
        pickup_ticks + (measure_index as u32 - 1) * ticks_per_measure
    }
}

/// Compute the end tick of a measure, accounting for pickup/anacrusis.
fn measure_end_tick(measure_index: usize, pickup_ticks: u32, ticks_per_measure: u32) -> u32 {
    if pickup_ticks > 0 {
        if measure_index == 0 {
            pickup_ticks
        } else {
            pickup_ticks + measure_index as u32 * ticks_per_measure
        }
    } else {
        (measure_index as u32 + 1) * ticks_per_measure
    }
}

/// Notes grouped by MusicXML voice number, paired with rest events.
/// Used as the return type of `collect_notes` / `collect_notes_for_staff`.
type NotesByVoice = (HashMap<usize, Vec<Note>>, Vec<RestEvent>);

/// Measure start tick using actual boundaries if available, formula fallback otherwise.
pub(super) fn actual_measure_start(
    measure_index: usize,
    measure_end_ticks: &[u32],
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if !measure_end_ticks.is_empty()
        && measure_index > 0
        && measure_index <= measure_end_ticks.len()
    {
        measure_end_ticks[measure_index - 1]
    } else if measure_index == 0 {
        0
    } else {
        measure_start_tick(measure_index, pickup_ticks, ticks_per_measure)
    }
}

/// Measure end tick using actual boundaries if available, formula fallback otherwise.
pub(super) fn actual_measure_end(
    measure_index: usize,
    measure_end_ticks: &[u32],
    pickup_ticks: u32,
    ticks_per_measure: u32,
) -> u32 {
    if measure_index < measure_end_ticks.len() {
        measure_end_ticks[measure_index]
    } else {
        measure_end_tick(measure_index, pickup_ticks, ticks_per_measure)
    }
}

/// Context for timing calculations during conversion
#[derive(Debug, Clone)]
pub(super) struct TimingContext {
    /// Current divisions per quarter note from MusicXML
    pub(super) divisions: i32,
    /// Current tick position in 960 PPQ
    pub(super) current_tick: u32,
    /// Tick position of the last non-chord note (for chord notes)
    pub(super) last_note_tick: u32,
    /// Count of consecutive grace notes (reset on regular note)
    pub(super) grace_count: u32,
    /// Total tick advance from grace notes in current measure (for compensation)
    pub(super) grace_tick_advance: u32,
}

impl TimingContext {
    pub(super) fn new() -> Self {
        Self {
            divisions: 480, // Default divisions
            current_tick: 0,
            last_note_tick: 0,
            grace_count: 0,
            grace_tick_advance: 0,
        }
    }

    pub(super) fn set_divisions(&mut self, divisions: i32) {
        self.divisions = divisions;
    }

    pub(super) fn advance_by_duration(&mut self, duration: i32) -> Result<(), ImportError> {
        let fraction = Fraction::from_musicxml(duration, self.divisions);
        let ticks = fraction.to_ticks()?;
        self.current_tick += ticks as u32;
        Ok(())
    }

    pub(super) fn current_tick(&self) -> Tick {
        Tick::new(self.current_tick)
    }

    pub(super) fn last_note_tick(&self) -> Tick {
        Tick::new(self.last_note_tick)
    }
}

/// Converts MusicXML documents to domain Score entities
pub struct MusicXMLConverter;

impl MusicXMLConverter {
    /// Converts MusicXMLDocument to Score
    ///
    /// # Arguments
    /// * `doc` - Parsed MusicXML document
    /// * `context` - Import context for warning collection
    ///
    /// # Returns
    /// Score with all instruments, staves, voices, and events
    pub fn convert(
        doc: MusicXMLDocument,
        context: &mut ImportContext,
    ) -> Result<Score, ImportError> {
        // Create Score with defaults (120 BPM, 4/4 time signature)
        let mut score = Score::new();

        // Extract time signature from first measure of first part, fallback to 4/4
        let (time_num, time_den) = doc
            .parts
            .first()
            .and_then(|p| p.measures.first())
            .and_then(|m| m.attributes.as_ref())
            .and_then(|a| a.time.as_ref())
            .map(|t| (t.beats as u8, t.beat_type as u8))
            .unwrap_or((4, 4));

        // Set global tempo if specified in document
        if doc.default_tempo > 0.0 {
            let clamped = doc.default_tempo.clamp(20.0, 400.0) as u16;
            let bpm = BPM::new(clamped).map_err(|e| ImportError::ValidationError {
                errors: vec![format!("Invalid tempo: {}", e)],
            })?;
            let tempo_event = TempoEvent::new(Tick::new(0), bpm);

            // Clear default tempo and add document tempo
            score.global_structural_events.clear();
            score.add_tempo_event(tempo_event)?;

            // Add time signature from document (or 4/4 fallback)
            let time_sig = TimeSignatureEvent::new(Tick::new(0), time_num, time_den);
            score.add_time_signature_event(time_sig)?;
        } else if (time_num, time_den) != (4, 4) {
            // Replace the default 4/4 from Score::new() with the actual time signature
            score
                .global_structural_events
                .retain(|e| !matches!(e, GlobalStructuralEvent::TimeSignature(_)));
            let time_sig = TimeSignatureEvent::new(Tick::new(0), time_num, time_den);
            score.add_time_signature_event(time_sig)?;
        }

        // Collect repeat barlines from the first part (repeat structure is score-wide)
        let ticks_per_measure: u32 = (3840 * time_num as u32) / time_den as u32;

        // Detect pickup/anacrusis measure: if first measure's duration < ticks_per_measure
        let pickup_ticks = Self::detect_pickup_ticks(&doc.parts, ticks_per_measure);

        // Compute actual measure boundaries from content (handles shortened measures)
        let measure_end_ticks = Self::compute_measure_end_ticks(&doc.parts);

        let repeat_barlines = doc
            .parts
            .first()
            .map(|first_part| {
                Self::collect_repeat_barlines(
                    &first_part.measures,
                    ticks_per_measure,
                    pickup_ticks,
                    &measure_end_ticks,
                )
            })
            .unwrap_or_default();

        // Collect volta brackets from the first part (Feature 047)
        let volta_brackets = doc
            .parts
            .first()
            .map(|first_part| {
                Self::collect_volta_brackets(
                    &first_part.measures,
                    ticks_per_measure,
                    pickup_ticks,
                    &measure_end_ticks,
                )
            })
            .unwrap_or_default();

        // Collect octave-shift regions from the first part
        let octave_shift_regions = doc
            .parts
            .first()
            .map(|first_part| {
                Self::collect_octave_shift_regions(
                    &first_part.measures,
                    ticks_per_measure,
                    pickup_ticks,
                    &measure_end_ticks,
                )
            })
            .unwrap_or_default();

        // Collect dynamics and gradual dynamics from the first part (Feature 063)
        let dynamics = doc
            .parts
            .first()
            .map(|first_part| {
                Self::collect_dynamics(
                    &first_part.measures,
                    ticks_per_measure,
                    pickup_ticks,
                    &measure_end_ticks,
                )
            })
            .unwrap_or_default();

        let gradual_dynamics = doc
            .parts
            .first()
            .map(|first_part| {
                Self::collect_gradual_dynamics(
                    &first_part.measures,
                    ticks_per_measure,
                    pickup_ticks,
                    &measure_end_ticks,
                )
            })
            .unwrap_or_default();

        // Convert each part to an Instrument
        for part_data in doc.parts {
            let instrument = Self::convert_part(
                part_data,
                context,
                ticks_per_measure,
                pickup_ticks,
                &measure_end_ticks,
            )?;
            score.add_instrument(instrument);
        }

        score.repeat_barlines = repeat_barlines;
        score.volta_brackets = volta_brackets;
        score.octave_shift_regions = octave_shift_regions;
        score.dynamics = dynamics;
        score.gradual_dynamics = gradual_dynamics;

        score.pickup_ticks = pickup_ticks;
        score.measure_end_ticks = measure_end_ticks;

        // Feature 063: Assign velocity to each note based on dynamics
        Self::assign_note_velocities(&mut score);

        Ok(score)
    }

    /// Detects pickup/anacrusis — delegates to structure sub-module
    fn detect_pickup_ticks(parts: &[PartData], ticks_per_measure: u32) -> u32 {
        structure::detect_pickup_ticks(parts, ticks_per_measure)
    }

    /// Computes actual measure end ticks — delegates to structure sub-module
    fn compute_measure_end_ticks(parts: &[PartData]) -> Vec<u32> {
        structure::compute_measure_end_ticks(parts)
    }

    /// Collects repeat barlines — delegates to structure sub-module
    fn collect_repeat_barlines(
        measures: &[MeasureData],
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Vec<RepeatBarline> {
        structure::collect_repeat_barlines(
            measures,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    /// Collects volta brackets — delegates to structure sub-module
    fn collect_volta_brackets(
        measures: &[MeasureData],
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Vec<VoltaBracket> {
        structure::collect_volta_brackets(
            measures,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    /// Collects octave-shift regions — delegates to structure sub-module
    fn collect_octave_shift_regions(
        measures: &[MeasureData],
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Vec<OctaveShiftRegion> {
        structure::collect_octave_shift_regions(
            measures,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    /// Collects dynamic markings — delegates to structure sub-module (Feature 063)
    fn collect_dynamics(
        measures: &[MeasureData],
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Vec<DynamicMarking> {
        structure::collect_dynamics(measures, ticks_per_measure, pickup_ticks, measure_end_ticks)
    }

    /// Collects gradual dynamics — delegates to structure sub-module (Feature 063)
    fn collect_gradual_dynamics(
        measures: &[MeasureData],
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Vec<GradualDynamic> {
        structure::collect_gradual_dynamics(
            measures,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    /// Assigns velocity to every note in the score based on collected dynamics
    /// and gradual dynamics. Default velocity is 80 (mf) when no dynamics exist.
    fn assign_note_velocities(score: &mut Score) {
        let dynamics = &score.dynamics;
        let graduals = &score.gradual_dynamics;

        for instrument in &mut score.instruments {
            for (staff_idx, staff) in instrument.staves.iter_mut().enumerate() {
                let staff_num = (staff_idx + 1) as u8;
                for voice in &mut staff.voices {
                    for note in &mut voice.interval_events {
                        let tick = note.start_tick.value();
                        let vel = resolve_velocity(tick, staff_num, dynamics, graduals);
                        *note = note.clone().with_velocity(vel);
                    }
                }
            }
        }
    }

    /// Converts PartData to Instrument
    fn convert_part(
        part_data: PartData,
        context: &mut ImportContext,
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Result<Instrument, ImportError> {
        let name = if part_data.name.is_empty() {
            format!("Instrument {}", part_data.id)
        } else {
            part_data.name.clone()
        };

        // Create instrument with default staff, then clear
        let mut instrument = Instrument::new(name);
        instrument.staves.clear();

        // Check staff count and route accordingly
        if part_data.staff_count <= 1 {
            // Single-staff instrument (US1)
            let staff = Self::convert_staff_for_single_staff(
                &part_data,
                context,
                ticks_per_measure,
                pickup_ticks,
                measure_end_ticks,
            )?;
            instrument.add_staff(staff);
        } else {
            // Multi-staff instrument (US2) - e.g., piano grand staff
            let staves = Self::convert_multi_staff(
                &part_data,
                context,
                ticks_per_measure,
                pickup_ticks,
                measure_end_ticks,
            )?;
            for staff in staves {
                instrument.add_staff(staff);
            }
        }

        Ok(instrument)
    }

    fn convert_multi_staff(
        part_data: &PartData,
        context: &mut ImportContext,
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Result<Vec<Staff>, ImportError> {
        staff::convert_multi_staff(
            part_data,
            context,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    fn convert_staff_for_single_staff(
        part_data: &PartData,
        context: &mut ImportContext,
        ticks_per_measure: u32,
        pickup_ticks: u32,
        measure_end_ticks: &[u32],
    ) -> Result<Staff, ImportError> {
        staff::convert_staff_for_single_staff(
            part_data,
            context,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )
    }

    #[allow(dead_code, deprecated)]
    fn convert_voice(measures: &[MeasureData]) -> Result<Voice, ImportError> {
        notes::convert_voice(measures)
    }

    #[allow(dead_code, deprecated)]
    fn convert_voice_for_staff(
        measures: &[MeasureData],
        staff_num: usize,
    ) -> Result<Voice, ImportError> {
        notes::convert_voice_for_staff(measures, staff_num)
    }

    #[allow(dead_code)]
    fn convert_note(
        note_data: &NoteData,
        timing_context: &mut TimingContext,
    ) -> Result<Note, ImportError> {
        notes::convert_note(note_data, timing_context)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::importers::musicxml::types::*;

    #[test]
    fn test_convert_single_part_to_score() {
        // T042: Convert MusicXMLDocument with 1 part → Score with 1 Instrument
        let mut doc = MusicXMLDocument {
            version: "3.1".to_string(),
            ..Default::default()
        };

        // Create part with basic attributes
        let mut part = PartData {
            id: "P1".to_string(),
            name: "Piano".to_string(),
            measures: Vec::new(),
            staff_count: 1,
        };

        // Create measure with attributes
        let measure = MeasureData {
            number: 1,
            attributes: Some(AttributesData {
                divisions: Some(480),
                key: Some(KeyData {
                    fifths: 0,
                    mode: "major".to_string(),
                }),
                time: Some(TimeSignatureData {
                    beats: 4,
                    beat_type: 4,
                }),
                clefs: vec![ClefData {
                    sign: "G".to_string(),
                    line: 2,
                    staff_number: 1,
                }],
                tempo: Some(120.0),
            }),
            elements: vec![MeasureElement::Note(NoteData {
                pitch: Some(PitchData {
                    step: 'C',
                    octave: 4,
                    alter: 0,
                }),
                duration: 480,
                voice: 1,
                staff: 1,
                note_type: Some("quarter".to_string()),
                is_chord: false,
                beams: Vec::new(),
                staccato: false,
                dot_count: 0,
                tie_type: None,
                tie_placement: None,
                slurs: Vec::new(),
                is_grace: false,
                has_explicit_accidental: false,
                is_measure_rest: false,
                stem_down: None,
                fingering: Vec::new(),
            })],
            start_repeat: false,
            end_repeat: false,
            endings: vec![],
            sound_tempo: None,
            metronome_tempo: None,
            sound_dynamics: None,
        };

        part.measures.push(measure);
        doc.parts.push(part);

        // Convert to Score
        let mut context = ImportContext::new();
        let result = MusicXMLConverter::convert(doc, &mut context);
        assert!(
            result.is_ok(),
            "Conversion should succeed: {:?}",
            result.err()
        );

        let score = result.unwrap();
        assert_eq!(score.instruments.len(), 1, "Expected 1 instrument");

        let instrument = &score.instruments[0];
        assert_eq!(instrument.name, "Piano");
        assert_eq!(instrument.staves.len(), 1, "Expected 1 staff");

        let staff = &instrument.staves[0];
        assert_eq!(staff.voices.len(), 1, "Expected 1 voice");

        let voice = &staff.voices[0];
        assert!(!voice.interval_events.is_empty(), "Expected notes in voice");
    }

    #[test]
    fn test_timing_context_advance() {
        // T044: Verify timing context tracks tick position correctly
        let mut ctx = TimingContext::new();
        ctx.set_divisions(480);

        assert_eq!(ctx.current_tick().value(), 0);

        // Advance by quarter note (480 duration at 480 divisions = 960 ticks)
        ctx.advance_by_duration(480).unwrap();
        assert_eq!(ctx.current_tick().value(), 960);

        // Advance by another quarter note
        ctx.advance_by_duration(480).unwrap();
        assert_eq!(ctx.current_tick().value(), 1920);
    }

    #[test]
    fn test_convert_note() {
        // T046: Convert NoteData to Note with correct pitch and timing
        let mut timing_ctx = TimingContext::new();
        timing_ctx.set_divisions(480);

        let note_data = NoteData {
            pitch: Some(PitchData {
                step: 'C',
                octave: 4,
                alter: 0,
            }),
            duration: 480,
            voice: 1,
            staff: 1,
            note_type: Some("quarter".to_string()),
            is_chord: false,
            beams: Vec::new(),
            staccato: false,
            dot_count: 0,
            tie_type: None,
            tie_placement: None,
            slurs: Vec::new(),
            is_grace: false,
            has_explicit_accidental: false,
            is_measure_rest: false,
            stem_down: None,
            fingering: Vec::new(),
        };

        let result = MusicXMLConverter::convert_note(&note_data, &mut timing_ctx);
        assert!(
            result.is_ok(),
            "Note conversion should succeed: {:?}",
            result.err()
        );

        let note = result.unwrap();
        assert_eq!(note.pitch.value(), 60); // Middle C
        assert_eq!(note.start_tick.value(), 0);
        assert_eq!(note.duration_ticks, 960); // Quarter note at 960 PPQ

        // Timing context should have advanced
        assert_eq!(timing_ctx.current_tick().value(), 960);
    }

    #[test]
    fn test_convert_voice_with_multiple_notes() {
        // T048: Convert multiple notes to Voice
        let measures = vec![MeasureData {
            number: 1,
            attributes: Some(AttributesData {
                divisions: Some(480),
                key: None,
                time: None,
                clefs: vec![],
                tempo: None,
            }),
            elements: vec![
                MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 480,
                    voice: 1,
                    staff: 1,
                    note_type: Some("quarter".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                }),
                MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'D',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 480,
                    voice: 1,
                    staff: 1,
                    note_type: Some("quarter".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                }),
            ],
            start_repeat: false,
            end_repeat: false,
            endings: vec![],
            sound_tempo: None,
            metronome_tempo: None,
            sound_dynamics: None,
        }];

        let result = MusicXMLConverter::convert_voice(&measures);
        assert!(
            result.is_ok(),
            "Voice conversion should succeed: {:?}",
            result.err()
        );

        let voice = result.unwrap();
        assert_eq!(voice.interval_events.len(), 2, "Expected 2 notes");

        // First note: C4 at tick 0
        assert_eq!(voice.interval_events[0].pitch.value(), 60);
        assert_eq!(voice.interval_events[0].start_tick.value(), 0);

        // Second note: D4 at tick 960
        assert_eq!(voice.interval_events[1].pitch.value(), 62);
        assert_eq!(voice.interval_events[1].start_tick.value(), 960);
    }

    #[test]
    fn test_convert_chord_notes() {
        // Test chord notes start at the same tick
        let measures = vec![MeasureData {
            number: 1,
            attributes: Some(AttributesData {
                divisions: Some(480),
                key: None,
                time: None,
                clefs: vec![],
                tempo: None,
            }),
            elements: vec![
                // First note of chord: D5 (whole note)
                MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'D',
                        octave: 5,
                        alter: 0,
                    }),
                    duration: 960, // half note
                    voice: 1,
                    staff: 1,
                    note_type: Some("half".to_string()),
                    is_chord: false, // First note in chord
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                }),
                // Second note of chord: F#5 (should start at same tick)
                MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'F',
                        octave: 5,
                        alter: 1, // F#
                    }),
                    duration: 960, // half note
                    voice: 1,
                    staff: 1,
                    note_type: Some("half".to_string()),
                    is_chord: true, // Chord note - starts at same time
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                }),
                // Third note: C#5 (sequential, after the chord)
                MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 5,
                        alter: 1, // C#
                    }),
                    duration: 960, // half note
                    voice: 1,
                    staff: 1,
                    note_type: Some("half".to_string()),
                    is_chord: false, // Not a chord - starts after previous chord
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                }),
            ],
            start_repeat: false,
            end_repeat: false,
            endings: vec![],
            sound_tempo: None,
            metronome_tempo: None,
            sound_dynamics: None,
        }];

        let result = MusicXMLConverter::convert_voice(&measures);
        assert!(
            result.is_ok(),
            "Voice conversion should succeed: {:?}",
            result.err()
        );

        let voice = result.unwrap();
        assert_eq!(
            voice.interval_events.len(),
            3,
            "Expected 3 notes (2-note chord + 1 sequential)"
        );

        // First note: D5 at tick 0
        assert_eq!(voice.interval_events[0].pitch.value(), 74); // D5
        assert_eq!(voice.interval_events[0].start_tick.value(), 0);
        assert_eq!(voice.interval_events[0].duration_ticks, 1920); // half note at 960 PPQ

        // Second note: F#5 at tick 0 (chord note - same as previous)
        assert_eq!(voice.interval_events[1].pitch.value(), 78); // F#5
        assert_eq!(
            voice.interval_events[1].start_tick.value(),
            0,
            "Chord note should start at same tick as first note"
        );
        assert_eq!(voice.interval_events[1].duration_ticks, 1920);

        // Third note: C#5 at tick 1920 (after the chord)
        assert_eq!(voice.interval_events[2].pitch.value(), 73); // C#5
        assert_eq!(
            voice.interval_events[2].start_tick.value(),
            1920,
            "Sequential note should start after chord duration"
        );
        assert_eq!(voice.interval_events[2].duration_ticks, 1920);
    }

    /// Helper: extract the first TimeSignatureEvent from a Score's global_structural_events
    fn extract_time_signature(score: &crate::domain::score::Score) -> (u8, u8) {
        use crate::domain::events::global::GlobalStructuralEvent;
        for event in &score.global_structural_events {
            if let GlobalStructuralEvent::TimeSignature(ts) = event {
                return (ts.numerator, ts.denominator);
            }
        }
        panic!("No TimeSignatureEvent found in score");
    }

    #[test]
    fn test_import_2_4_time_signature() {
        // T005: Import MusicXML with 2/4 time → score has TimeSignatureEvent(0, 2, 4)
        let mut doc = MusicXMLDocument {
            version: "3.1".to_string(),
            ..Default::default()
        };

        let part = PartData {
            id: "P1".to_string(),
            name: "Piano".to_string(),
            staff_count: 1,
            measures: vec![MeasureData {
                number: 1,
                attributes: Some(AttributesData {
                    divisions: Some(480),
                    key: None,
                    time: Some(TimeSignatureData {
                        beats: 2,
                        beat_type: 4,
                    }),
                    clefs: vec![ClefData {
                        sign: "G".to_string(),
                        line: 2,
                        staff_number: 1,
                    }],
                    tempo: None,
                }),
                elements: vec![MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 480,
                    voice: 1,
                    staff: 1,
                    note_type: Some("quarter".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                })],
                start_repeat: false,
                end_repeat: false,
                endings: vec![],
                sound_tempo: None,
                metronome_tempo: None,
                sound_dynamics: None,
            }],
        };
        doc.parts.push(part);

        let mut context = ImportContext::new();
        let score = MusicXMLConverter::convert(doc, &mut context).unwrap();
        let (num, den) = extract_time_signature(&score);
        assert_eq!(num, 2, "Expected numerator 2");
        assert_eq!(den, 4, "Expected denominator 4");
    }

    #[test]
    fn test_import_3_4_time_signature() {
        // T006: Import MusicXML with 3/4 time → score has TimeSignatureEvent(0, 3, 4)
        let mut doc = MusicXMLDocument {
            version: "3.1".to_string(),
            ..Default::default()
        };

        let part = PartData {
            id: "P1".to_string(),
            name: "Piano".to_string(),
            staff_count: 1,
            measures: vec![MeasureData {
                number: 1,
                attributes: Some(AttributesData {
                    divisions: Some(480),
                    key: None,
                    time: Some(TimeSignatureData {
                        beats: 3,
                        beat_type: 4,
                    }),
                    clefs: vec![ClefData {
                        sign: "G".to_string(),
                        line: 2,
                        staff_number: 1,
                    }],
                    tempo: None,
                }),
                elements: vec![MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 480,
                    voice: 1,
                    staff: 1,
                    note_type: Some("quarter".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                })],
                start_repeat: false,
                end_repeat: false,
                endings: vec![],
                sound_tempo: None,
                metronome_tempo: None,
                sound_dynamics: None,
            }],
        };
        doc.parts.push(part);

        let mut context = ImportContext::new();
        let score = MusicXMLConverter::convert(doc, &mut context).unwrap();
        let (num, den) = extract_time_signature(&score);
        assert_eq!(num, 3, "Expected numerator 3");
        assert_eq!(den, 4, "Expected denominator 4");
    }

    #[test]
    fn test_import_6_8_time_signature() {
        // T007: Import MusicXML with 6/8 time → score has TimeSignatureEvent(0, 6, 8)
        let mut doc = MusicXMLDocument {
            version: "3.1".to_string(),
            ..Default::default()
        };

        let part = PartData {
            id: "P1".to_string(),
            name: "Piano".to_string(),
            staff_count: 1,
            measures: vec![MeasureData {
                number: 1,
                attributes: Some(AttributesData {
                    divisions: Some(480),
                    key: None,
                    time: Some(TimeSignatureData {
                        beats: 6,
                        beat_type: 8,
                    }),
                    clefs: vec![ClefData {
                        sign: "G".to_string(),
                        line: 2,
                        staff_number: 1,
                    }],
                    tempo: None,
                }),
                elements: vec![MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 240,
                    voice: 1,
                    staff: 1,
                    note_type: Some("eighth".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                })],
                start_repeat: false,
                end_repeat: false,
                endings: vec![],
                sound_tempo: None,
                metronome_tempo: None,
                sound_dynamics: None,
            }],
        };
        doc.parts.push(part);

        let mut context = ImportContext::new();
        let score = MusicXMLConverter::convert(doc, &mut context).unwrap();
        let (num, den) = extract_time_signature(&score);
        assert_eq!(num, 6, "Expected numerator 6");
        assert_eq!(den, 8, "Expected denominator 8");
    }

    #[test]
    fn test_import_default_4_4_time_signature() {
        // T008: Import MusicXML with NO <time> element → defaults to 4/4
        let mut doc = MusicXMLDocument {
            version: "3.1".to_string(),
            ..Default::default()
        };

        let part = PartData {
            id: "P1".to_string(),
            name: "Piano".to_string(),
            staff_count: 1,
            measures: vec![MeasureData {
                number: 1,
                attributes: Some(AttributesData {
                    divisions: Some(480),
                    key: None,
                    time: None, // No time signature specified
                    clefs: vec![ClefData {
                        sign: "G".to_string(),
                        line: 2,
                        staff_number: 1,
                    }],
                    tempo: None,
                }),
                elements: vec![MeasureElement::Note(NoteData {
                    pitch: Some(PitchData {
                        step: 'C',
                        octave: 4,
                        alter: 0,
                    }),
                    duration: 480,
                    voice: 1,
                    staff: 1,
                    note_type: Some("quarter".to_string()),
                    is_chord: false,
                    beams: Vec::new(),
                    staccato: false,
                    dot_count: 0,
                    tie_type: None,
                    tie_placement: None,
                    slurs: Vec::new(),
                    is_grace: false,
                    has_explicit_accidental: false,
                    is_measure_rest: false,
                    stem_down: None,
                    fingering: Vec::new(),
                })],
                start_repeat: false,
                end_repeat: false,
                endings: vec![],
                sound_tempo: None,
                metronome_tempo: None,
                sound_dynamics: None,
            }],
        };
        doc.parts.push(part);

        let mut context = ImportContext::new();
        let score = MusicXMLConverter::convert(doc, &mut context).unwrap();
        let (num, den) = extract_time_signature(&score);
        assert_eq!(num, 4, "Expected default numerator 4");
        assert_eq!(den, 4, "Expected default denominator 4");
    }

    #[test]
    fn test_timing_context_new() {
        let tc = TimingContext::new();
        assert_eq!(tc.divisions, 480);
        assert_eq!(tc.current_tick, 0);
        assert_eq!(tc.grace_count, 0);
    }

    #[test]
    fn test_timing_context_set_divisions() {
        let mut tc = TimingContext::new();
        tc.set_divisions(1);
        tc.advance_by_duration(1).unwrap();
        assert_eq!(
            tc.current_tick, 960,
            "1 division at duration 1 should yield 960 ticks"
        );
    }

    #[test]
    fn test_timing_context_grace_note_tracking() {
        let mut tc = TimingContext::new();
        assert_eq!(tc.grace_count, 0);
        assert_eq!(tc.grace_tick_advance, 0);
        tc.grace_count += 1;
        tc.grace_tick_advance += 10;
        assert_eq!(tc.grace_count, 1);
        assert_eq!(tc.grace_tick_advance, 10);
    }
}
