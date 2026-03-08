// MusicXML to Domain Converter - Feature 006-musicxml-import
// Transforms MusicXML intermediate representation to domain entities

use crate::domain::events::clef::ClefEvent;
use crate::domain::events::key_signature::KeySignatureEvent;
use crate::domain::events::note::Note;
use crate::domain::events::tempo::TempoEvent;
use crate::domain::events::time_signature::TimeSignatureEvent;
use crate::domain::instrument::Instrument;
use crate::domain::repeat::{RepeatBarline, RepeatBarlineType};
use crate::domain::score::Score;
use crate::domain::staff::Staff;
use crate::domain::value_objects::{BPM, Tick};
use crate::domain::voice::Voice;

use super::ImportContext;
use super::errors::ImportError;
use super::mapper::ElementMapper;
use super::timing::Fraction;
use super::types::BeamType;
use super::types::{MeasureData, MeasureElement, MusicXMLDocument, NoteData, PartData};
use std::collections::{BTreeMap, HashMap};

#[cfg(target_arch = "wasm32")]
use web_sys::console;

/// Voice distributor for resolving overlapping notes by splitting into multiple voices
///
/// Uses deterministic algorithm: sort notes by (start_tick, pitch), then assign
/// to first available voice that doesn't have overlapping notes. Maximum 4 voices.
struct VoiceDistributor {
    /// Voices being built, keyed by voice number (1-4)
    voices: HashMap<usize, Voice>,
    /// Maximum number of voices allowed per staff
    max_voices: usize,
}

impl VoiceDistributor {
    /// Create a new voice distributor with maximum 4 voices
    fn new() -> Self {
        Self {
            voices: HashMap::new(),
            max_voices: 4,
        }
    }

    /// Assign notes to voices deterministically
    ///
    /// # Algorithm
    /// 1. Sort notes by (start_tick, pitch) using BTreeMap for deterministic iteration
    /// 2. For each note, try voices 1-4 in order
    /// 3. Assign to first voice where note doesn't overlap
    /// 4. If all 4 voices occupied, record warning and skip note
    ///
    /// # Returns
    /// Vec of voices (may be 1-4 voices depending on overlap patterns)
    fn assign_voices(
        notes: Vec<Note>,
        context: &mut ImportContext,
    ) -> Result<Vec<Voice>, ImportError> {
        let mut distributor = Self::new();

        // Sort notes by (start_tick, pitch) for deterministic processing
        // BTreeMap provides sorted iteration
        let mut sorted_notes: BTreeMap<(u32, u8), Note> = BTreeMap::new();
        for note in notes {
            let key = (note.start_tick.value(), note.pitch.value());
            sorted_notes.insert(key, note);
        }

        // Assign each note to a voice
        for ((_tick, _pitch), note) in sorted_notes {
            distributor.assign_note(note, context)?;
        }

        // Extract voices in sorted order (1, 2, 3, 4)
        let mut result = Vec::new();
        for voice_num in 1..=distributor.max_voices {
            if let Some(voice) = distributor.voices.remove(&voice_num) {
                result.push(voice);
            }
        }

        // Ensure at least one voice always exists
        if result.is_empty() {
            result.push(Voice::new());
        }

        Ok(result)
    }

    /// Assign a single note to the first available voice
    fn assign_note(&mut self, note: Note, context: &mut ImportContext) -> Result<(), ImportError> {
        // Save tick for warning messages before moving note
        let note_tick = note.start_tick.value();

        // Try voices 1-4 in order
        for voice_num in 1..=self.max_voices {
            let voice = self.voices.entry(voice_num).or_default();

            // Check if note can be added without overlap
            if voice.can_add_note(&note) {
                // Add note (should not fail since we just checked)
                voice.add_note(note)?;

                // Record warning if we're using voice 2+ (indicates overlap resolution)
                if voice_num > 1 {
                    context.warn(
                        super::WarningSeverity::Warning,
                        super::WarningCategory::OverlapResolution,
                        format!(
                            "Overlapping notes at tick {} - note assigned to voice {}",
                            note_tick, voice_num
                        ),
                    );
                }

                return Ok(());
            }
        }

        // If we get here, all 4 voices are full - skip note with Error warning
        context.warn(
            super::WarningSeverity::Error,
            super::WarningCategory::OverlapResolution,
            format!(
                "Voice overflow: Note at tick {} could not be assigned (all 4 voices occupied)",
                note_tick
            ),
        );
        context.skip_element();

        Ok(())
    }
}

