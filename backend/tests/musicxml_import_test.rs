// Integration tests for MusicXML Import - Feature 006-musicxml-import

use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLImporter, MusicXMLParser,
};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::env;
use std::path::Path;

#[test]
fn test_parse_simple_melody() {
    // T034: Parse simple_melody.musicxml → MusicXMLDocument with 1 part

    let fixture_path = Path::new("../tests/fixtures/musicxml/simple_melody.musicxml");

    // Load XML content
    let xml_content = CompressionHandler::load_content(fixture_path)
        .expect("Failed to load simple_melody.musicxml");

    // Parse into MusicXMLDocument
    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context)
        .expect("Failed to parse simple_melody.musicxml");

    // Verify document structure
    assert_eq!(
        doc.parts.len(),
        1,
        "Expected 1 part in simple_melody.musicxml"
    );

    let part = &doc.parts[0];
    assert_eq!(part.id, "P1", "Expected part ID to be P1");
    assert_eq!(part.measures.len(), 2, "Expected 2 measures");

    // Verify first measure has attributes
    let measure1 = &part.measures[0];
    assert_eq!(measure1.number, 1);
    assert!(
        measure1.attributes.is_some(),
        "First measure should have attributes"
    );

    if let Some(attrs) = &measure1.attributes {
        assert_eq!(attrs.divisions, Some(480), "Expected divisions=480");
        assert_eq!(attrs.clefs.len(), 1, "Expected 1 clef");
        assert_eq!(attrs.clefs[0].sign, "G");
        assert_eq!(attrs.clefs[0].line, 2);

        if let Some(time) = &attrs.time {
            assert_eq!(time.beats, 4);
            assert_eq!(time.beat_type, 4);
        } else {
            panic!("Expected time signature");
        }

        if let Some(key) = &attrs.key {
            assert_eq!(key.fifths, 0, "Expected C major (0 sharps/flats)");
        } else {
            panic!("Expected key signature");
        }
    }

    // Verify notes in first measure
    let note_count_m1 = measure1
        .elements
        .iter()
        .filter(|e| {
            matches!(
                e,
                musicore_backend::domain::importers::musicxml::MeasureElement::Note(_)
            )
        })
        .count();
    assert_eq!(note_count_m1, 4, "Expected 4 notes in first measure");

    // Verify second measure
    let measure2 = &part.measures[1];
    assert_eq!(measure2.number, 2);

    let note_count_m2 = measure2
        .elements
        .iter()
        .filter(|e| {
            matches!(
                e,
                musicore_backend::domain::importers::musicxml::MeasureElement::Note(_)
            )
        })
        .count();
    assert_eq!(note_count_m2, 4, "Expected 4 notes in second measure");
}

#[test]
fn test_parse_malformed_xml() {
    // T076: Import malformed.xml → verify ParseError with line number

    let fixture_path = Path::new("../tests/fixtures/musicxml/malformed.xml");

    let xml_content =
        CompressionHandler::load_content(fixture_path).expect("Failed to load malformed.xml");

    let mut context = ImportContext::new();
    let result = MusicXMLParser::parse(&xml_content, &mut context);

    assert!(result.is_err(), "Expected parse error for malformed XML");

    if let Err(e) = result {
        match e {
            musicore_backend::domain::importers::musicxml::ImportError::ParseError {
                line,
                message,
                ..
            } => {
                assert!(line > 0, "Expected line number > 0");
                assert!(
                    message.contains("XML parse error") || message.contains("parse"),
                    "Expected parse error message, got: {}",
                    message
                );
            }
            _ => panic!("Expected ParseError, got: {:?}", e),
        }
    }
}

#[test]
fn test_parse_note_with_pitch() {
    // Parse a document and verify pitch extraction
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");

    assert_eq!(doc.parts.len(), 1);
    let measure = &doc.parts[0].measures[0];

    match &measure.elements[1] {
        musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) => {
            assert!(note.pitch.is_some());
            let pitch = note.pitch.as_ref().unwrap();
            assert_eq!(pitch.step, 'C');
            assert_eq!(pitch.octave, 4);
            assert_eq!(pitch.alter, 0);
            assert_eq!(note.duration, 480);
            assert_eq!(note.voice, 1);
        }
        _ => panic!("Expected Note element"),
    }
}

