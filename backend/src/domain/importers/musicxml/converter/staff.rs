//! Staff construction — single-staff and multi-staff routing.
//!
//! Builds `Staff` entities from parsed `PartData`, extracting initial
//! clef/key attributes, mid-score key and clef changes, and routing
//! note collection through the `notes` sub-module.

use super::super::ImportContext;
use super::super::errors::ImportError;
use super::super::mapper::ElementMapper;
use super::super::timing::Fraction;
use super::super::types::{MeasureData, MeasureElement, PartData};
use crate::domain::events::clef::ClefEvent;
use crate::domain::events::key_signature::KeySignatureEvent;
use crate::domain::staff::Staff;
use crate::domain::value_objects::Tick;
use crate::domain::voice::Voice;

pub(super) fn convert_multi_staff(
    part_data: &PartData,
    context: &mut ImportContext,
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
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
                if let Some(clef_data) = attrs.clefs.iter().find(|c| c.staff_number == staff_num) {
                    let clef = ElementMapper::map_clef(&clef_data.sign, clef_data.line)?;
                    let clef_event = ClefEvent::new(Tick::new(0), clef);
                    staff.add_clef_event(clef_event)?;
                }

                // Key signature (shared across all staves)
                if let Some(key_data) = &attrs.key {
                    let key_sig = ElementMapper::map_key(key_data.fifths, Some(&key_data.mode))?;
                    let key_event = KeySignatureEvent::new(Tick::new(0), key_sig);
                    staff.add_key_signature_event(key_event)?;
                }
            }
        }

        // Extract key signature changes from subsequent measures
        add_key_changes_from_measures(
            &mut staff,
            &part_data.measures,
            ticks_per_measure,
            pickup_ticks,
            measure_end_ticks,
        )?;

        // Extract clef changes from subsequent measures (for this staff number)
        add_clef_changes_from_measures(
            &mut staff,
            &part_data.measures,
            ticks_per_measure,
            pickup_ticks,
            Some(staff_num),
            measure_end_ticks,
        )?;

        // Convert measures to notes grouped by MusicXML voice number, filtering by staff
        let (notes_by_voice, rests) =
            super::notes::collect_notes_for_staff(&part_data.measures, staff_num, context)?;

        // Create Voice structs from MusicXML voice groups (sorted by voice number)
        let mut voice_keys: Vec<usize> = notes_by_voice.keys().copied().collect();
        voice_keys.sort();
        let mut voices: Vec<Voice> = Vec::new();
        for voice_num in &voice_keys {
            let mut voice = Voice::new();
            for note in notes_by_voice.get(voice_num).unwrap() {
                if voice.can_add_note(note) {
                    let _ = voice.add_note(note.clone());
                } else {
                    voice.interval_events.push(note.clone());
                }
            }
            voices.push(voice);
        }
        if voices.is_empty() {
            voices.push(Voice::new());
        }

        // Distribute rests into voices by MusicXML voice number
        super::notes::distribute_rests(&mut voices, rests);

        // Add all voices to staff
        for voice in voices {
            staff.add_voice(voice);
        }

        staves.push(staff);
    }

    Ok(staves)
}

pub(super) fn convert_staff_for_single_staff(
    part_data: &PartData,
    context: &mut ImportContext,
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
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

    // Extract key signature changes from subsequent measures
    add_key_changes_from_measures(
        &mut staff,
        &part_data.measures,
        ticks_per_measure,
        pickup_ticks,
        measure_end_ticks,
    )?;

    // Extract clef changes from subsequent measures
    add_clef_changes_from_measures(
        &mut staff,
        &part_data.measures,
        ticks_per_measure,
        pickup_ticks,
        None,
        measure_end_ticks,
    )?;

    // Convert measures to notes grouped by MusicXML voice number
    let (notes_by_voice, rests) = super::notes::collect_notes(&part_data.measures, context)?;

    // Create Voice structs from MusicXML voice groups (sorted by voice number)
    let mut voice_keys: Vec<usize> = notes_by_voice.keys().copied().collect();
    voice_keys.sort();
    let mut voices: Vec<Voice> = Vec::new();
    for voice_num in &voice_keys {
        let mut voice = Voice::new();
        for note in notes_by_voice.get(voice_num).unwrap() {
            // Use add_note which validates overlaps; fall back to direct push
            if voice.can_add_note(note) {
                let _ = voice.add_note(note.clone());
            } else {
                voice.interval_events.push(note.clone());
            }
        }
        voices.push(voice);
    }
    if voices.is_empty() {
        voices.push(Voice::new());
    }

    // Distribute rests into voices by MusicXML voice number
    super::notes::distribute_rests(&mut voices, rests);

    // Add all voices to staff
    for voice in voices {
        staff.add_voice(voice);
    }

    Ok(staff)
}

