//! Measure element routing.
//!
//! Parses a single `<measure>` element and dispatches child elements
//! (notes, rests, attributes, barlines, directions) to the appropriate
//! sub-module parsers.

use quick_xml::Reader;
use quick_xml::events::Event;
use std::io::BufRead;

use crate::domain::importers::musicxml::errors::ImportError;
use crate::domain::importers::musicxml::types::*;

use super::attributes;
use super::note;
use super::structure;

/// Parses <measure> element containing attributes and musical events
///
/// Structure:
/// ```xml
/// <measure number="1">
///   <attributes>...</attributes>
///   <note>...</note>
///   <note>...</note>
/// </measure>
/// ```
pub(super) fn parse_measure<B: BufRead>(
    reader: &mut Reader<B>,
    measure_number: i32,
) -> Result<MeasureData, ImportError> {
    let mut measure = MeasureData {
        number: measure_number,
        attributes: None,
        elements: Vec::new(),
        start_repeat: false,
        end_repeat: false,
        endings: Vec::new(),
        sound_tempo: None,
        metronome_tempo: None,
        sound_dynamics: None,
    };

    let mut buf = Vec::new();
    let mut in_metronome = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"attributes" => {
                    let attrs = attributes::parse_attributes(reader)?;
                    // Store in elements to track mid-measure position for clef/key changes
                    measure
                        .elements
                        .push(MeasureElement::Attributes(attrs.clone()));
                    // Only set measure-level attributes from the first <attributes> block.
                    // Subsequent blocks (mid-measure clef/key changes) are already tracked
                    // in measure.elements and must not overwrite the initial attributes.
                    if measure.attributes.is_none() {
                        measure.attributes = Some(attrs);
                    }
                }
                b"note" => {
                    let parsed_note = note::parse_note(reader)?;
                    if parsed_note.pitch.is_some() {
                        measure.elements.push(MeasureElement::Note(parsed_note));
                    } else {
                        let rest = RestData {
                            duration: parsed_note.duration,
                            voice: parsed_note.voice,
                            staff: parsed_note.staff,
                            note_type: parsed_note.note_type.clone(),
                            is_measure_rest: parsed_note.is_measure_rest,
                        };
                        measure.elements.push(MeasureElement::Rest(rest));
                    }
                }
                b"backup" => {
                    if let Some(duration) = note::parse_duration_element(reader)? {
                        measure.elements.push(MeasureElement::Backup(duration));
                    }
                }
                b"forward" => {
                    if let Some(duration) = note::parse_duration_element(reader)? {
                        measure.elements.push(MeasureElement::Forward(duration));
                    }
                }
                b"barline" => {
                    // Get location attribute: "left" for start-repeat, "right" for end-repeat
                    let location = e
                        .attributes()
                        .filter_map(|a| a.ok())
                        .find(|a| a.key.as_ref() == b"location")
                        .and_then(|a| String::from_utf8(a.value.into_owned()).ok())
                        .unwrap_or_default();
                    let result = structure::parse_barline_content(reader, &location)?;
                    if result.start_repeat {
                        measure.start_repeat = true;
                    }
                    if result.end_repeat {
                        measure.end_repeat = true;
                    }
                    if let Some(ending_data) = result.ending {
                        measure.endings.push(ending_data);
                    }
                }
                b"direction" => {
                    // Parse <direction> for octave-shift elements
                    structure::parse_direction(reader, &mut measure)?;
                }
                b"metronome" => {
                    in_metronome = true;
                }
                b"per-minute" if in_metronome => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        if let Ok(val) = text.unescape().unwrap_or_default().trim().parse::<f64>() {
                            measure.metronome_tempo = Some(val);
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"sound" {
                    // Extract tempo from <sound tempo="..."/> at measure level
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"tempo" {
                            if let Ok(tempo_str) = std::str::from_utf8(&attr.value) {
                                if let Ok(tempo) = tempo_str.parse::<f64>() {
                                    measure.sound_tempo = Some(tempo);
                                }
                            }
                        }
                    }
                }
            }
            Ok(Event::End(e)) => match e.name().as_ref() {
                b"measure" => break,
                b"metronome" => {
                    in_metronome = false;
                }
                _ => {}
            },
            Ok(Event::Eof) => {
                return Err(ImportError::InvalidStructure {
                    reason: "Unexpected EOF in measure".to_string(),
                });
            }
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in measure: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(measure)
}
