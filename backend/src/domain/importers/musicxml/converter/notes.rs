//! Note collection, conversion, and rest distribution.
//!
//! Converts `NoteData` to domain `Note` entities, collects notes grouped
//! by MusicXML voice number, processes grace notes and chords, and
//! distributes rests into the appropriate voices.

use std::collections::HashMap;

use super::super::errors::ImportError;
use super::super::mapper::ElementMapper;
use super::super::timing::Fraction;
use super::super::types::{BeamType, MeasureData, MeasureElement, NoteData, SlurInfo, TieType};
use super::super::{ImportContext, WarningCategory, WarningSeverity};
use super::{NotesByVoice, TimingContext};
use crate::domain::events::note::Note;
use crate::domain::events::rest::RestEvent;
use crate::domain::voice::Voice;

pub(super) fn distribute_rests(voices: &mut [Voice], rests: Vec<RestEvent>) {
    for rest in rests {
        let idx = if rest.voice > 0 {
            (rest.voice - 1).min(voices.len().saturating_sub(1))
        } else {
            0
        };
        voices[idx].rest_events.push(rest);
    }
}

/// Collects all notes from measures without adding to voices (for voice distribution)
pub(super) fn collect_notes(
    measures: &[MeasureData],
    context: &mut ImportContext,
) -> Result<NotesByVoice, ImportError> {
    let mut notes_by_voice: HashMap<usize, Vec<Note>> = HashMap::new();
    let mut tie_info_by_voice: HashMap<usize, Vec<Option<TieType>>> = HashMap::new();
    let mut slur_info_by_voice: HashMap<usize, Vec<Vec<SlurInfo>>> = HashMap::new();
    let mut rests = Vec::new();
    let mut timing_context = TimingContext::new();

    for measure in measures {
        // Process attributes first (update divisions, ignore structural events)
        if let Some(attrs) = &measure.attributes {
            if let Some(divisions) = attrs.divisions {
                timing_context.set_divisions(divisions);
            }
        }

        // Process musical elements (notes, rests, backup/forward)
        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    // Try to convert note, skip if invalid (e.g., zero duration)
                    match convert_note(note_data, &mut timing_context) {
                        Ok(note) => {
                            let voice = note_data.voice;
                            tie_info_by_voice
                                .entry(voice)
                                .or_default()
                                .push(note_data.tie_type.clone());
                            slur_info_by_voice
                                .entry(voice)
                                .or_default()
                                .push(note_data.slurs.clone());
                            notes_by_voice.entry(voice).or_default().push(note);
                        }
                        Err(e) => {
                            // Skip malformed note with warning
                            context.warn(
                                WarningSeverity::Warning,
                                WarningCategory::StructuralIssues,
                                format!("Skipping invalid note: {}", e),
                            );
                            context.skip_element();
                        }
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    let start_tick = timing_context.current_tick();
                    timing_context.advance_by_duration(rest_data.duration)?;
                    let end_tick = timing_context.current_tick;
                    let duration_ticks = end_tick - start_tick.value();
                    if duration_ticks > 0 {
                        if rest_data.is_measure_rest {
                            rests.push(RestEvent::new_measure_rest(
                                start_tick,
                                duration_ticks,
                                rest_data.note_type.clone(),
                                rest_data.voice,
                                rest_data.staff,
                            ));
                        } else {
                            rests.push(RestEvent::new(
                                start_tick,
                                duration_ticks,
                                rest_data.note_type.clone(),
                                rest_data.voice,
                                rest_data.staff,
                            ));
                        }
                    }
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
                MeasureElement::Attributes(_) | MeasureElement::OctaveShift(_) => {}
            }
        }
    }

    // Resolve tie chains within each voice
    for (voice_num, notes) in notes_by_voice.iter_mut() {
        if let Some(tie_types) = tie_info_by_voice.get(voice_num) {
            super::ties::resolve_tie_chains(notes, tie_types);
        }
        if let Some(slur_infos) = slur_info_by_voice.get(voice_num) {
            super::ties::resolve_slur_chains(notes, slur_infos);
        }
    }

    Ok((notes_by_voice, rests))
}