pub(super) fn add_key_changes_from_measures(
    staff: &mut Staff,
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    measure_end_ticks: &[u32],
) -> Result<(), ImportError> {
    for (i, measure) in measures.iter().enumerate().skip(1) {
        if let Some(attrs) = &measure.attributes {
            if let Some(key_data) = &attrs.key {
                let tick = super::actual_measure_start(
                    i,
                    measure_end_ticks,
                    pickup_ticks,
                    ticks_per_measure,
                );
                let key_sig = ElementMapper::map_key(key_data.fifths, Some(&key_data.mode))?;
                let key_event = KeySignatureEvent::new(Tick::new(tick), key_sig);
                // Ignore duplicate-tick errors (shouldn't happen, but be safe)
                let _ = staff.add_key_signature_event(key_event);
            }
        }
    }
    Ok(())
}

pub(super) fn add_clef_changes_from_measures(
    staff: &mut Staff,
    measures: &[MeasureData],
    ticks_per_measure: u32,
    pickup_ticks: u32,
    staff_number: Option<usize>,
    measure_end_ticks: &[u32],
) -> Result<(), ImportError> {
    // Track divisions across measures (inherited from previous measures)
    let mut divisions: i32 = measures
        .first()
        .and_then(|m| m.attributes.as_ref())
        .and_then(|a| a.divisions)
        .unwrap_or(1);

    for (i, measure) in measures.iter().enumerate() {
        // Update divisions from measure-level attributes (if present)
        if let Some(attrs) = &measure.attributes {
            if let Some(d) = attrs.divisions {
                divisions = d;
            }
        }

        let measure_start =
            super::actual_measure_start(i, measure_end_ticks, pickup_ticks, ticks_per_measure);
        // Current timing offset within measure (in 960 PPQ ticks)
        let mut offset: u32 = 0;

        for element in &measure.elements {
            match element {
                MeasureElement::Note(note_data) => {
                    if !note_data.is_chord {
                        if let Ok(ticks) =
                            Fraction::from_musicxml(note_data.duration, divisions).to_ticks()
                        {
                            offset += ticks as u32;
                        }
                    }
                }
                MeasureElement::Rest(rest_data) => {
                    if let Ok(ticks) =
                        Fraction::from_musicxml(rest_data.duration, divisions).to_ticks()
                    {
                        offset += ticks as u32;
                    }
                }
                MeasureElement::Backup(duration) => {
                    if let Ok(ticks) = Fraction::from_musicxml(*duration, divisions).to_ticks() {
                        offset = offset.saturating_sub(ticks as u32);
                    }
                }
                MeasureElement::Forward(duration) => {
                    if let Ok(ticks) = Fraction::from_musicxml(*duration, divisions).to_ticks() {
                        offset += ticks as u32;
                    }
                }
                MeasureElement::Attributes(attrs) => {
                    // Update divisions if changed mid-measure
                    if let Some(d) = attrs.divisions {
                        divisions = d;
                    }
                    let clef_data = if let Some(num) = staff_number {
                        attrs.clefs.iter().find(|c| c.staff_number == num)
                    } else {
                        attrs.clefs.first()
                    };
                    if let Some(cd) = clef_data {
                        let tick = measure_start + offset;
                        let clef = ElementMapper::map_clef(&cd.sign, cd.line)?;
                        let clef_event = ClefEvent::new(Tick::new(tick), clef);
                        // Silently ignores duplicates (e.g., tick-0 clef already added from initial attributes)
                        let _ = staff.add_clef_event(clef_event);
                    }
                }
                MeasureElement::OctaveShift(_) => {}
            }
        }
    }
    Ok(())
}
