//! Key, clef, time signature, and transposition parsing.
//!
//! Extracts `<attributes>` elements including divisions, key signatures,
//! time signatures, clefs, and staff layout information.

use quick_xml::Reader;
use quick_xml::events::Event;
use std::io::BufRead;

use crate::domain::importers::musicxml::errors::ImportError;
use crate::domain::importers::musicxml::types::*;

/// Parses <attributes> element containing time signature, key, clef, divisions
///
/// Structure:
/// ```xml
/// <attributes>
///   <divisions>480</divisions>
///   <key><fifths>0</fifths></key>
///   <time><beats>4</beats><beat-type>4</beat-type></time>
///   <clef><sign>G</sign><line>2</line></clef>
/// </attributes>
/// ```
pub(super) fn parse_attributes<B: BufRead>(
    reader: &mut Reader<B>,
) -> Result<AttributesData, ImportError> {
    let mut attributes = AttributesData::default();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"divisions" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        attributes.divisions = Some(value.parse().unwrap_or(480));
                    }
                }
                b"key" => {
                    attributes.key = Some(parse_key(reader)?);
                }
                b"time" => {
                    attributes.time = Some(parse_time_signature(reader)?);
                }
                b"clef" => {
                    // Extract staff number attribute (e.g., <clef number="2">)
                    let mut staff_number = 1;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"number" {
                            let number_str = String::from_utf8_lossy(&attr.value);
                            staff_number = number_str.parse().unwrap_or(1);
                        }
                    }
                    let mut clef = parse_clef(reader)?;
                    clef.staff_number = staff_number;
                    attributes.clefs.push(clef);
                }
                b"sound" => {
                    // Extract tempo from <sound tempo="120"/>
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"tempo" {
                            let tempo_str = String::from_utf8_lossy(&attr.value);
                            attributes.tempo = Some(tempo_str.parse().unwrap_or(120.0));
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"attributes" => {
                break;
            }
            Ok(Event::Eof) => {
                return Err(ImportError::InvalidStructure {
                    reason: "Unexpected EOF in attributes".to_string(),
                });
            }
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in attributes: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(attributes)
}

/// Parses <key> element
pub(super) fn parse_key<B: BufRead>(reader: &mut Reader<B>) -> Result<KeyData, ImportError> {
    let mut key = KeyData {
        fifths: 0,
        mode: "major".to_string(),
    };

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"fifths" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        key.fifths = value.parse().unwrap_or(0);
                    }
                }
                b"mode" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        key.mode = text.unescape().unwrap_or_default().to_string();
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"key" => break,
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in key: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(key)
}

/// Parses <time> element
pub(super) fn parse_time_signature<B: BufRead>(
    reader: &mut Reader<B>,
) -> Result<TimeSignatureData, ImportError> {
    let mut time = TimeSignatureData {
        beats: 4,
        beat_type: 4,
    };

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"beats" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        time.beats = value.parse().unwrap_or(4);
                    }
                }
                b"beat-type" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        time.beat_type = value.parse().unwrap_or(4);
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"time" => break,
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in time: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(time)
}

/// Parses <clef> element
pub(super) fn parse_clef<B: BufRead>(reader: &mut Reader<B>) -> Result<ClefData, ImportError> {
    let mut clef = ClefData {
        sign: "G".to_string(),
        line: 2,
        staff_number: 1,
    };

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"sign" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        clef.sign = text.unescape().unwrap_or_default().to_string();
                    }
                }
                b"line" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        clef.line = value.parse().unwrap_or(2);
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"clef" => break,
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in clef: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(clef)
}