/// Converts measures to Voice with all notes (for single-staff instruments) - DEPRECATED
/// Use collect_notes + VoiceDistributor instead
#[allow(dead_code)]
#[deprecated]
pub(super) fn convert_voice(measures: &[MeasureData]) -> Result<Voice, ImportError> {
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
                    let note = convert_note(note_data, &mut timing_context)?;
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
                MeasureElement::Attributes(_) | MeasureElement::OctaveShift(_) => {}
            }
        }
    }

    Ok(voice)
}

/// Collects notes filtered by staff number (for multi-staff instruments)
pub(super) fn collect_notes_for_staff(
    measures: &[MeasureData],
    staff_num: usize,
    context: &mut ImportContext,
) -> Result<NotesByVoice, ImportError> {
    let mut notes_by_voice: HashMap<usize, Vec<Note>> = HashMap::new();
    let mut tie_info_by_voice: HashMap<usize, Vec<Option<TieType>>> = HashMap::new();
    let mut slur_info_by_voice: HashMap<usize, Vec<Vec<SlurInfo>>> = HashMap::new();
    let mut rests = Vec::new();
    let mut timing_context = TimingContext::new();

    for measure in measures {
        // Track measure start for backup/forward within THIS measure only
        let measure_start_tick = timing_context.current_tick;
        timing_context.grace_tick_advance = 0;

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
                        match convert_note(note_data, &mut timing_context) {
                            Ok(note) => {
                                let voice = note_data.voice;
                                tie_info_by_voice
                                    .entry(voice)
                                    .or_default()
                                    .push(note_data.tie_type.clone());
                                slur_info_by_voice
                                    .entry(voice)
                                    .or_default()
                                    .push(note_data.slurs.clone());
                                notes_by_voice.entry(voice).or_default().push(note);
                                // Track the maximum tick reached for this staff in this measure
                                max_tick_in_measure =
                                    max_tick_in_measure.max(timing_context.current_tick);
                            }
                            Err(e) => {
                                // Skip malformed note with warning
                                context.warn(
                                    WarningSeverity::Warning,
                                    WarningCategory::StructuralIssues,
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
                        let start_tick = timing_context.current_tick();
                        timing_context.advance_by_duration(rest_data.duration)?;
                        let end_tick = timing_context.current_tick;
                        let duration_ticks = end_tick - start_tick.value();
                        max_tick_in_measure = max_tick_in_measure.max(end_tick);
                        if duration_ticks > 0 {
                            if rest_data.is_measure_rest {
                                rests.push(RestEvent::new_measure_rest(
                                    start_tick,
                                    duration_ticks,
                                    rest_data.note_type.clone(),
                                    rest_data.voice,
                                    rest_data.staff,
                                ));
                            } else {
                                rests.push(RestEvent::new(
                                    start_tick,
                                    duration_ticks,
                                    rest_data.note_type.clone(),
                                    rest_data.voice,
                                    rest_data.staff,
                                ));
                            }
                        }
                    }
                }
                MeasureElement::Backup(_duration) => {
                    timing_context.current_tick = measure_start_tick;
                }
                MeasureElement::Forward(duration) => {
                    timing_context.advance_by_duration(*duration)?;
                    max_tick_in_measure = max_tick_in_measure.max(timing_context.current_tick);
                }
                MeasureElement::Attributes(_) | MeasureElement::OctaveShift(_) => {}
            }
        }

        // After processing the measure, ensure timing advances to the end of the measure.
        // Compensate for grace note tick advances so they don't cascade to later measures.
        timing_context.current_tick =
            max_tick_in_measure.saturating_sub(timing_context.grace_tick_advance);
    }

    // Resolve tie chains within each voice
    for (voice_num, notes) in notes_by_voice.iter_mut() {
        if let Some(tie_types) = tie_info_by_voice.get(voice_num) {
            super::ties::resolve_tie_chains(notes, tie_types);
        }
        if let Some(slur_infos) = slur_info_by_voice.get(voice_num) {
            super::ties::resolve_slur_chains(notes, slur_infos);
        }
    }

    Ok((notes_by_voice, rests))
}

