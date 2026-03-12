// Integration tests for Volta Brackets - Feature 047-repeat-volta-playback
//
// Tests MusicXML <ending> element parsing and VoltaBracket construction.
// Fixture scores: La Candeur, Arabesque, Bach Invention No.1 (all in ../scores/).

use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::domain::repeat::VoltaEndType;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

/// La Candeur has exactly 1 volta bracket: first ending at measure 16 (index 15)
#[test]
fn test_lacandeur_volta_bracket_count() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_LaCandeur.mxl"))
        .expect("Failed to import La Candeur");

    assert_eq!(
        result.score.volta_brackets.len(),
        1,
        "La Candeur should have exactly 1 volta bracket, got: {:?}",
        result.score.volta_brackets
    );
}

#[test]
fn test_lacandeur_volta_bracket_values() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_LaCandeur.mxl"))
        .expect("Failed to import La Candeur");

    let vb = &result.score.volta_brackets[0];
    assert_eq!(vb.number, 1);
    assert_eq!(vb.start_measure_index, 15);
    assert_eq!(vb.end_measure_index, 15);
    // 4/4 time, 960 PPQ → 3840 ticks/measure, no pickup
    assert_eq!(vb.start_tick, 57600); // 15 * 3840
    assert_eq!(vb.end_tick, 61440); // 16 * 3840
    assert_eq!(vb.end_type, VoltaEndType::Stop);
}

/// Arabesque has 4 volta brackets across 2 repeat sections:
/// Section 1: ending 1 at m10 (idx 9), ending 2 at m11 (idx 10)
/// Section 2: ending 1 at m27 (idx 26), ending 2 at m28 (idx 27, discontinue)
#[test]
fn test_arabesque_volta_bracket_count() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .expect("Failed to import Arabesque");

    assert_eq!(
        result.score.volta_brackets.len(),
        4,
        "Arabesque should have 4 volta brackets, got: {:?}",
        result.score.volta_brackets
    );
}

#[test]
fn test_arabesque_volta_bracket_values() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .expect("Failed to import Arabesque");

    let brackets = &result.score.volta_brackets;

    // Section 1, first ending (m10, idx 9)
    assert_eq!(brackets[0].number, 1);
    assert_eq!(brackets[0].start_measure_index, 9);
    assert_eq!(brackets[0].end_measure_index, 9);
    assert_eq!(brackets[0].end_type, VoltaEndType::Stop);

    // Section 1, second ending (m11, idx 10)
    assert_eq!(brackets[1].number, 2);
    assert_eq!(brackets[1].start_measure_index, 10);
    assert_eq!(brackets[1].end_measure_index, 10);
    assert_eq!(brackets[1].end_type, VoltaEndType::Stop);

    // Section 2, first ending (m27, idx 26)
    assert_eq!(brackets[2].number, 1);
    assert_eq!(brackets[2].start_measure_index, 26);
    assert_eq!(brackets[2].end_measure_index, 26);
    assert_eq!(brackets[2].end_type, VoltaEndType::Stop);

    // Section 2, second ending (m28, idx 27) — discontinue (open right)
    assert_eq!(brackets[3].number, 2);
    assert_eq!(brackets[3].start_measure_index, 27);
    assert_eq!(brackets[3].end_measure_index, 27);
    assert_eq!(brackets[3].end_type, VoltaEndType::Discontinue);
}

/// A score with no <ending> elements should produce an empty volta_brackets vec
#[test]
fn test_no_endings_produces_empty_volta_brackets() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Bach_InventionNo1.mxl"))
        .expect("Failed to import Bach Invention No.1");

    assert!(
        result.score.volta_brackets.is_empty(),
        "Bach Invention No.1 has no endings, volta_brackets should be empty, got: {:?}",
        result.score.volta_brackets
    );
}