/// Context for timing calculations during conversion
#[derive(Debug, Clone)]
struct TimingContext {
    /// Current divisions per quarter note from MusicXML
    divisions: i32,
    /// Current tick position in 960 PPQ
    current_tick: u32,
    /// Tick position of the last non-chord note (for chord notes)
    last_note_tick: u32,
}

impl TimingContext {
    fn new() -> Self {
        Self {
            divisions: 480, // Default divisions
            current_tick: 0,
            last_note_tick: 0,
        }
    }

    fn set_divisions(&mut self, divisions: i32) {
        self.divisions = divisions;
    }

    fn advance_by_duration(&mut self, duration: i32) -> Result<(), ImportError> {
        let fraction = Fraction::from_musicxml(duration, self.divisions);
        let ticks = fraction.to_ticks()?;
        self.current_tick += ticks as u32;
        Ok(())
    }

    fn current_tick(&self) -> Tick {
        Tick::new(self.current_tick)
    }

    fn last_note_tick(&self) -> Tick {
        Tick::new(self.last_note_tick)
    }

    fn update_last_note_tick(&mut self) {
        self.last_note_tick = self.current_tick;
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

        // Set global tempo if specified in document
        if doc.default_tempo > 0.0 {
            let bpm =
                BPM::new(doc.default_tempo as u16).map_err(|e| ImportError::ValidationError {
                    errors: vec![format!("Invalid tempo: {}", e)],
                })?;
            let tempo_event = TempoEvent::new(Tick::new(0), bpm);

            // Clear default tempo and add document tempo
            score.global_structural_events.clear();
            score.add_tempo_event(tempo_event)?;

            // Re-add default time signature
            let time_sig = TimeSignatureEvent::new(Tick::new(0), 4, 4);
            score.add_time_signature_event(time_sig)?;
        }

        // Collect repeat barlines from the first part (repeat structure is score-wide)
        let repeat_barlines = doc
            .parts
            .first()
            .map(|first_part| Self::collect_repeat_barlines(&first_part.measures))
            .unwrap_or_default();

        // Convert each part to an Instrument
        for part_data in doc.parts {
            let instrument = Self::convert_part(part_data, context)?;
            score.add_instrument(instrument);
        }

        score.repeat_barlines = repeat_barlines;

        Ok(score)
    }

    /// Collects repeat barlines from a slice of MeasureData.
    ///
    /// Each measure with `start_repeat` or `end_repeat` produces a `RepeatBarline` entry.
    /// Tick positions assume 4/4 time at 960 PPQ (3840 ticks per measure).
    fn collect_repeat_barlines(measures: &[MeasureData]) -> Vec<RepeatBarline> {
        const TICKS_PER_MEASURE: u32 = 3840;
        let mut result = Vec::new();
        for (i, measure) in measures.iter().enumerate() {
            let start_tick = i as u32 * TICKS_PER_MEASURE;
            let end_tick = start_tick + TICKS_PER_MEASURE;
            match (measure.start_repeat, measure.end_repeat) {
                (true, true) => result.push(RepeatBarline {
                    measure_index: i as u32,
                    start_tick,
                    end_tick,
                    barline_type: RepeatBarlineType::Both,
                }),
                (true, false) => result.push(RepeatBarline {
                    measure_index: i as u32,
                    start_tick,
                    end_tick,
                    barline_type: RepeatBarlineType::Start,
                }),
                (false, true) => result.push(RepeatBarline {
                    measure_index: i as u32,
                    start_tick,
                    end_tick,
                    barline_type: RepeatBarlineType::End,
                }),
                (false, false) => {}
            }
        }
        result
    }

