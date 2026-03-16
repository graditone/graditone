// Integration tests for tied notes - Feature 051-tied-notes

use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLConverter, MusicXMLParser,
};
use std::path::Path;

/// T009: Parse tied_notes_basic.musicxml and verify tie chain links
#[test]
fn test_tied_notes_parsed() {
    let fixture_path = Path::new("../tests/fixtures/musicxml/tied_notes_basic.musicxml");
    let xml_content = CompressionHandler::load_content(fixture_path)
        .expect("Failed to load tied_notes_basic.musicxml");

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context)
        .expect("Failed to parse tied_notes_basic.musicxml");

    let score = MusicXMLConverter::convert(doc, &mut context)
        .expect("Failed to convert tied_notes_basic.musicxml");

    // Get the first instrument's first staff's first voice notes
    let instrument = &score.instruments[0];
    let staff = &instrument.staves[0];
    let voice = &staff.voices[0];
    let notes = &voice.interval_events;

    // Measure 1: C4 half (tie start) -> C4 quarter (tie stop) -> D4 quarter (no tie)
    // notes[0] = C4 half (tie start), notes[1] = C4 quarter (tie continuation)
    assert!(
        notes[0].tie_next.is_some(),
        "First note (C4 half, tie start) should have tie_next"
    );
    assert_eq!(
        notes[0].tie_next.as_ref().unwrap(),
        &notes[1].id,
        "tie_next should point to second note"
    );
    assert!(
        notes[1].is_tie_continuation,
        "Second note (C4 quarter, tie stop) should be tie continuation"
    );
    assert!(
        !notes[2].is_tie_continuation,
        "Third note (D4 quarter) should NOT be tie continuation"
    );

    // Measure 2: E4, F4, E4, G4 (tie start) -> Measure 3: G4 (tie stop)
    // notes[3] = E4, notes[4] = F4, notes[5] = E4, notes[6] = G4 (tie start)
    // notes[7] = G4 (tie stop, cross-barline)
    assert!(
        notes[6].tie_next.is_some(),
        "G4 quarter (tie start) should have tie_next"
    );
    assert_eq!(
        notes[6].tie_next.as_ref().unwrap(),
        &notes[7].id,
        "G4 tie_next should point to cross-barline G4"
    );
    assert!(
        notes[7].is_tie_continuation,
        "Cross-barline G4 should be tie continuation"
    );

    // Measure 3: G4 (stop), E4 (start) -> E4 (continue) -> E4 (stop) — three-note chain
    // notes[8] = E4 (start), notes[9] = E4 (continue), notes[10] = E4 (stop)
    assert!(
        notes[8].tie_next.is_some(),
        "E4 (chain start) should have tie_next"
    );
    assert_eq!(
        notes[8].tie_next.as_ref().unwrap(),
        &notes[9].id,
        "E4 chain start tie_next -> E4 chain middle"
    );
    assert!(
        notes[9].is_tie_continuation,
        "E4 chain middle should be tie continuation"
    );
    assert!(
        notes[9].tie_next.is_some(),
        "E4 (chain middle, continue) should have tie_next"
    );
    assert_eq!(
        notes[9].tie_next.as_ref().unwrap(),
        &notes[10].id,
        "E4 chain middle tie_next -> E4 chain end"
    );
    assert!(
        notes[10].is_tie_continuation,
        "E4 chain end should be tie continuation"
    );

    // Total notes: 12 (m1: 3, m2: 4, m3: 4, m4: 1)
    assert_eq!(notes.len(), 12, "Expected 12 notes total");
}

/// Parse tied_notes_chord.musicxml and verify partial chord ties
#[test]
fn test_tied_notes_chord_partial() {
    let fixture_path = Path::new("../tests/fixtures/musicxml/tied_notes_chord.musicxml");
    let xml_content = CompressionHandler::load_content(fixture_path)
        .expect("Failed to load tied_notes_chord.musicxml");

    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context)
        .expect("Failed to parse tied_notes_chord.musicxml");

    let score = MusicXMLConverter::convert(doc, &mut context)
        .expect("Failed to convert tied_notes_chord.musicxml");

    let instrument = &score.instruments[0];
    let staff = &instrument.staves[0];
    let voice = &staff.voices[0];
    let notes = &voice.interval_events;

    // Measure 1: C4 (no tie), E4 (tie start, chord), G4 (no tie, chord),
    //            C4 (no tie), E4 (tie stop, chord), G4 (no tie, chord)
    // Notes: [C4, E4_start, G4, C4, E4_stop, G4]

    // E4 (index 1) should be tie start
    assert!(
        notes[1].tie_next.is_some(),
        "E4 (chord tie start) should have tie_next"
    );
    // E4 stop (index 4) should be continuation
    assert!(
        notes[4].is_tie_continuation,
        "E4 (chord tie stop) should be tie continuation"
    );

    // C4 (index 0) and G4 (index 2) should NOT be tied
    assert!(notes[0].tie_next.is_none(), "C4 should not have tie_next");
    assert!(notes[2].tie_next.is_none(), "G4 should not have tie_next");
    assert!(
        !notes[3].is_tie_continuation,
        "Second C4 should not be tie continuation"
    );
    assert!(
        !notes[5].is_tie_continuation,
        "Second G4 should not be tie continuation"
    );
}