/// Converts measures to Voice with notes filtered by staff number (for multi-staff instruments) - DEPRECATED
/// Use collect_notes_for_staff + VoiceDistributor instead
#[allow(dead_code)]
#[deprecated]
pub(super) fn convert_voice_for_staff(
    measures: &[MeasureData],
    staff_num: usize,
) -> Result<Voice, ImportError> {
    let mut voice = Voice::new();
    let mut timing_context = TimingContext::new();

    for measure in measures {
        // Track measure start for backup/forward within THIS measure only
        let measure_start_tick = timing_context.current_tick;
        timing_context.grace_tick_advance = 0;

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
                        let note = convert_note(note_data, &mut timing_context)?;
                        voice.add_note(note)?;
                        // Track the maximum tick reached for this staff in this measure
                        max_tick_in_measure = max_tick_in_measure.max(timing_context.current_tick);
                    }
                    // Notes on other staves don't affect our timing
                }
                MeasureElement::Rest(rest_data) => {
                    // Only process rests for this staff
                    if rest_data.staff == staff_num {
                        timing_context.advance_by_duration(rest_data.duration)?;
                        max_tick_in_measure = max_tick_in_measure.max(timing_context.current_tick);
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
                MeasureElement::Attributes(_) | MeasureElement::OctaveShift(_) => {}
            }
        }

        // After processing the measure, ensure timing advances to the end of the measure
        // This prevents backup from affecting the next measure's start position.
        // Compensate for grace note tick advances so they don't cascade to later measures.
        timing_context.current_tick =
            max_tick_in_measure.saturating_sub(timing_context.grace_tick_advance);
    }

    Ok(voice)
}

/// Converts NoteData to Note
pub(super) fn convert_note(
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

    // Grace notes have no rhythmic duration — assign a small visual duration
    // and place them at the current tick, advancing forward. The total grace
    // advance is compensated at the measure boundary to prevent cascading shifts.
    if note_data.is_grace {
        let grace_visual_duration: u32 = 60; // 1/16 of a quarter (960 PPQ)
        timing_context.grace_count += 1;
        let tick = timing_context.current_tick();
        timing_context.current_tick += grace_visual_duration;
        timing_context.grace_tick_advance += grace_visual_duration;
        let mut note =
            Note::new(tick, grace_visual_duration, pitch).map_err(|e: &'static str| {
                ImportError::ValidationError {
                    errors: vec![e.to_string()],
                }
            })?;
        note.is_grace = true;

        let spelling = crate::domain::value_objects::NoteSpelling {
            step: pitch_data.step,
            alter: pitch_data.alter as i8,
        };
        let note = note.with_spelling(spelling);

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

        return Ok(note);
    }

    // Reset grace counter when a regular note arrives
    timing_context.grace_count = 0;

    // Calculate tick position and duration
    // Chord notes use the same tick as the previous note
    let tick = if note_data.is_chord {
        timing_context.last_note_tick()
    } else {
        // Grace notes preceding this note advanced current_tick by a
        // visual-only amount.  Rewind the cursor so this real note
        // (and every note after it) aligns with the correct beat.
        let advance = timing_context.grace_tick_advance;
        if advance > 0 {
            timing_context.current_tick = timing_context.current_tick.saturating_sub(advance);
            timing_context.grace_tick_advance = 0;
        }
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
        // Store the tick assigned to this note so chord notes can share it
        timing_context.last_note_tick = tick.value();
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
                BeamType::BackwardHook => crate::domain::events::note::NoteBeamType::BackwardHook,
            },
        })
        .collect();
    let note = if beams.is_empty() {
        note
    } else {
        note.with_beams(beams)
    };

    // Preserve staccato and augmentation dots from MusicXML
    let note = if note_data.staccato {
        note.with_staccato()
    } else {
        note
    };
    let note = if note_data.dot_count > 0 {
        note.with_dot_count(note_data.dot_count)
    } else {
        note
    };
    let note = if note_data.has_explicit_accidental {
        note.with_explicit_accidental()
    } else {
        note
    };
    let note = if let Some(stem_down) = note_data.stem_down {
        note.with_stem_down(stem_down)
    } else {
        note
    };
    let note = if !note_data.fingering.is_empty() {
        note.with_fingering(note_data.fingering.clone())
    } else {
        note
    };

    Ok(note)
}