    /// Converts PartData to Instrument
    fn convert_part(
        part_data: PartData,
        context: &mut ImportContext,
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
            let staff = Self::convert_staff_for_single_staff(&part_data, context)?;
            instrument.add_staff(staff);
        } else {
            // Multi-staff instrument (US2) - e.g., piano grand staff
            let staves = Self::convert_multi_staff(&part_data, context)?;
            for staff in staves {
                instrument.add_staff(staff);
            }
        }

        Ok(instrument)
    }

    /// Converts PartData to multiple Staff entities for multi-staff instruments (US2)
    fn convert_multi_staff(
        part_data: &PartData,
        context: &mut ImportContext,
    ) -> Result<Vec<Staff>, ImportError> {
        let mut staves = Vec::new();

        // Create a staff for each staff number (1-indexed in MusicXML)
        for staff_num in 1..=part_data.staff_count {
            let mut staff = Staff::new();

            // Clear default events - we'll add from attributes
            staff.staff_structural_events.clear();
            staff.voices.clear();

            // Extract attributes from first measure for this staff
            if let Some(first_measure) = part_data.measures.first() {
                if let Some(attrs) = &first_measure.attributes {
                    // Find clef for this staff number
                    if let Some(clef_data) =
                        attrs.clefs.iter().find(|c| c.staff_number == staff_num)
                    {
                        let clef = ElementMapper::map_clef(&clef_data.sign, clef_data.line)?;
                        let clef_event = ClefEvent::new(Tick::new(0), clef);
                        staff.add_clef_event(clef_event)?;
                    }

                    // Key signature (shared across all staves)
                    if let Some(key_data) = &attrs.key {
                        let key_sig =
                            ElementMapper::map_key(key_data.fifths, Some(&key_data.mode))?;
                        let key_event = KeySignatureEvent::new(Tick::new(0), key_sig);
                        staff.add_key_signature_event(key_event)?;
                    }
                }
            }

            // Convert measures to voice, filtering by staff number
            let notes = Self::collect_notes_for_staff(&part_data.measures, staff_num, context)?;
            let voices = VoiceDistributor::assign_voices(notes, context)?;

            // Add all voices to staff
            for voice in voices {
                staff.add_voice(voice);
            }

            staves.push(staff);
        }

        Ok(staves)
    }

    /// Converts PartData to Staff for single-staff instruments (US1)
    fn convert_staff_for_single_staff(
        part_data: &PartData,
        context: &mut ImportContext,
    ) -> Result<Staff, ImportError> {
        // Create staff with defaults (Treble clef, C major, 1 voice)
        let mut staff = Staff::new();

        // Clear default events - we'll add from attributes
        staff.staff_structural_events.clear();
        staff.voices.clear();

        // Extract attributes and events from first measure
        if let Some(first_measure) = part_data.measures.first() {
            if let Some(attrs) = &first_measure.attributes {
                // Add clef from first measure
                if let Some(clef_data) = attrs.clefs.first() {
                    let clef = ElementMapper::map_clef(&clef_data.sign, clef_data.line)?;
                    let clef_event = ClefEvent::new(Tick::new(0), clef);
                    staff.add_clef_event(clef_event)?;
                }

                // Add key signature from first measure
                if let Some(key_data) = &attrs.key {
                    let key_sig = ElementMapper::map_key(key_data.fifths, Some(&key_data.mode))?;
                    let key_event = KeySignatureEvent::new(Tick::new(0), key_sig);
                    staff.add_key_signature_event(key_event)?;
                }
            }
        }

        // Convert measures to notes, then distribute across voices
        let notes = Self::collect_notes(&part_data.measures, context)?;
        let voices = VoiceDistributor::assign_voices(notes, context)?;

        // Add all voices to staff
        for voice in voices {
            staff.add_voice(voice);
        }

        Ok(staff)
    }

    /// Collects all notes from measures without adding to voices (for voice distribution)
    fn collect_notes(
        measures: &[MeasureData],
        context: &mut ImportContext,
    ) -> Result<Vec<Note>, ImportError> {
        let mut notes = Vec::new();
        let mut timing_context = TimingContext::new();

        for measure in measures {
            // Process attributes first (update divisions, ignore structural events)
            if let Some(attrs) = &measure.attributes {
                if let Some(divisions) = attrs.divisions {
                    timing_context.set_divisions(divisions);
                }
                // Note: Tempo, time sig, clef, key are handled at Score/Staff level
                // They are not added to Voice - Voice only contains Notes
            }

            // Process musical elements (notes, rests, backup/forward)
            for element in &measure.elements {
                match element {
                    MeasureElement::Note(note_data) => {
                        // Try to convert note, skip if invalid (e.g., zero duration)
                        match Self::convert_note(note_data, &mut timing_context) {
                            Ok(note) => notes.push(note),
                            Err(e) => {
                                // Skip malformed note with warning
                                context.warn(
                                    super::WarningSeverity::Warning,
                                    super::WarningCategory::StructuralIssues,
                                    format!("Skipping invalid note: {}", e),
                                );
                                context.skip_element();
                            }
                        }
                    }
                    MeasureElement::Rest(rest_data) => {
                        // Advance timing without creating note (rests are implicit)
                        timing_context.advance_by_duration(rest_data.duration)?;
                    }
                    MeasureElement::Backup(duration) => {
                        // Move timing cursor backward
                        let fraction = Fraction::from_musicxml(*duration, timing_context.divisions);
                        let ticks = fraction.to_ticks()?;
                        if timing_context.current_tick >= ticks as u32 {
                            timing_context.current_tick -= ticks as u32;
                        }
                    }
                    MeasureElement::Forward(duration) => {
                        // Move timing cursor forward
                        timing_context.advance_by_duration(*duration)?;
                    }
                }
            }
        }

        Ok(notes)
    }

    /// Converts measures to Voice with all notes (for single-staff instruments) - DEPRECATED
    /// Use collect_notes + VoiceDistributor instead
    #[allow(dead_code)]
    fn convert_voice(measures: &[MeasureData]) -> Result<Voice, ImportError> {
        let mut voice = Voice::new();
        let mut timing_context = TimingContext::new();

        for measure in measures {
            // Process attributes first (update divisions, ignore structural events)
            if let Some(attrs) = &measure.attributes {
                if let Some(divisions) = attrs.divisions {
                    timing_context.set_divisions(divisions);
                }
                // Note: Tempo, time sig, clef, key are handled at Score/Staff level
                // They are not added to Voice - Voice only contains Notes
            }

            // Process musical elements (notes, rests, backup/forward)
            for element in &measure.elements {
                match element {
                    MeasureElement::Note(note_data) => {
                        let note = Self::convert_note(note_data, &mut timing_context)?;
                        voice.add_note(note)?;
                    }
                    MeasureElement::Rest(rest_data) => {
                        // Advance timing without creating note (rests are implicit)
                        timing_context.advance_by_duration(rest_data.duration)?;
                    }
                    MeasureElement::Backup(duration) => {
                        // Move timing cursor backward
                        let fraction = Fraction::from_musicxml(*duration, timing_context.divisions);
                        let ticks = fraction.to_ticks()?;
                        if timing_context.current_tick >= ticks as u32 {
                            timing_context.current_tick -= ticks as u32;
                        }
                    }
                    MeasureElement::Forward(duration) => {
                        // Move timing cursor forward
                        timing_context.advance_by_duration(*duration)?;
                    }
                }
            }
        }

        Ok(voice)
    }

    /// Collects notes filtered by staff number (for multi-staff instruments)
    fn collect_notes_for_staff(
        measures: &[MeasureData],
        staff_num: usize,
        context: &mut ImportContext,
    ) -> Result<Vec<Note>, ImportError> {
        let mut notes = Vec::new();
        let mut timing_context = TimingContext::new();

        for measure in measures {
            // Track measure start for backup/forward within THIS measure only
            let measure_start_tick = timing_context.current_tick;

            // Process attributes first (update divisions, ignore structural events)
            if let Some(attrs) = &measure.attributes {
                if let Some(divisions) = attrs.divisions {
                    timing_context.set_divisions(divisions);
                }
            }

            // Process musical elements, filtering by staff number
            // Track maximum tick reached in this measure for staff timing
            let mut max_tick_in_measure = measure_start_tick;

            for element in &measure.elements {
                match element {
                    MeasureElement::Note(note_data) => {
                        // Only process notes for this staff
                        if note_data.staff == staff_num {
                            // Try to convert note, skip if invalid (e.g., zero duration)
                            match Self::convert_note(note_data, &mut timing_context) {
                                Ok(note) => {
                                    notes.push(note);
                                    // Track the maximum tick reached for this staff in this measure
                                    max_tick_in_measure =
                                        max_tick_in_measure.max(timing_context.current_tick);
                                }
                                Err(e) => {
                                    // Skip malformed note with warning
                                    context.warn(
                                        super::WarningSeverity::Warning,
                                        super::WarningCategory::StructuralIssues,
                                        format!("Skipping invalid note: {}", e),
                                    );
                                    context.skip_element();
                                }
                            }
                        }
                        // Notes on other staves don't affect our timing
                    }
                    MeasureElement::Rest(rest_data) => {
                        // Only process rests for this staff
                        if rest_data.staff == staff_num {
                            timing_context.advance_by_duration(rest_data.duration)?;
                            max_tick_in_measure =
                                max_tick_in_measure.max(timing_context.current_tick);
                        }
                    }
                    MeasureElement::Backup(_duration) => {
                        // In multi-staff notation, backup is used to go back and write
                        // notes for the next staff. We ignore it since each staff tracks
                        // timing independently. Backup typically happens after all notes
                        // for staff 1, resetting to measure start to write staff 2.
                        // Reset to measure start ONLY within this measure
                        timing_context.current_tick = measure_start_tick;
                    }
                    MeasureElement::Forward(duration) => {
                        // Forward advances time (e.g., for multi-voice within same staff)
                        // Only apply if it's relevant to this staff's timing
                        timing_context.advance_by_duration(*duration)?;
                        max_tick_in_measure = max_tick_in_measure.max(timing_context.current_tick);
                    }
                }
            }

            // After processing the measure, ensure timing advances to the end of the measure
            // This prevents backup from affecting the next measure's start position
            timing_context.current_tick = max_tick_in_measure;
        }

        Ok(notes)
    }

    /// Converts measures to Voice with notes filtered by staff number (for multi-staff instruments) - DEPRECATED
    /// Use collect_notes_for_staff + VoiceDistributor instead
    #[allow(dead_code)]
    fn convert_voice_for_staff(
        measures: &[MeasureData],
        staff_num: usize,
    ) -> Result<Voice, ImportError> {
        let mut voice = Voice::new();
        let mut timing_context = TimingContext::new();

        for measure in measures {
            // Track measure start for backup/forward within THIS measure only
            let measure_start_tick = timing_context.current_tick;

            // Process attributes first (update divisions, ignore structural events)
            if let Some(attrs) = &measure.attributes {
                if let Some(divisions) = attrs.divisions {
                    timing_context.set_divisions(divisions);
                }
            }

            // Process musical elements, filtering by staff number
            // Track maximum tick reached in this measure for staff timing
            let mut max_tick_in_measure = measure_start_tick;

            for element in &measure.elements {
                match element {
                    MeasureElement::Note(note_data) => {
                        // Only process notes for this staff
                        if note_data.staff == staff_num {
                            let note = Self::convert_note(note_data, &mut timing_context)?;
                            voice.add_note(note)?;
                            // Track the maximum tick reached for this staff in this measure
                            max_tick_in_measure =
                                max_tick_in_measure.max(timing_context.current_tick);
                        }
                        // Notes on other staves don't affect our timing
                    }
                    MeasureElement::Rest(rest_data) => {
                        // Only process rests for this staff
                        if rest_data.staff == staff_num {
                            timing_context.advance_by_duration(rest_data.duration)?;
                            max_tick_in_measure =
                                max_tick_in_measure.max(timing_context.current_tick);
                        }
                    }
                    MeasureElement::Backup(_duration) => {
                        // In multi-staff notation, backup is used to go back and write
                        // notes for the next staff. We ignore it since each staff tracks
                        // timing independently. Backup typically happens after all notes
                        // for staff 1, resetting to measure start to write staff 2.
                        // Reset to measure start ONLY within this measure
                        timing_context.current_tick = measure_start_tick;
                    }
                    MeasureElement::Forward(duration) => {
                        // Forward advances time (e.g., for multi-voice within same staff)
                        // Only apply if it's relevant to this staff's timing
                        timing_context.advance_by_duration(*duration)?;
                        max_tick_in_measure = max_tick_in_measure.max(timing_context.current_tick);
                    }
                }
            }

            // After processing the measure, ensure timing advances to the end of the measure
            // This prevents backup from affecting the next measure's start position
            timing_context.current_tick = max_tick_in_measure;
        }

        Ok(voice)
    }

    /// Converts NoteData to Note
    fn convert_note(
        note_data: &NoteData,
        timing_context: &mut TimingContext,
    ) -> Result<Note, ImportError> {
        // Extract pitch
        let pitch_data = note_data
            .pitch
            .as_ref()
            .ok_or_else(|| ImportError::InvalidStructure {
                reason: "Note missing pitch data".to_string(),
            })?;

        // Map pitch to domain Pitch value object
        let pitch = ElementMapper::map_pitch(pitch_data.step, pitch_data.octave, pitch_data.alter)?;

        // Calculate tick position and duration
        // Chord notes use the same tick as the previous note
        let tick = if note_data.is_chord {
            timing_context.last_note_tick()
        } else {
            timing_context.current_tick()
        };

        let fraction = Fraction::from_musicxml(note_data.duration, timing_context.divisions);
        let duration_ticks = fraction.to_ticks()?;
        #[cfg(not(target_arch = "wasm32"))]
        {
            eprintln!(
                "[MusicXML Converter] Note: duration={}, divisions={}, result={} ticks (fraction={}/{})",
                note_data.duration,
                timing_context.divisions,
                duration_ticks,
                fraction.numerator,
                fraction.denominator
            );
        }

        // Advance timing cursor only for non-chord notes
        // Chord notes start at the same tick as the previous note
        if !note_data.is_chord {
            timing_context.update_last_note_tick();
            timing_context.advance_by_duration(note_data.duration)?;
        }

        // Create Note using domain constructor
        let note = Note::new(tick, duration_ticks as u32, pitch).map_err(|e: &'static str| {
            ImportError::ValidationError {
                errors: vec![e.to_string()],
            }
        })?;

        // Preserve the enharmonic spelling from MusicXML (e.g., D# vs Eb)
        let spelling = crate::domain::value_objects::NoteSpelling {
            step: pitch_data.step,
            alter: pitch_data.alter as i8,
        };
        let note = note.with_spelling(spelling);

        // Preserve beam annotations from MusicXML
        let beams: Vec<crate::domain::events::note::NoteBeamData> = note_data
            .beams
            .iter()
            .map(|b| crate::domain::events::note::NoteBeamData {
                number: b.number,
                beam_type: match b.beam_type {
                    BeamType::Begin => crate::domain::events::note::NoteBeamType::Begin,
                    BeamType::Continue => crate::domain::events::note::NoteBeamType::Continue,
                    BeamType::End => crate::domain::events::note::NoteBeamType::End,
                    BeamType::ForwardHook => crate::domain::events::note::NoteBeamType::ForwardHook,
                    BeamType::BackwardHook => {
                        crate::domain::events::note::NoteBeamType::BackwardHook
                    }
                },
            })
            .collect();
        let note = if beams.is_empty() {
            note
        } else {
            note.with_beams(beams)
        };

        Ok(note)
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
            })],
            start_repeat: false,
            end_repeat: false,
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
                }),
            ],
            start_repeat: false,
            end_repeat: false,
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
                }),
            ],
            start_repeat: false,
            end_repeat: false,
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
}