#[test]
fn test_parse_rest() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
      </attributes>
      <note>
        <rest/>
        <duration>480</duration>
        <voice>1</voice>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");

    let measure = &doc.parts[0].measures[0];
    match &measure.elements[1] {
        musicore_backend::domain::importers::musicxml::MeasureElement::Rest(rest) => {
            assert_eq!(rest.duration, 480);
            assert_eq!(rest.voice, 1);
        }
        _ => panic!("Expected Rest element"),
    }
}

// ============================================================================
// User Story 2: Multi-Staff Piano Tests (T087-T089)
// ============================================================================

// ============================================================================
// Beam Parsing Tests (021-note-beaming T007)
// ============================================================================

#[test]
fn test_parse_beam_single_level() {
    // T007: Test single-level beam parsing (begin/continue/end)
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <beam number="1">begin</beam>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <beam number="1">continue</beam>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <beam number="1">continue</beam>
      </note>
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <beam number="1">end</beam>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");
    let elements = &doc.parts[0].measures[0].elements;

    use musicore_backend::domain::importers::musicxml::types::{BeamData, BeamType};

    // First note: beam begin (index 1, after Attributes element)
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[1]
    {
        assert_eq!(
            note.beams.len(),
            1,
            "First note should have 1 beam annotation"
        );
        assert_eq!(note.beams[0].number, 1);
        assert_eq!(note.beams[0].beam_type, BeamType::Begin);
    } else {
        panic!("Expected Note element");
    }

    // Second note: beam continue
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[2]
    {
        assert_eq!(note.beams.len(), 1);
        assert_eq!(note.beams[0].beam_type, BeamType::Continue);
    } else {
        panic!("Expected Note element");
    }

    // Third note: beam continue
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[3]
    {
        assert_eq!(note.beams.len(), 1);
        assert_eq!(note.beams[0].beam_type, BeamType::Continue);
    } else {
        panic!("Expected Note element");
    }

    // Fourth note: beam end
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[4]
    {
        assert_eq!(note.beams.len(), 1);
        assert_eq!(note.beams[0].beam_type, BeamType::End);
    } else {
        panic!("Expected Note element");
    }
}

#[test]
fn test_parse_beam_multi_level() {
    // T007: Test multi-level beam parsing (sixteenth notes have 2 beam levels)
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>120</duration>
        <voice>1</voice>
        <type>16th</type>
        <beam number="1">begin</beam>
        <beam number="2">begin</beam>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>120</duration>
        <voice>1</voice>
        <type>16th</type>
        <beam number="1">continue</beam>
        <beam number="2">end</beam>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");
    let elements = &doc.parts[0].measures[0].elements;

    use musicore_backend::domain::importers::musicxml::types::BeamType;

    // First note: beam level 1 begin, beam level 2 begin (index 1, after Attributes)
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[1]
    {
        assert_eq!(
            note.beams.len(),
            2,
            "First note should have 2 beam annotations"
        );
        assert_eq!(note.beams[0].number, 1);
        assert_eq!(note.beams[0].beam_type, BeamType::Begin);
        assert_eq!(note.beams[1].number, 2);
        assert_eq!(note.beams[1].beam_type, BeamType::Begin);
    } else {
        panic!("Expected Note element");
    }

    // Second note: beam level 1 continue, beam level 2 end
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[2]
    {
        assert_eq!(note.beams.len(), 2);
        assert_eq!(note.beams[0].number, 1);
        assert_eq!(note.beams[0].beam_type, BeamType::Continue);
        assert_eq!(note.beams[1].number, 2);
        assert_eq!(note.beams[1].beam_type, BeamType::End);
    } else {
        panic!("Expected Note element");
    }
}

#[test]
fn test_parse_beam_hooks() {
    // T007: Test forward and backward hook parsing
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <beam number="1">begin</beam>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>120</duration>
        <voice>1</voice>
        <type>16th</type>
        <beam number="1">end</beam>
        <beam number="2">backward hook</beam>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");
    let elements = &doc.parts[0].measures[0].elements;

    use musicore_backend::domain::importers::musicxml::types::BeamType;

    // Second note should have backward hook at level 2 (index 2, after Attributes)
    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[2]
    {
        assert_eq!(note.beams.len(), 2);
        assert_eq!(note.beams[0].number, 1);
        assert_eq!(note.beams[0].beam_type, BeamType::End);
        assert_eq!(note.beams[1].number, 2);
        assert_eq!(note.beams[1].beam_type, BeamType::BackwardHook);
    } else {
        panic!("Expected Note element");
    }
}

