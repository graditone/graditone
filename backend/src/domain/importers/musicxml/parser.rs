// MusicXML Parser - Feature 006-musicxml-import
// Parses MusicXML documents using quick-xml streaming parser

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
                    }
                    b"part-name" => {
                        // Read part name text content
                        if let Ok(Event::Text(e)) = reader.read_event_into(&mut buf) {
                            current_part_name = String::from_utf8_lossy(e.as_ref()).to_string();
                        }
                    }
                    _ => {}
                },
                Ok(Event::End(e)) => match e.name().as_ref() {
                    b"score-part" => {
                        // Store part name mapping when closing score-part element
                        if let Some(ref part_id) = current_part_id {
                            doc.part_names
                                .insert(part_id.clone(), current_part_name.clone());
                        }
                        current_part_id = None;
                        current_part_name.clear();
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
    fn parse_measure<B: BufRead>(
        reader: &mut Reader<B>,
        measure_number: i32,
    ) -> Result<MeasureData, ImportError> {
        let mut measure = MeasureData {
            number: measure_number,
            attributes: None,
            elements: Vec::new(),
            start_repeat: false,
            end_repeat: false,
        };

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => match e.name().as_ref() {
                    b"attributes" => {
                        measure.attributes = Some(Self::parse_attributes(reader)?);
                    }
                    b"note" => {
                        let note = Self::parse_note(reader)?;
                        if note.pitch.is_some() {
                            measure.elements.push(MeasureElement::Note(note));
                        } else {
                            let rest = RestData {
                                duration: note.duration,
                                voice: note.voice,
                                staff: note.staff,
                            };
                            measure.elements.push(MeasureElement::Rest(rest));
                        }
                    }
                    b"backup" => {
                        if let Some(duration) = Self::parse_duration_element(reader)? {
                            measure.elements.push(MeasureElement::Backup(duration));
                        }
                    }
                    b"forward" => {
                        if let Some(duration) = Self::parse_duration_element(reader)? {
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
                        let (start_rep, end_rep) = Self::parse_barline_content(reader, &location)?;
                        if start_rep {
                            measure.start_repeat = true;
                        }
                        if end_rep {
                            measure.end_repeat = true;
                        }
                    }
                    _ => {}
                },
                Ok(Event::Empty(e)) => {
                    if e.name().as_ref() == b"sound" {
                        // Handle <sound tempo="120"/> as empty element
                    }
                }
                Ok(Event::End(e)) if e.name().as_ref() == b"measure" => {
                    break;
                }
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

    /// Parses children of a `<barline>` element to detect `<repeat>` markers.
    ///
    /// Returns `(start_repeat, end_repeat)`:
    /// - `start_repeat = true` when location="left" and `<repeat direction="forward"/>` found
    /// - `end_repeat = true` when location="right" and `<repeat direction="backward"/>` found
    fn parse_barline_content<B: BufRead>(
        reader: &mut Reader<B>,
        location: &str,
    ) -> Result<(bool, bool), ImportError> {
        let mut start_repeat = false;
        let mut end_repeat = false;
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e))
                    if e.name().as_ref() == b"repeat" =>
                {
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

        Ok((start_repeat, end_repeat))
    }

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
    fn parse_attributes<B: BufRead>(reader: &mut Reader<B>) -> Result<AttributesData, ImportError> {
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
                        attributes.key = Some(Self::parse_key(reader)?);
                    }
                    b"time" => {
                        attributes.time = Some(Self::parse_time_signature(reader)?);
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
                        let mut clef = Self::parse_clef(reader)?;
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
    fn parse_key<B: BufRead>(reader: &mut Reader<B>) -> Result<KeyData, ImportError> {
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
    fn parse_time_signature<B: BufRead>(
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
    fn parse_clef<B: BufRead>(reader: &mut Reader<B>) -> Result<ClefData, ImportError> {
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
    fn parse_note<B: BufRead>(reader: &mut Reader<B>) -> Result<NoteData, ImportError> {
        let mut note = NoteData {
            pitch: None,
            duration: 0,
            voice: 1,
            staff: 1,
            note_type: None,
            is_chord: false,
            beams: Vec::new(),
        };

        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => match e.name().as_ref() {
                    b"pitch" => {
                        note.pitch = Some(Self::parse_pitch(reader)?);
                    }
                    b"rest" => {
                        note.pitch = None; // Rest has no pitch
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

    /// Parses <pitch> element
    fn parse_pitch<B: BufRead>(reader: &mut Reader<B>) -> Result<PitchData, ImportError> {
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
    fn parse_duration_element<B: BufRead>(
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
}
