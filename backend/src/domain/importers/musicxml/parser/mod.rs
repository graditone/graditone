//! MusicXML Parser — document-level orchestration.
//!
//! Entry point for streaming XML parsing. Delegates element-level
//! parsing to sub-modules: `attributes`, `measure`, `note`, `structure`.

// MusicXML Parser - Feature 006-musicxml-import
// Parses MusicXML documents using quick-xml streaming parser

mod attributes;
mod measure;
mod note;
mod structure;

use quick_xml::Reader;
use quick_xml::events::Event;
use std::io::BufRead;

use super::ImportContext;
use super::errors::ImportError;
use super::types::*;

/// Parses MusicXML documents into intermediate data structures
pub struct MusicXMLParser;

impl MusicXMLParser {
    /// Parses XML content into MusicXMLDocument
    ///
    /// # Arguments
    /// * `xml_content` - Raw XML string from .musicxml or .mxl file
    /// * `context` - Import context for warning collection
    ///
    /// # Returns
    /// MusicXMLDocument with all parts, measures, and elements
    pub fn parse(
        xml_content: &str,
        _context: &mut ImportContext,
    ) -> Result<MusicXMLDocument, ImportError> {
        let mut reader = Reader::from_str(xml_content);
        reader.trim_text(true);

        let mut doc = MusicXMLDocument::default();

        // Parse root element and document structure
        Self::parse_score_partwise(&mut reader, &mut doc)?;

        Ok(doc)
    }

    /// Parses <score-partwise> root element
    ///
    /// Structure:
    /// ```xml
    /// <score-partwise version="3.1">
    ///   <part-list>...</part-list>
    ///   <part id="P1">...</part>
    /// </score-partwise>
    /// ```
    fn parse_score_partwise<B: BufRead>(
        reader: &mut Reader<B>,
        doc: &mut MusicXMLDocument,
    ) -> Result<(), ImportError> {
        let mut buf = Vec::new();
        let mut current_part_id: Option<String> = None;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => match e.name().as_ref() {
                    b"score-partwise" => {
                        // Extract version attribute
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"version" {
                                doc.version = String::from_utf8_lossy(&attr.value).to_string();
                            }
                        }
                    }
                    b"part-list" => {
                        Self::parse_part_list(reader, doc)?;
                    }
                    // Feature 022: Extract title metadata
                    b"work" => {
                        Self::parse_work(reader, doc)?;
                    }
                    b"movement-title" => {
                        if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                            let title = text.unescape().unwrap_or_default().trim().to_string();
                            if !title.is_empty() {
                                doc.movement_title = Some(title);
                            }
                        }
                    }
                    b"identification" => {
                        Self::parse_identification(reader, doc)?;
                    }
                    b"part" => {
                        // Extract part id
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"id" {
                                current_part_id =
                                    Some(String::from_utf8_lossy(&attr.value).to_string());
                            }
                        }