#[test]
fn test_parse_note_without_beams() {
    // T007: Test that notes without beam elements have empty beams vec
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse");
    let elements = &doc.parts[0].measures[0].elements;

    if let musicore_backend::domain::importers::musicxml::MeasureElement::Note(note) = &elements[1]
    {
        assert!(
            note.beams.is_empty(),
            "Quarter note should have no beam annotations"
        );
    } else {
        panic!("Expected Note element");
    }
}

#[test]
fn test_import_piano_grand_staff_structure() {
    // T087: Import piano_grand_staff.musicxml → verify 1 instrument with 2 staves

    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::ports::importers::IMusicXMLImporter;

    let fixture_path = Path::new("../tests/fixtures/musicxml/piano_grand_staff.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import piano_grand_staff.musicxml");

    let score = result.score;

    // Verify 1 instrument
    assert_eq!(
        score.instruments.len(),
        1,
        "Expected 1 instrument in piano grand staff"
    );

    let instrument = &score.instruments[0];
    assert_eq!(
        instrument.name, "Piano",
        "Expected instrument name 'Piano' (from part-name in MusicXML)"
    );

    // Verify 2 staves
    assert_eq!(
        instrument.staves.len(),
        2,
        "Expected 2 staves in grand staff (treble + bass)"
    );

    // Verify both staves have structural events
    let staff1 = &instrument.staves[0];
    let staff2 = &instrument.staves[1];

    assert!(
        !staff1.staff_structural_events.is_empty(),
        "Staff 1 should have structural events"
    );
    assert!(
        !staff2.staff_structural_events.is_empty(),
        "Staff 2 should have structural events"
    );

    // Verify both staves have voices
    assert_eq!(staff1.voices.len(), 1, "Staff 1 should have 1 voice");
    assert_eq!(staff2.voices.len(), 1, "Staff 2 should have 1 voice");
}

#[test]
fn test_piano_grand_staff_clefs() {
    // T088: Verify treble clef on staff 1, bass clef on staff 2

    use musicore_backend::domain::events::staff::StaffStructuralEvent;
    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::domain::value_objects::Clef;
    use musicore_backend::ports::importers::IMusicXMLImporter;

    let fixture_path = Path::new("../tests/fixtures/musicxml/piano_grand_staff.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import piano_grand_staff.musicxml");

    let score = result.score;
    let instrument = &score.instruments[0];
    let staff1 = &instrument.staves[0];
    let staff2 = &instrument.staves[1];

    // Find clef events in staff 1
    let staff1_clef = staff1
        .staff_structural_events
        .iter()
        .find_map(|event| match event {
            StaffStructuralEvent::Clef(ce) => Some(&ce.clef),
            _ => None,
        })
        .expect("Staff 1 should have a clef");

    assert_eq!(
        *staff1_clef,
        Clef::Treble,
        "Staff 1 should have Treble clef"
    );

    // Find clef event in staff 2
    let staff2_clef = staff2
        .staff_structural_events
        .iter()
        .find_map(|event| match event {
            StaffStructuralEvent::Clef(ce) => Some(&ce.clef),
            _ => None,
        })
        .expect("Staff 2 should have a clef");

    assert_eq!(*staff2_clef, Clef::Bass, "Staff 2 should have Bass clef");
}

