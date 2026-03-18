/// Tests for actual measure boundary computation (shortened measures in endings)
///
/// Für Elise has a pickup bar (1 eighth = 480 ticks) and a first ending (m9)
/// that is shortened to 2/8 (960 ticks) instead of the normal 3/8 (1440 ticks).
/// The formula-based approach incorrectly assigns 1440 ticks to m9, causing
/// notes from m10 to be assigned to m9's tick range.
use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLConverter, MusicXMLParser,
};
use musicore_backend::layout::{LayoutConfig, compute_layout};
use std::path::Path;

fn load_fur_elise_score() -> (musicore_backend::domain::score::Score, ImportContext) {
    let fixture_path = Path::new("../scores/Beethoven_FurElise.mxl");
    let xml_content =
        CompressionHandler::load_content(fixture_path).expect("Failed to load Fur Elise");
    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context).expect("Failed to parse");
    let score = MusicXMLConverter::convert(doc, &mut context).expect("Failed to convert");
    (score, context)
}

#[test]
fn test_fur_elise_measure_end_ticks_populated() {
    let (score, _) = load_fur_elise_score();
    assert!(
        !score.measure_end_ticks.is_empty(),
        "measure_end_ticks should be populated for Für Elise"
    );
}

#[test]
fn test_fur_elise_pickup_measure_boundary() {
    let (score, _) = load_fur_elise_score();
    // Measure 0 (pickup): 1 eighth note = 480 ticks
    assert_eq!(score.pickup_ticks, 480);
    assert_eq!(
        score.measure_end_ticks[0], 480,
        "Pickup measure ends at 480"
    );
}

#[test]
fn test_fur_elise_m9_shortened_measure() {
    let (score, _) = load_fur_elise_score();
    // m9 is measure_index 8 (0-based). It's a first ending with only 2/8 content.
    // m8 (measure_index 7) ends at pickup + 7 * 1440 = 480 + 10080 = 10560
    let m8_end = score.measure_end_ticks[7];
    assert_eq!(m8_end, 10560, "m8 should end at tick 10560");

    // m9 (measure_index 8): actual content is 960 ticks (2/8), NOT 1440 (3/8)
    let m9_end = score.measure_end_ticks[8];
    assert_eq!(
        m9_end, 11520,
        "m9 (first ending) should end at 10560+960=11520, not 10560+1440=12000"
    );

    // The difference from formula-based: formula says 12000, actual is 11520
    let formula_m9_end = 480 + 8 * 1440; // = 12000
    assert_ne!(
        m9_end, formula_m9_end,
        "m9 end tick should differ from formula-based calculation"
    );
}

#[test]
fn test_fur_elise_m10_starts_after_shortened_m9() {
    let (score, _) = load_fur_elise_score();
    // m10 (measure_index 9) should start exactly where m9 ends
    let m9_end = score.measure_end_ticks[8];
    let m10_end = score.measure_end_ticks[9];
    assert_eq!(m9_end, 11520);
    // m10 is a full 3/8 measure (1440 ticks)
    assert_eq!(m10_end, 11520 + 1440, "m10 should be a full 3/8 measure");
}

#[test]
fn test_fur_elise_layout_m9_barline_position() {
    let (score, _) = load_fur_elise_score();
    let score_dto = ScoreDto::from(&score);
    let score_json = serde_json::to_value(&score_dto).expect("Failed to serialize");
    let config = LayoutConfig::default();
    let layout = compute_layout(&score_json, &config);

    // Find the system containing m9 (tick 10560)
    let system = layout
        .systems
        .iter()
        .find(|s| s.tick_range.start_tick <= 10560 && s.tick_range.end_tick > 10560)
        .expect("Should find system containing m9");

    // The system's tick range should use actual boundaries
    // m9 ends at 11520, not 12000
    assert!(
        system.tick_range.end_tick != 12000 || system.tick_range.start_tick > 10560,
        "System tick ranges should use actual boundaries, not formula-based"
    );
}

#[test]
fn test_fur_elise_repeat_barline_uses_actual_ticks() {
    let (score, _) = load_fur_elise_score();
    // Find the End repeat barline at m9 (measure_index 8)
    let end_repeat = score
        .repeat_barlines
        .iter()
        .find(|rb| rb.measure_index == 8)
        .expect("Should find repeat barline at m9");

    assert_eq!(
        end_repeat.end_tick, 11520,
        "Repeat barline at m9 should use actual end tick 11520, not formula 12000"
    );
}

#[test]
fn test_fur_elise_volta_bracket_uses_actual_ticks() {
    let (score, _) = load_fur_elise_score();
    // Find volta bracket #1 (first ending)
    let volta1 = score
        .volta_brackets
        .iter()
        .find(|vb| vb.number == 1)
        .expect("Should find volta bracket 1");

    assert_eq!(
        volta1.end_tick, 11520,
        "Volta bracket 1 end should use actual tick 11520"
    );
}
