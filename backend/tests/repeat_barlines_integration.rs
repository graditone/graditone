// Integration tests for Repeat Barlines - Feature 041-repeat-barlines

use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::domain::repeat::RepeatBarlineType;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

/// SC-003: Import La Candeur and assert 3 repeat barlines at the correct positions
///
/// Burgmuller Op.100 No.1 has:
/// - Measure 8 (index 7): end-repeat barline (location="right", direction="backward")
/// - Measure 9 (index 8): start-repeat barline (location="left", direction="forward")
/// - Measure 16 (index 15): end-repeat barline (location="left", direction="backward")
///
/// Tick values assume 4/4 time at 960 PPQ → 3840 ticks/measure.
#[test]
fn test_lacandeur_repeat_barlines_count() {
    let fixture_path = Path::new("../scores/Burgmuller_LaCandeur.mxl");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import Burgmuller_LaCandeur.mxl");

    let score = result.score;

    assert_eq!(
        score.repeat_barlines.len(),
        3,
        "La Candeur should have exactly 3 repeat barlines, got: {:?}",
        score.repeat_barlines
    );
}

#[test]
fn test_lacandeur_repeat_barline_positions() {
    let fixture_path = Path::new("../scores/Burgmuller_LaCandeur.mxl");

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(fixture_path)
        .expect("Failed to import Burgmuller_LaCandeur.mxl");

    let score = result.score;

    // Sort by measure_index for deterministic assertion order
    let mut barlines = score.repeat_barlines.clone();
    barlines.sort_by_key(|rb| rb.measure_index);

    assert_eq!(barlines.len(), 3, "Expected 3 repeat barlines");

    // Measure 8 (0-based index 7): end-repeat
    let end_a = &barlines[0];
    assert_eq!(
        end_a.measure_index, 7,
        "First repeat barline should be at measure index 7"
    );
    assert_eq!(
        end_a.start_tick, 26880,
        "Measure 7 start_tick should be 7 * 3840 = 26880"
    );
    assert_eq!(
        end_a.end_tick, 30720,
        "Measure 7 end_tick should be 8 * 3840 = 30720"
    );
    assert_eq!(
        end_a.barline_type,
        RepeatBarlineType::End,
        "Measure 7 barline should be End type"
    );

    // Measure 9 (0-based index 8): start-repeat
    let start_b = &barlines[1];
    assert_eq!(
        start_b.measure_index, 8,
        "Second repeat barline should be at measure index 8"
    );
    assert_eq!(
        start_b.start_tick, 30720,
        "Measure 8 start_tick should be 8 * 3840 = 30720"
    );
    assert_eq!(
        start_b.end_tick, 34560,
        "Measure 8 end_tick should be 9 * 3840 = 34560"
    );
    assert_eq!(
        start_b.barline_type,
        RepeatBarlineType::Start,
        "Measure 8 barline should be Start type"
    );

    // Measure 16 (0-based index 15): end-repeat
    let end_b = &barlines[2];
    assert_eq!(
        end_b.measure_index, 15,
        "Third repeat barline should be at measure index 15"
    );
    assert_eq!(
        end_b.start_tick, 57600,
        "Measure 15 start_tick should be 15 * 3840 = 57600"
    );
    assert_eq!(
        end_b.end_tick, 61440,
        "Measure 15 end_tick should be 16 * 3840 = 61440"
    );
    assert_eq!(
        end_b.barline_type,
        RepeatBarlineType::End,
        "Measure 15 barline should be End type"
    );
}