                        if let Some(part_id) = current_part_id.clone() {
                            let part_data = Self::parse_part(reader, &part_id, &doc.part_names)?;

                            // Set doc.default_tempo from the first tempo found.
                            // Prefer <metronome><per-minute> over <sound tempo> since
                            // some editors leave <sound> at a default (e.g. 120) while
                            // the metronome marking reflects the composer's intent.
                            if doc.default_tempo == 120.0 {
                                for measure in &part_data.measures {
                                    if let Some(tempo) = measure.metronome_tempo {
                                        doc.default_tempo = tempo;
                                        break;
                                    }
                                    if let Some(tempo) = measure.sound_tempo {
                                        doc.default_tempo = tempo;
                                        break;
                                    }
                                }
                            }

                            doc.parts.push(part_data);
                        }
                    }
                    _ => {}
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(ImportError::ParseError {
                        line: reader.buffer_position(),
                        column: 0,
                        message: format!("XML parse error: {}", e),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(())
    }

    /// Parses <part-list> section containing instrument metadata
    ///
    /// Structure:
    /// ```xml
    /// <part-list>
    ///   <score-part id="P1">
    ///     <part-name>Piano</part-name>
    ///   </score-part>
    /// </part-list>
    /// ```
    fn parse_part_list<B: BufRead>(
        reader: &mut Reader<B>,
        doc: &mut MusicXMLDocument,
    ) -> Result<(), ImportError> {
        let mut buf = Vec::new();
        let mut current_part_id: Option<String> = None;
        let mut current_part_name = String::new();
        let mut current_instrument_sound: Option<String> = None;
        let mut current_midi_program: Option<u8> = None;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => match e.name().as_ref() {
                    b"score-part" => {
                        // Extract part ID from attributes
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"id" {
                                current_part_id =
                                    Some(String::from_utf8_lossy(&attr.value).to_string());
                            }
                        }
                        current_part_name.clear();
                        current_instrument_sound = None;
                        current_midi_program = None;
                    }
                    b"part-name" => {
                        // Read part name text content
                        if let Ok(Event::Text(e)) = reader.read_event_into(&mut buf) {
                            current_part_name = String::from_utf8_lossy(e.as_ref()).to_string();
                        }
                    }
                    b"instrument-sound" => {
                        // e.g. "strings.violin", "keyboard.piano.grand"
                        if let Ok(Event::Text(e)) = reader.read_event_into(&mut buf) {
                            let sound = e.unescape().unwrap_or_default().trim().to_string();
                            if !sound.is_empty() {
                                current_instrument_sound = Some(sound);
                            }
                        }
                    }
                    b"midi-program" => {
                        // 1-based MIDI program number
                        if let Ok(Event::Text(e)) = reader.read_event_into(&mut buf) {
                            if let Ok(n) = e.unescape().unwrap_or_default().trim().parse::<u8>() {
                                current_midi_program = Some(n);
                            }
                        }
                    }
                    _ => {}
                },
                Ok(Event::End(e)) => match e.name().as_ref() {
                    b"score-part" => {
                        // Store all metadata when closing score-part element
                        if let Some(ref part_id) = current_part_id {
                            doc.part_names
                                .insert(part_id.clone(), current_part_name.clone());
                            if let Some(ref sound) = current_instrument_sound {
                                doc.part_instrument_sounds
                                    .insert(part_id.clone(), sound.clone());
                            }
                            if let Some(prog) = current_midi_program {
                                doc.part_midi_programs.insert(part_id.clone(), prog);
                            }
                        }
                        current_part_id = None;
                        current_part_name.clear();
                        current_instrument_sound = None;
                        current_midi_program = None;
                    }
                    b"part-list" => {
                        break;
                    }
                    _ => {}
                },
                Ok(Event::Eof) => {
                    return Err(ImportError::InvalidStructure {
                        reason: "Unexpected EOF in part-list".to_string(),
                    });
                }
                Err(e) => {
                    return Err(ImportError::ParseError {
                        line: reader.buffer_position(),
                        column: 0,
                        message: format!("XML parse error in part-list: {}", e),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(())
    }

    /// Feature 022: Parses <work> element to extract work-title
    ///
    /// Structure:
    /// ```xml
    /// <work>
    ///   <work-title>My Score Title</work-title>
    /// </work>
    /// ```
    fn parse_work<B: BufRead>(
        reader: &mut Reader<B>,
        doc: &mut MusicXMLDocument,
    ) -> Result<(), ImportError> {
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    if e.name().as_ref() == b"work-title" {
                        if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                            let title = text.unescape().unwrap_or_default().trim().to_string();
                            if !title.is_empty() {
                                doc.work_title = Some(title);
                            }
                        }
                    }
                }
                Ok(Event::End(e)) if e.name().as_ref() == b"work" => {
                    break;
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(ImportError::ParseError {
                        line: reader.buffer_position(),
                        column: 0,
                        message: format!("XML parse error in work: {}", e),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(())
    }

    /// Feature 022: Parses <identification> element to extract composer
    ///
    /// Structure:
    /// ```xml
    /// <identification>
    ///   <creator type="composer">J.S. Bach</creator>
    /// </identification>
    /// ```
    fn parse_identification<B: BufRead>(
        reader: &mut Reader<B>,
        doc: &mut MusicXMLDocument,
    ) -> Result<(), ImportError> {
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    if e.name().as_ref() == b"creator" {
                        let mut is_composer = false;
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"type" && attr.value.as_ref() == b"composer" {
                                is_composer = true;
                            }
                        }
                        if is_composer {
                            if let Ok(Event::Text(text)) = reader.read_event_into(&mut buf) {
                                let composer =
                                    text.unescape().unwrap_or_default().trim().to_string();
                                if !composer.is_empty() {
                                    doc.composer = Some(composer);
                                }
                            }
                        }
                    }
                }
                Ok(Event::End(e)) if e.name().as_ref() == b"identification" => {
                    break;
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(ImportError::ParseError {
                        line: reader.buffer_position(),
                        column: 0,
                        message: format!("XML parse error in identification: {}", e),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(())
    }

    /// Parses <part> element containing all measures for one instrument
    ///
    /// Structure:
    /// ```xml
    /// <part id="P1">
    ///   <measure number="1">...</measure>
    ///   <measure number="2">...</measure>
    /// </part>
    /// ```
    fn parse_part<B: BufRead>(
        reader: &mut Reader<B>,
        part_id: &str,
        part_names: &std::collections::HashMap<String, String>,
    ) -> Result<PartData, ImportError> {
        let mut part = PartData {
            id: part_id.to_string(),
            name: part_names.get(part_id).cloned().unwrap_or_else(|| {
                // Fallback to generic name if not found in part-list
                format!("Instrument {}", part_id)
            }),
            measures: Vec::new(),
            staff_count: 1, // Will be updated after parsing
        };

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    if e.name().as_ref() == b"measure" {
                        // Extract measure number from attributes
                        let mut measure_number = 1;
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"number" {
                                let num_str = String::from_utf8_lossy(&attr.value);
                                measure_number = num_str.parse().unwrap_or(1);
                            }
                        }

                        let measure = Self::parse_measure(reader, measure_number)?;
                        part.measures.push(measure);
                    }
                }
                Ok(Event::End(e)) if e.name().as_ref() == b"part" => {
                    break;
                }
                Ok(Event::Eof) => {
                    return Err(ImportError::InvalidStructure {
                        reason: format!("Unexpected EOF in part {}", part_id),
                    });
                }
                Err(e) => {
                    return Err(ImportError::ParseError {
                        line: reader.buffer_position(),
                        column: 0,
                        message: format!("XML parse error in part {}: {}", part_id, e),
                    });
                }
                _ => {}
            }
            buf.clear();
        }

        // Detect staff count by examining notes and finding max staff number
        let mut max_staff = 1;
        for measure in &part.measures {
            for element in &measure.elements {
                match element {
                    MeasureElement::Note(note_data) => {
                        if note_data.staff > max_staff {
                            max_staff = note_data.staff;
                        }
                    }
                    MeasureElement::Rest(rest_data) => {
                        if rest_data.staff > max_staff {
                            max_staff = rest_data.staff;
                        }
                    }
                    _ => {}
                }
            }
        }
        part.staff_count = max_staff;

        Ok(part)
    }

    /// Parses <measure> — delegates to measure sub-module
    fn parse_measure<B: BufRead>(
        reader: &mut Reader<B>,
        measure_number: i32,
    ) -> Result<MeasureData, ImportError> {
        measure::parse_measure(reader, measure_number)
    }
}
