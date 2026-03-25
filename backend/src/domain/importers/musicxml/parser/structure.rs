//! Barline/repeat and direction/octave-shift parsing.
//!
//! Extracts `<barline>` elements (repeats, endings) and `<direction>`
//! elements (octave shifts, tempo markings) from MusicXML measures.

use quick_xml::Reader;
use quick_xml::events::Event;
use std::io::BufRead;

use crate::domain::importers::musicxml::errors::ImportError;
use crate::domain::importers::musicxml::types::*;

/// Result of parsing a <barline> element's children
pub(super) struct ParsedBarlineResult {
    pub start_repeat: bool,
    pub end_repeat: bool,
    pub ending: Option<RawEndingData>,
}

/// Parses children of a `<barline>` element to detect `<repeat>` and `<ending>` markers.
///
/// Returns a `ParsedBarlineResult` with repeat flags and optional ending data.
pub(super) fn parse_barline_content<B: BufRead>(
    reader: &mut Reader<B>,
    location: &str,
) -> Result<ParsedBarlineResult, ImportError> {
    let mut start_repeat = false;
    let mut end_repeat = false;
    let mut ending: Option<RawEndingData> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) if e.name().as_ref() == b"repeat" => {
                let direction = e
                    .attributes()
                    .filter_map(|a| a.ok())
                    .find(|a| a.key.as_ref() == b"direction")
                    .and_then(|a| String::from_utf8(a.value.into_owned()).ok())
                    .unwrap_or_default();
                match direction.as_str() {
                    "forward" if location == "left" => {
                        start_repeat = true;
                    }
                    // Backward repeat: standard location is "right" of the current measure.
                    // Some editors (e.g., MuseScore) encode it at "left" of the NEXT measure;
                    // treat both as end-repeat on the current measure so the expansion
                    // includes the correct section length.
                    "backward" => {
                        end_repeat = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) if e.name().as_ref() == b"ending" => {
                // Parse <ending number="1" type="start|stop|discontinue"/>
                let mut number: Option<u8> = None;
                let mut end_type: Option<EndingParseType> = None;
                for attr in e.attributes().flatten() {
                    match attr.key.as_ref() {
                        b"number" => {
                            if let Ok(s) = std::str::from_utf8(&attr.value) {
                                // number can be "1", "2", or "1, 2" etc.
                                // Take just the first digit
                                if let Some(first_char) = s.chars().next() {
                                    if let Some(n) = first_char.to_digit(10) {
                                        number = Some(n as u8);
                                    }
                                }
                            }
                        }
                        b"type" => {
                            if let Ok(s) = std::str::from_utf8(&attr.value) {
                                end_type = match s {
                                    "start" => Some(EndingParseType::Start),
                                    "stop" => Some(EndingParseType::Stop),
                                    "discontinue" => Some(EndingParseType::Discontinue),
                                    _ => None,
                                };
                            }
                        }
                        _ => {}
                    }
                }
                if let (Some(n), Some(et)) = (number, end_type) {
                    ending = Some(RawEndingData {
                        number: n,
                        end_type: et,
                    });
                }
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"barline" => {
                break;
            }
            Ok(Event::Eof) => {
                return Err(ImportError::InvalidStructure {
                    reason: "Unexpected EOF in barline".to_string(),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(ParsedBarlineResult {
        start_repeat,
        end_repeat,
        ending,
    })
}

/// Parses a `<direction>` element, looking for `<octave-shift>` children.
pub(super) fn parse_direction<B: BufRead>(
    reader: &mut Reader<B>,
    measure: &mut MeasureData,
) -> Result<(), ImportError> {
    let mut buf = Vec::new();
    let mut staff: usize = 1;
    let mut octave_shift: Option<OctaveShiftData> = None;
    let mut in_metronome = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"staff" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        if let Ok(s) = text.unescape().unwrap_or_default().trim().parse::<usize>() {
                            staff = s;
                        }
                    }
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
            Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"octave-shift" => {
                    let mut shift_type = String::new();
                    let mut size: u8 = 8;
                    for attr in e.attributes().flatten() {
                        match attr.key.as_ref() {
                            b"type" => {
                                shift_type = String::from_utf8_lossy(&attr.value).to_string();
                            }
                            b"size" => {
                                if let Ok(s) = std::str::from_utf8(&attr.value) {
                                    size = s.parse().unwrap_or(8);
                                }
                            }
                            _ => {}
                        }
                    }
                    if !shift_type.is_empty() {
                        octave_shift = Some(OctaveShiftData {
                            shift_type,
                            size,
                            staff: 1, // placeholder, updated with staff below
                        });
                    }
                }
                b"sound" => {
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
                _ => {}
            },
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"direction" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if let Some(mut os) = octave_shift {
        os.staff = staff;
        measure.elements.push(MeasureElement::OctaveShift(os));
    }

    Ok(())
}