#[test]
fn test_piano_grand_staff_note_separation() {
    // T089: Verify notes in different staves are separated correctly

    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::domain::value_objects::{Pitch, Tick};
    use musicore_backend::ports::importers::IMusicXMLImporter;

    let fixture_path = Path::new("../tests/fixtures/musicxml/piano_grand_staff.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import piano_grand_staff.musicxml");

    let score = result.score;
    let instrument = &score.instruments[0];
    let staff1 = &instrument.staves[0];
    let staff2 = &instrument.staves[1];

    // Get notes from each staff
    let staff1_notes = &staff1.voices[0].interval_events;
    let staff2_notes = &staff2.voices[0].interval_events;

    // Verify note count (piano_grand_staff.musicxml has 4 treble notes, 2 bass notes)
    assert_eq!(
        staff1_notes.len(),
        4,
        "Staff 1 (treble) should have 4 notes"
    );
    assert_eq!(staff2_notes.len(), 2, "Staff 2 (bass) should have 2 notes");

    // Verify pitch ranges (treble notes should be higher than bass notes)
    // Staff 1: C5, E5, G5, C5 (MIDI 72, 76, 79, 72)
    // Staff 2: C3, G2 (MIDI 48, 43)

    assert_eq!(
        staff1_notes[0].pitch,
        Pitch::new(72).unwrap(),
        "First treble note should be C5 (MIDI 72)"
    );
    assert_eq!(
        staff1_notes[1].pitch,
        Pitch::new(76).unwrap(),
        "Second treble note should be E5 (MIDI 76)"
    );
    assert_eq!(
        staff1_notes[2].pitch,
        Pitch::new(79).unwrap(),
        "Third treble note should be G5 (MIDI 79)"
    );
    assert_eq!(
        staff1_notes[3].pitch,
        Pitch::new(72).unwrap(),
        "Fourth treble note should be C5 (MIDI 72)"
    );

    assert_eq!(
        staff2_notes[0].pitch,
        Pitch::new(48).unwrap(),
        "First bass note should be C3 (MIDI 48)"
    );
    assert_eq!(
        staff2_notes[1].pitch,
        Pitch::new(43).unwrap(),
        "Second bass note should be G2 (MIDI 43)"
    );

    // Verify all treble notes are higher pitch than all bass notes
    let min_treble_pitch = staff1_notes.iter().map(|n| n.pitch.value()).min().unwrap();
    let max_bass_pitch = staff2_notes.iter().map(|n| n.pitch.value()).max().unwrap();

    assert!(
        min_treble_pitch > max_bass_pitch,
        "Treble notes should be in higher pitch range than bass notes"
    );

    // Verify timing (notes should start at measure boundaries)
    assert_eq!(
        staff1_notes[0].start_tick,
        Tick::new(0),
        "First treble note should start at tick 0"
    );
    assert_eq!(
        staff2_notes[0].start_tick,
        Tick::new(0),
        "First bass note should start at tick 0"
    );
}

// ============================================================================
// User Story 1: Integration Tests (T075-T077)
// ============================================================================

#[test]
fn test_import_simple_melody_full() {
    // T075: Import simple_melody.musicxml → verify 8 notes, 1 instrument

    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::ports::importers::IMusicXMLImporter;

    let fixture_path = Path::new("../tests/fixtures/musicxml/simple_melody.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import simple_melody.musicxml");

    let score = result.score;

    // Verify 1 instrument
    assert_eq!(
        score.instruments.len(),
        1,
        "Expected 1 instrument in simple melody"
    );

    let instrument = &score.instruments[0];
    assert_eq!(
        instrument.staves.len(),
        1,
        "Expected 1 staff in simple melody"
    );

    // Verify notes
    let staff = &instrument.staves[0];
    assert_eq!(staff.voices.len(), 1, "Expected 1 voice");

    let notes = &staff.voices[0].interval_events;
    assert_eq!(
        notes.len(),
        8,
        "Expected 8 notes in simple melody (4 per measure × 2 measures)"
    );

    // Verify statistics
    assert_eq!(result.statistics.instrument_count, 1);
    assert_eq!(result.statistics.staff_count, 1);
    assert_eq!(result.statistics.voice_count, 1);
    assert_eq!(result.statistics.note_count, 8);

    // Verify global structural events (tempo, time signature)
    assert!(
        !score.global_structural_events.is_empty(),
        "Should have global structural events"
    );
}

