//! Note, pitch, articulation, and duration parsing.
//!
//! Extracts `<note>` elements including pitch, duration, ties, slurs,
//! beams, grace notes, chord flags, and articulation marks.

use quick_xml::Reader;
use quick_xml::events::Event;
use std::io::BufRead;

use crate::domain::importers::musicxml::errors::ImportError;
use crate::domain::importers::musicxml::types::*;

/// Parses <note> element
///
/// Structure:
/// ```xml
/// <note>
///   <pitch><step>C</step><octave>4</octave></pitch>
///   <duration>480</duration>
///   <voice>1</voice>
///   <type>quarter</type>
/// </note>
/// ```
pub(super) fn parse_note<B: BufRead>(reader: &mut Reader<B>) -> Result<NoteData, ImportError> {
    let mut note = NoteData {
        pitch: None,
        duration: 0,
        voice: 1,
        staff: 1,
        note_type: None,
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

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"pitch" => {
                    note.pitch = Some(parse_pitch(reader)?);
                }
                b"rest" => {
                    note.pitch = None; // Rest has no pitch
                    // Check for measure="yes" attribute
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"measure" {
                            let val = attr.unescape_value().unwrap_or_default();
                            if val == "yes" {
                                note.is_measure_rest = true;
                            }
                        }
                    }
                }
                b"duration" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        note.duration = value.parse().unwrap_or(0);
                    }
                }
                b"voice" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        note.voice = value.parse().unwrap_or(1);
                    }
                }
                b"staff" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        note.staff = value.parse().unwrap_or(1);
                    }
                }
                b"type" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        note.note_type = Some(text.unescape().unwrap_or_default().to_string());
                    }
                }
                b"chord" => {
                    note.is_chord = true;
                }
                b"grace" => {
                    note.is_grace = true;
                }
                b"accidental" => {
                    // <accidental>flat|sharp|natural|...</accidental>
                    // Presence means "display this accidental" (courtesy/editorial)
                    note.has_explicit_accidental = true;
                    // Consume the text content
                    let _ = reader.read_event_into(&mut buf);
                }
                b"dot" => {
                    // <dot/> — augmentation dot (may appear multiple times)
                    note.dot_count += 1;
                }
                b"tie" => {
                    // <tie type="start|stop"/> — playback tie semantics
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"type" {
                            let val = attr.value.as_ref();
                            match val {
                                b"start" => {
                                    // If we already have a Stop, this is a Continue (stop+start)
                                    if note.tie_type == Some(TieType::Stop) {
                                        note.tie_type = Some(TieType::Continue);
                                    } else {
                                        note.tie_type = Some(TieType::Start);
                                    }
                                }
                                b"stop" => {
                                    // If we already have a Start, this is a Continue (start+stop)
                                    if note.tie_type == Some(TieType::Start) {
                                        note.tie_type = Some(TieType::Continue);
                                    } else {
                                        note.tie_type = Some(TieType::Stop);
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
                b"stem" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let val = text.unescape().unwrap_or_default();
                        note.stem_down = match val.as_ref() {
                            "down" => Some(true),
                            "up" => Some(false),
                            _ => None,
                        };
                    }
                }
                b"notations" => {
                    // Parse <notations> container for articulations, etc.
                    parse_notations(reader, &mut note)?;
                }
                b"beam" => {
                    // Parse <beam number="N">type</beam>
                    // Extract beam level from 'number' attribute
                    let mut beam_number: u8 = 1;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"number" {
                            let val = std::str::from_utf8(&attr.value).unwrap_or("1");
                            beam_number = val.parse().unwrap_or(1);
                        }
                    }
                    // Read the text content for beam type
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let beam_text = text.unescape().unwrap_or_default();
                        let beam_type = match beam_text.as_ref() {
                            "begin" => Some(BeamType::Begin),
                            "continue" => Some(BeamType::Continue),
                            "end" => Some(BeamType::End),
                            "forward hook" => Some(BeamType::ForwardHook),
                            "backward hook" => Some(BeamType::BackwardHook),
                            _ => None,
                        };
                        if let Some(bt) = beam_type {
                            note.beams.push(BeamData {
                                number: beam_number,
                                beam_type: bt,
                            });
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"note" => {
                break;
            }
            Ok(Event::Eof) => {
                return Err(ImportError::InvalidStructure {
                    reason: "Unexpected EOF in note".to_string(),
                });
            }
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in note: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(note)
}

/// Parses `<notations>` element for articulations (staccato, etc.)
fn parse_notations<B: BufRead>(
    reader: &mut Reader<B>,
    note: &mut NoteData,
) -> Result<(), ImportError> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"articulations" => {
                    parse_articulations(reader, note)?;
                }
                b"technical" => {
                    parse_technical(reader, note)?;
                }
                b"staccato" => {
                    // <staccato/> can also appear directly under <notations>
                    note.staccato = true;
                }
                b"tied" => {
                    // <tied type="start|stop" placement="above|below"/> — visual tie arc
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"placement" {
                            let val = attr.value.as_ref();
                            match val {
                                b"above" => note.tie_placement = Some(TiePlacement::Above),
                                b"below" => note.tie_placement = Some(TiePlacement::Below),
                                _ => {}
                            }
                        }
                    }
                }
                b"slur" => {
                    // <slur type="start|stop" number="N" placement="above|below"/> — phrase slur arc
                    let mut slur_type_val = None;
                    let mut slur_number: u8 = 1;
                    let mut slur_placement = None;
                    let mut bezier_y: Option<f32> = None;
                    for attr in e.attributes().flatten() {
                        match attr.key.as_ref() {
                            b"type" => {
                                slur_type_val = match attr.value.as_ref() {
                                    b"start" => Some(SlurType::Start),
                                    b"stop" => Some(SlurType::Stop),
                                    _ => None,
                                };
                            }
                            b"number" => {
                                slur_number = std::str::from_utf8(&attr.value)
                                    .unwrap_or("1")
                                    .parse()
                                    .unwrap_or(1);
                            }
                            b"placement" => {
                                slur_placement = match attr.value.as_ref() {
                                    b"above" => Some(SlurPlacement::Above),
                                    b"below" => Some(SlurPlacement::Below),
                                    _ => None,
                                };
                            }
                            b"bezier-y" => {
                                bezier_y = std::str::from_utf8(&attr.value)
                                    .ok()
                                    .and_then(|s| s.parse::<f32>().ok());
                            }
                            _ => {}
                        }
                    }
                    // Use bezier-y sign as direction hint when no
                    // explicit placement="above|below" is given.
                    // In MusicXML, positive bezier-y = above, negative = below.
                    if slur_placement.is_none() {
                        if let Some(by) = bezier_y {
                            if by > 0.0 {
                                slur_placement = Some(SlurPlacement::Above);
                            } else if by < 0.0 {
                                slur_placement = Some(SlurPlacement::Below);
                            }
                        }
                    }
                    if let Some(st) = slur_type_val {
                        note.slurs.push(SlurInfo {
                            slur_type: st,
                            number: slur_number,
                            placement: slur_placement,
                        });
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"notations" => break,
            Ok(Event::Eof) => break,
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

/// Parses `<technical>` element for fingering annotations.
fn parse_technical<B: BufRead>(
    reader: &mut Reader<B>,
    note: &mut NoteData,
) -> Result<(), ImportError> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"fingering" {
                    // Read placement attribute
                    let mut placement_above: Option<bool> = None;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"placement" {
                            match attr.value.as_ref() {
                                b"above" => placement_above = Some(true),
                                b"below" => placement_above = Some(false),
                                _ => {}
                            }
                        }
                    }
                    // Read text content (the digit)
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        let above = placement_above.unwrap_or(note.staff <= 1);
                        // Handle both single-digit ("3") and multi-line
                        // ("1\n3\n5") fingering text from MusicXML editors.
                        for token in value.split_whitespace() {
                            if let Ok(digit) = token.parse::<u8>() {
                                if digit > 0 {
                                    note.fingering.push(
                                        crate::domain::events::note::FingeringAnnotation {
                                            digit,
                                            above,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"technical" => break,
            Ok(Event::Eof) => break,
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

/// Parses `<articulations>` element for staccato, etc.
fn parse_articulations<B: BufRead>(
    reader: &mut Reader<B>,
    note: &mut NoteData,
) -> Result<(), ImportError> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"staccato" {
                    note.staccato = true;
                }
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"articulations" => break,
            Ok(Event::Eof) => break,
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

/// Parses <pitch> element
pub(super) fn parse_pitch<B: BufRead>(reader: &mut Reader<B>) -> Result<PitchData, ImportError> {
    let mut pitch = PitchData {
        step: 'C',
        octave: 4,
        alter: 0,
    };

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"step" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        pitch.step = value.chars().next().unwrap_or('C');
                    }
                }
                b"octave" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        pitch.octave = value.parse().unwrap_or(4);
                    }
                }
                b"alter" => {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        pitch.alter = value.parse().unwrap_or(0);
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"pitch" => break,
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in pitch: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(pitch)
}

/// Parses <backup> or <forward> duration element
pub(super) fn parse_duration_element<B: BufRead>(
    reader: &mut Reader<B>,
) -> Result<Option<i32>, ImportError> {
    let mut buf = Vec::new();
    let mut duration = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"duration" {
                    if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                        let value = text.unescape().unwrap_or_default();
                        duration = Some(value.parse().unwrap_or(0));
                    }
                }
            }
            Ok(Event::End(e))
                if e.name().as_ref() == b"backup" || e.name().as_ref() == b"forward" =>
            {
                break;
            }
            Err(e) => {
                return Err(ImportError::ParseError {
                    line: reader.buffer_position(),
                    column: 0,
                    message: format!("XML parse error in duration element: {}", e),
                });
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(duration)
}