#[test]
fn test_import_malformed_xml_error() {
    // T076: Import malformed.xml → verify ParseError with line number

    use musicore_backend::domain::importers::musicxml::ImportError;
    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::ports::importers::IMusicXMLImporter;

    let fixture_path = Path::new("../tests/fixtures/musicxml/malformed.xml");

    let importer = MusicXMLImporter::new();
    let result = importer.import_file(fixture_path);

    assert!(result.is_err(), "Expected error for malformed XML");

    if let Err(e) = result {
        // Downcast Box<dyn Error> to ImportError
        let import_err = e.downcast_ref::<ImportError>();
        assert!(import_err.is_some(), "Expected ImportError type");

        if let Some(ImportError::ParseError { line, message, .. }) = import_err {
            assert!(*line > 0, "Expected line number > 0, got {}", line);
            assert!(!message.is_empty(), "Expected non-empty error message");
            println!("Parse error at line {}: {}", line, message);
        } else {
            panic!("Expected ParseError variant, got {:?}", import_err);
        }
    }
}

#[test]
fn test_import_compressed_mxl() {
    // T077: Import .mxl compressed file → verify decompression works

    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::ports::importers::IMusicXMLImporter;

    // Create a test .mxl file from simple_melody.musicxml
    let source_path = Path::new("../tests/fixtures/musicxml/simple_melody.musicxml");
    let mxl_path = Path::new("/tmp/test_simple_melody.mxl");

    // Create .mxl by zipping the XML file with proper structure
    use std::fs::File;
    use std::io::{Read, Write};

    // Read the source XML
    let mut xml_content = String::new();
    File::open(source_path)
        .expect("Failed to open source XML")
        .read_to_string(&mut xml_content)
        .expect("Failed to read source XML");

    // Create a proper .mxl ZIP file with META-INF/container.xml
    {
        let file = File::create(mxl_path).expect("Failed to create .mxl file");
        let mut zip = zip::ZipWriter::new(file);

        let options =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Add META-INF/container.xml
        let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="simple_melody.xml"/>
  </rootfiles>
</container>"#;

        zip.start_file("META-INF/container.xml", options)
            .expect("Failed to add container.xml to ZIP");
        zip.write_all(container_xml.as_bytes())
            .expect("Failed to write container.xml");

        // Add the main score XML
        zip.start_file("simple_melody.xml", options)
            .expect("Failed to add score file to ZIP");
        zip.write_all(xml_content.as_bytes())
            .expect("Failed to write score XML to ZIP");

        zip.finish().expect("Failed to finalize ZIP");
    }

    // Import the .mxl file
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(mxl_path)
        .expect("Failed to import .mxl file");

    // Verify decompression worked
    let score = result.score;
    assert_eq!(
        score.instruments.len(),
        1,
        "Expected 1 instrument after decompression"
    );

    let instrument = &score.instruments[0];
    let staff = &instrument.staves[0];
    let notes = &staff.voices[0].interval_events;

    assert_eq!(notes.len(), 8, "Expected 8 notes after decompression");

    // Verify metadata shows it was compressed
    assert!(
        result.metadata.format.contains("MusicXML"),
        "Metadata should indicate MusicXML format"
    );

    // Clean up
    std::fs::remove_file(mxl_path).ok();
}

// ============================================================================
// User Story 3: Multi-Instrument Support Tests (T095-T097)
// ============================================================================

#[test]
fn test_import_quartet_four_instruments() {
    // T090, T095: Import quartet.musicxml (4 instruments) → verify 4 Instruments with correct names
    let project_root = std::env::current_dir()
        .expect("Failed to get current directory")
        .parent()
        .unwrap()
        .to_path_buf();

    let fixture_path = project_root.join("tests/fixtures/musicxml/quartet.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(&fixture_path)
        .expect("Failed to import quartet.musicxml");

    let score = result.score;

    // Verify 4 instruments
    assert_eq!(
        score.instruments.len(),
        4,
        "Expected 4 instruments in quartet (Violin, Viola, Cello, Contrabass)"
    );

    // Verify instrument names are extracted from <part-name> elements (T092)
    let expected_names = ["Violin", "Viola", "Cello", "Contrabass"];
    for (i, expected_name) in expected_names.iter().enumerate() {
        assert_eq!(
            score.instruments[i].name,
            *expected_name,
            "Instrument {} should be named '{}'",
            i + 1,
            expected_name
        );
    }

    // Verify each instrument has 1 staff
    for (i, instrument) in score.instruments.iter().enumerate() {
        assert_eq!(
            instrument.staves.len(),
            1,
            "Instrument {} should have 1 staff",
            i + 1
        );
    }
}

#[test]
fn test_quartet_instrument_clefs() {
    // T096: Verify each instrument has correct clef (Violin=Treble, Viola=Alto, Cello=Bass, Contrabass=Bass)
    let project_root = env::current_dir()
        .expect("Failed to get current directory")
        .parent()
        .unwrap()
        .to_path_buf();

    let fixture_path = project_root.join("tests/fixtures/musicxml/quartet.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(&fixture_path)
        .expect("Failed to import quartet.musicxml");

    let score = result.score;

    use musicore_backend::domain::events::staff::StaffStructuralEvent;
    use musicore_backend::domain::value_objects::Clef;

    // Verify instrument-specific clefs
    let expected_clefs = [
        ("Violin", Clef::Treble),
        ("Viola", Clef::Alto),
        ("Cello", Clef::Bass),
        ("Contrabass", Clef::Bass),
    ];

    for (i, (name, expected_clef)) in expected_clefs.iter().enumerate() {
        let instrument = &score.instruments[i];
        assert_eq!(instrument.name, *name);

        let staff = &instrument.staves[0];
        assert!(
            !staff.staff_structural_events.is_empty(),
            "{} staff should have structural events",
            name
        );

        // Check clef events
        let clef_events: Vec<_> = staff
            .staff_structural_events
            .iter()
            .filter_map(|e| {
                if let StaffStructuralEvent::Clef(clef_event) = e {
                    Some(clef_event.clef)
                } else {
                    None
                }
            })
            .collect();

        assert!(!clef_events.is_empty(), "{} should have clef event", name);
        assert_eq!(
            clef_events[0], *expected_clef,
            "{} should have {:?} clef",
            name, expected_clef
        );
    }
}

#[test]
fn test_quartet_instrument_key_signatures() {
    // T097: Verify instrument-specific key signatures are preserved
    let project_root = env::current_dir()
        .expect("Failed to get current directory")
        .parent()
        .unwrap()
        .to_path_buf();

    let fixture_path = project_root.join("tests/fixtures/musicxml/quartet.musicxml");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(&fixture_path)
        .expect("Failed to import quartet.musicxml");

    let score = result.score;

    use musicore_backend::domain::events::staff::StaffStructuralEvent;
    use musicore_backend::domain::value_objects::KeySignature;

    // Verify all instruments have C Major key signature (fifths=0)
    // In quartet.musicxml, all parts have <fifths>0</fifths><mode>major</mode>
    let expected_key = KeySignature::new(0).expect("Failed to create C Major key signature");

    for instrument in &score.instruments {
        let staff = &instrument.staves[0];

        // Check key signature events
        let key_events: Vec<_> = staff
            .staff_structural_events
            .iter()
            .filter_map(|e| {
                if let StaffStructuralEvent::KeySignature(key_event) = e {
                    Some(key_event.key)
                } else {
                    None
                }
            })
            .collect();

        assert!(
            !key_events.is_empty(),
            "{} should have key signature event",
            instrument.name
        );
        assert_eq!(
            key_events[0], expected_key,
            "{} should have C Major key signature",
            instrument.name
        );
    }
}

/// Test for bug: Two consecutive measures with whole notes should not overlap
#[test]
fn test_two_measures_piano_whole_notes() {
    let fixture_path = std::env::current_dir()
        .expect("Failed to get current directory")
        .parent()
        .unwrap()
        .join("tests/fixtures/musicxml/two_bars_piano_whole_notes.musicxml");
    let importer = MusicXMLImporter::new();
    let result = importer.import_file(&fixture_path);

    match result {
        Ok(import_result) => {
            let score = import_result.score;
            println!("Import successful!");
            println!("Instruments: {}", score.instruments.len());
            if !score.instruments.is_empty() {
                println!(
                    "Staves in instrument 0: {}",
                    score.instruments[0].staves.len()
                );
                for (i, staff) in score.instruments[0].staves.iter().enumerate() {
                    println!("Staff {} voices: {}", i, staff.voices.len());
                    if !staff.voices.is_empty() {
                        println!(
                            "Staff {} voice 0 notes: {}",
                            i,
                            staff.voices[0].interval_events.len()
                        );
                        for (j, note) in staff.voices[0].interval_events.iter().enumerate() {
                            println!(
                                "  Note {}: start={}, duration={}, pitch={}",
                                j,
                                note.start_tick.value(),
                                note.duration_ticks,
                                note.pitch.value()
                            );
                        }
                    }
                }
            }
        }
        Err(e) => {
            println!("Import failed with error: {:?}", e);
            panic!("Import should succeed but failed: {:?}", e);
        }
    }
}

// ============================================================================
// Feature 022: Title Extraction Tests
// ============================================================================

#[test]
fn test_parse_work_title() {
    // Feature 022: Parse <work>/<work-title> element
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work>
    <work-title>Symphony No. 5</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc =
        MusicXMLParser::parse(xml, &mut context).expect("Failed to parse XML with work-title");

    assert_eq!(doc.work_title, Some("Symphony No. 5".to_string()));
    assert_eq!(doc.movement_title, None);
}

#[test]
fn test_parse_movement_title() {
    // Feature 022: Parse <movement-title> element
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <movement-title>Allegro con brio</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc =
        MusicXMLParser::parse(xml, &mut context).expect("Failed to parse XML with movement-title");

    assert_eq!(doc.work_title, None);
    assert_eq!(doc.movement_title, Some("Allegro con brio".to_string()));
}

#[test]
fn test_parse_composer() {
    // Feature 022: Parse <identification>/<creator type="composer"> element
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <identification>
    <creator type="composer">Ludwig van Beethoven</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse XML with composer");

    assert_eq!(doc.composer, Some("Ludwig van Beethoven".to_string()));
}

#[test]
fn test_work_title_preferred_over_movement_title() {
    // Feature 022: work_title takes precedence over movement_title in metadata resolution
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work>
    <work-title>Symphony No. 5</work-title>
  </work>
  <movement-title>I. Allegro con brio</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc =
        MusicXMLParser::parse(xml, &mut context).expect("Failed to parse XML with both titles");

    assert_eq!(doc.work_title, Some("Symphony No. 5".to_string()));
    assert_eq!(doc.movement_title, Some("I. Allegro con brio".to_string()));

    // Resolution rule: work_title.or(movement_title) = "Symphony No. 5"
    let resolved_title = doc.work_title.clone().or(doc.movement_title.clone());
    assert_eq!(resolved_title, Some("Symphony No. 5".to_string()));
}

#[test]
fn test_no_title_metadata() {
    // Feature 022: Files without title metadata should have None values
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>"#;

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(xml, &mut context).expect("Failed to parse XML without title");

    assert_eq!(doc.work_title, None);
    assert_eq!(doc.movement_title, None);
    assert_eq!(doc.composer, None);
}

#[test]
fn test_lacandeur_staff2_clef_events_debug() {
    use musicore_backend::domain::events::staff::StaffStructuralEvent;

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_LaCandeur.mxl"))
        .expect("Failed to import LaCandeur");

    let score = result.score;
    let instrument = &score.instruments[0];
    // Staff 2 = left hand
    let staff2 = &instrument.staves[1];

    let clef_events: Vec<_> = staff2
        .staff_structural_events
        .iter()
        .filter_map(|e| {
            if let StaffStructuralEvent::Clef(ce) = e {
                Some((ce.tick.value(), format!("{:?}", ce.clef)))
            } else {
                None
            }
        })
        .collect();

    println!("Staff 2 clef events: {:?}", clef_events);

    // Measure 21 starts at tick = 20 * 3840 = 76800
    // The clef change should be mid-measure at 76800 + 1920 = 78720
    // NOT at 76800 (measure start)
    assert!(
        clef_events.len() >= 2,
        "Should have at least 2 clef events (initial + mid-measure change)"
    );

    // Find the Bass clef event
    let bass_event = clef_events.iter().find(|(_, c)| c.contains("Bass"));
    assert!(bass_event.is_some(), "Should have a Bass clef event");
    let (bass_tick, _) = bass_event.unwrap();
    println!("Bass clef at tick: {}", bass_tick);

    // Should NOT be at measure start (76800) - should be mid-measure
    assert_ne!(
        *bass_tick, 76800,
        "Bass clef should not be at measure 21 start"
    );
}
