// Phase 2 tests for phrase detection (Feature 062)
// Constitution V: Tests written FIRST, must FAIL before implementation

use musicore_backend::domain::events::note::Note;
use musicore_backend::domain::events::rest::RestEvent;
use musicore_backend::domain::events::time_signature::TimeSignatureEvent;
use musicore_backend::domain::ids::RestEventId;
use musicore_backend::domain::instrument::Instrument;
use musicore_backend::domain::repeat::{
    RepeatBarline, RepeatBarlineType, VoltaBracket, VoltaEndType,
};
use musicore_backend::domain::score::Score;
use musicore_backend::domain::value_objects::{Pitch, Tick};
use musicore_backend::domain::voice::Voice;
use std::collections::BTreeSet;

// ============================================================================
// Helpers
// ============================================================================

/// 960 PPQ — ticks per quarter note
const PPQ: u32 = 960;

/// Create a simple score with N measures of 4/4 (each measure = 3840 ticks).
/// Returns a score with one instrument, one staff, one voice (empty).
fn make_score(num_measures: usize) -> Score {
    let mut score = Score::new();
    // Default already has 4/4 and 120 BPM at tick 0
    let ticks_per_measure = 4 * PPQ; // 3840
    score.measure_end_ticks = (1..=num_measures)
        .map(|m| m as u32 * ticks_per_measure)
        .collect();

    let instrument = Instrument::new("Piano".to_string());
    score.add_instrument(instrument);
    score
}

/// Create a note at the given tick with slur_next pointing to the given note ID.
fn make_note_at(start_tick: u32, duration: u32, pitch: u8) -> Note {
    Note::new(Tick::new(start_tick), duration, Pitch::new(pitch).unwrap()).unwrap()
}

// ============================================================================
// T019: Unit test for collect_hard_boundaries
// ============================================================================

#[test]
fn test_collect_hard_boundaries_repeat_barlines() {
    let mut score = make_score(8);
    // Add repeat barlines at measure 4 (end) and measure 4 (start)
    score.repeat_barlines.push(RepeatBarline {
        measure_index: 3,
        start_tick: 3 * 3840,
        end_tick: 4 * 3840,
        barline_type: RepeatBarlineType::End,
    });
    score.repeat_barlines.push(RepeatBarline {
        measure_index: 4,
        start_tick: 4 * 3840,
        end_tick: 5 * 3840,
        barline_type: RepeatBarlineType::Start,
    });

    let boundaries = musicore_backend::domain::phrases::collect_hard_boundaries(&score);
    // End-repeat at measure 3 → boundary at measure 4 (after the repeat)
    // Start-repeat at measure 4 → boundary at measure 4
    assert!(
        !boundaries.contains(&3),
        "End-repeat boundary should be AFTER the repeat measure, not at it"
    );
    assert!(
        boundaries.contains(&4),
        "Both end-repeat+1 and start-repeat should produce boundary at 4"
    );
}

#[test]
fn test_collect_hard_boundaries_volta_brackets() {
    let mut score = make_score(8);
    score.volta_brackets.push(VoltaBracket {
        number: 1,
        start_measure_index: 4,
        end_measure_index: 5,
        start_tick: 4 * 3840,
        end_tick: 6 * 3840,
        end_type: VoltaEndType::Stop,
    });

    let boundaries = musicore_backend::domain::phrases::collect_hard_boundaries(&score);
    assert!(
        boundaries.contains(&4),
        "Volta start_measure_index should be a boundary"
    );
    assert!(
        boundaries.contains(&6),
        "Volta end_measure_index+1 should be a boundary"
    );
}

#[test]
fn test_collect_hard_boundaries_time_signature_change() {
    use musicore_backend::domain::events::global::GlobalStructuralEvent;

    let mut score = make_score(8);
    // Add a time signature change at a non-zero tick (measure 4)
    let ts_event = TimeSignatureEvent::new(Tick::new(4 * 3840), 3, 4);
    score
        .global_structural_events
        .push(GlobalStructuralEvent::TimeSignature(ts_event));

    let boundaries = musicore_backend::domain::phrases::collect_hard_boundaries(&score);
    // The time sig at tick 4*3840 corresponds to measure index 4
    assert!(
        boundaries.contains(&4),
        "Time signature change should create a boundary at measure 4"
    );
}

#[test]
fn test_collect_hard_boundaries_key_signature_change() {
    use musicore_backend::domain::events::key_signature::KeySignatureEvent;
    use musicore_backend::domain::events::staff::StaffStructuralEvent;
    use musicore_backend::domain::value_objects::KeySignature;

    let mut score = make_score(8);
    // Add key sig change on staff at measure 2 (tick 2*3840)
    let ks_event = KeySignatureEvent::new(Tick::new(2 * 3840), KeySignature::new(2).unwrap());
    score.instruments[0].staves[0]
        .staff_structural_events
        .push(StaffStructuralEvent::KeySignature(ks_event));

    let boundaries = musicore_backend::domain::phrases::collect_hard_boundaries(&score);
    assert!(
        boundaries.contains(&2),
        "Key signature change should create a boundary at measure 2"
    );
}

#[test]
fn test_collect_hard_boundaries_initial_events_excluded() {
    // Time sig and key sig at tick 0 should NOT be boundaries
    let score = make_score(8);
    let boundaries = musicore_backend::domain::phrases::collect_hard_boundaries(&score);
    assert!(
        boundaries.is_empty(),
        "Initial time/key signatures at tick 0 should not be boundaries"
    );
}

// ============================================================================
// T020: Unit test for detect_slur_phrases
// ============================================================================

#[test]
fn test_detect_slur_phrases_single_slur_chain() {
    // Slur spanning measures 0-7 with group_size=8 → single phrase region
    let mut score = make_score(8);
    let instrument = &mut score.instruments[0];
    let voice = &mut instrument.staves[0].voices[0];

    // Create notes with a slur chain: note1 → note2
    let mut note1 = make_note_at(0, 4 * 3840, 60); // spans measures 0-3
    let note2 = make_note_at(4 * 3840, 4 * 3840, 62); // spans measures 4-7
    note1.slur_next = Some(note2.id.clone());
    voice.add_note(note1).unwrap();
    voice.add_note(note2).unwrap();

    let hard_boundaries = BTreeSet::new();
    let phrases = musicore_backend::domain::phrases::detect_slur_phrases(
        &score.instruments[0],
        &score.measure_end_ticks,
        &hard_boundaries,
        8, // group_size large enough to keep as one phrase
    );
    assert_eq!(
        phrases.len(),
        1,
        "Single slur chain with group_size=8 should produce 1 phrase"
    );
    assert_eq!(phrases[0].start_measure, 0);
    assert_eq!(phrases[0].end_measure, 7);
}

#[test]
fn test_detect_slur_phrases_long_slur_split_by_group_size() {
    // Slur spanning measures 0-7 with group_size=4 → splits into 2 phrases
    let mut score = make_score(8);
    let instrument = &mut score.instruments[0];
    let voice = &mut instrument.staves[0].voices[0];

    let mut note1 = make_note_at(0, 4 * 3840, 60);
    let note2 = make_note_at(4 * 3840, 4 * 3840, 62);
    note1.slur_next = Some(note2.id.clone());
    voice.add_note(note1).unwrap();
    voice.add_note(note2).unwrap();

    let hard_boundaries = BTreeSet::new();
    let phrases = musicore_backend::domain::phrases::detect_slur_phrases(
        &score.instruments[0],
        &score.measure_end_ticks,
        &hard_boundaries,
        4, // group_size=4 should split 8-measure slur
    );
    assert_eq!(
        phrases.len(),
        2,
        "8-measure slur with group_size=4 should produce 2 phrases"
    );
    assert_eq!(phrases[0].start_measure, 0);
    assert_eq!(phrases[0].end_measure, 3);
    assert_eq!(phrases[1].start_measure, 4);
    assert_eq!(phrases[1].end_measure, 7);
}

#[test]
fn test_detect_slur_phrases_split_at_hard_boundary() {
    // Slur spanning measures 0-7, with hard boundary at measure 4
    // Should produce 2 phrase regions: [0-3] and [4-7]
    let mut score = make_score(8);
    let instrument = &mut score.instruments[0];
    let voice = &mut instrument.staves[0].voices[0];

    let mut note1 = make_note_at(0, 4 * 3840, 60);
    let note2 = make_note_at(4 * 3840, 4 * 3840, 62);
    note1.slur_next = Some(note2.id.clone());
    voice.add_note(note1).unwrap();
    voice.add_note(note2).unwrap();

    let mut hard_boundaries = BTreeSet::new();
    hard_boundaries.insert(4usize);

    let phrases = musicore_backend::domain::phrases::detect_slur_phrases(
        &score.instruments[0],
        &score.measure_end_ticks,
        &hard_boundaries,
        4,
    );
    assert_eq!(phrases.len(), 2, "Slur should be split at hard boundary");
    assert_eq!(phrases[0].start_measure, 0);
    assert_eq!(phrases[0].end_measure, 3);
    assert_eq!(phrases[1].start_measure, 4);
    assert_eq!(phrases[1].end_measure, 7);
}

// ============================================================================
// T021: Unit test for detect_rest_boundaries
// ============================================================================

#[test]
fn test_detect_rest_boundaries_all_voices_rest() {
    let mut score = make_score(8);
    let instrument = &mut score.instruments[0];
    let staff = &mut instrument.staves[0];

    // Add a second voice
    staff.voices.push(Voice::new());

    // In voice 0: rest fills last part of measure 3
    staff.voices[0].rest_events.push(RestEvent {
        id: RestEventId::new(),
        start_tick: Tick::new(3 * 3840 + 2 * PPQ),
        duration_ticks: 2 * PPQ,
        note_type: Some("half".to_string()),
        voice: 1,
        staff: 1,
        is_measure_rest: false,
    });

    // In voice 1: rest fills last part of measure 3
    staff.voices[1].rest_events.push(RestEvent {
        id: RestEventId::new(),
        start_tick: Tick::new(3 * 3840 + 2 * PPQ),
        duration_ticks: 2 * PPQ,
        note_type: Some("half".to_string()),
        voice: 2,
        staff: 1,
        is_measure_rest: false,
    });

    let boundaries = musicore_backend::domain::phrases::detect_rest_boundaries(
        &score.instruments[0],
        &score.measure_end_ticks,
    );
    assert!(
        boundaries.contains(&3),
        "Measure 3 with rests across all voices should be a rest boundary"
    );
}

#[test]
fn test_detect_rest_boundaries_partial_voices_no_boundary() {
    let mut score = make_score(8);
    let instrument = &mut score.instruments[0];
    let staff = &mut instrument.staves[0];

    // Add a second voice
    staff.voices.push(Voice::new());

    // Only voice 0 has a rest at measure 3, voice 1 does not
    staff.voices[0].rest_events.push(RestEvent {
        id: RestEventId::new(),
        start_tick: Tick::new(3 * 3840 + 2 * PPQ),
        duration_ticks: 2 * PPQ,
        note_type: Some("half".to_string()),
        voice: 1,
        staff: 1,
        is_measure_rest: false,
    });

    // Voice 1 has a note at end of measure 3 (no rest)
    let note = make_note_at(3 * 3840 + 2 * PPQ, 2 * PPQ, 60);
    staff.voices[1].add_note(note).unwrap();

    let boundaries = musicore_backend::domain::phrases::detect_rest_boundaries(
        &score.instruments[0],
        &score.measure_end_ticks,
    );
    assert!(
        !boundaries.contains(&3),
        "Measure with rest in only some voices should not be a boundary"
    );
}

// ============================================================================
// T022: Unit test for apply_fallback_grouping
// ============================================================================

#[test]
fn test_fallback_grouping_4_4_time() {
    // 16 measures in 4/4 → four 4-measure phrases
    let groups = musicore_backend::domain::phrases::apply_fallback_grouping(0, 15, 4, 4);
    assert_eq!(groups.len(), 4);
    assert_eq!(groups[0], (0, 3));
    assert_eq!(groups[1], (4, 7));
    assert_eq!(groups[2], (8, 11));
    assert_eq!(groups[3], (12, 15));
}

#[test]
fn test_fallback_grouping_2_4_time() {
    // 16 measures in 2/4 → two 8-measure phrases
    let groups = musicore_backend::domain::phrases::apply_fallback_grouping(0, 15, 2, 4);
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0], (0, 7));
    assert_eq!(groups[1], (8, 15));
}

#[test]
fn test_fallback_grouping_remainder() {
    // 10 measures in 4/4 → two 4-measure phrases + one 2-measure phrase
    let groups = musicore_backend::domain::phrases::apply_fallback_grouping(0, 9, 4, 4);
    assert_eq!(groups.len(), 3);
    assert_eq!(groups[0], (0, 3));
    assert_eq!(groups[1], (4, 7));
    assert_eq!(groups[2], (8, 9));
}

#[test]
fn test_fallback_grouping_offset_start() {
    // Measures 4-11 (8 measures) in 4/4 → two 4-measure phrases
    let groups = musicore_backend::domain::phrases::apply_fallback_grouping(4, 11, 4, 4);
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0], (4, 7));
    assert_eq!(groups[1], (8, 11));
}

// ============================================================================
// T023: Unit test for detect_phrases end-to-end
// ============================================================================

#[test]
fn test_detect_phrases_mixed_signals() {
    // Score: 12 measures, 4/4 time
    // Slur chain in measures 0-3
    // Repeat barline at measure 4 (hard boundary)
    // Measures 4-7: no slurs → fallback grouping → single 4-measure phrase
    // Measures 8-11: no slurs → fallback grouping → single 4-measure phrase
    let mut score = make_score(12);

    // Add slur chain spanning measures 0-3
    {
        let voice = &mut score.instruments[0].staves[0].voices[0];
        let mut note1 = make_note_at(0, 4 * 3840, 60);
        let note2 = make_note_at(4 * 3840 - 960, 960, 62);
        note1.slur_next = Some(note2.id.clone());
        voice.add_note(note1).unwrap();
        voice.add_note(note2).unwrap();
    }

    // Add repeat barline at measure 4
    score.repeat_barlines.push(RepeatBarline {
        measure_index: 3,
        start_tick: 3 * 3840,
        end_tick: 4 * 3840,
        barline_type: RepeatBarlineType::End,
    });

    let phrases = musicore_backend::domain::phrases::detect_phrases(&score);

    // Expect phrases for instrument 0:
    // 1) Slur phrase: measures 0-3
    // 2) Fallback phrase: measures 4-7  (or 3-7 depending on boundary handling)
    // 3) Fallback phrase: measures 8-11
    assert!(
        phrases.len() >= 3,
        "Should have at least 3 phrases, got {}",
        phrases.len()
    );

    // All phrases should have instrument_index = 0
    for phrase in &phrases {
        assert_eq!(phrase.instrument_index, 0);
    }

    // Phrases should be sorted by start_measure
    for window in phrases.windows(2) {
        assert!(
            window[0].start_measure <= window[1].start_measure,
            "Phrases should be sorted by start_measure"
        );
    }

    // Verify tick values are populated
    for phrase in &phrases {
        assert!(
            phrase.start_tick < phrase.end_tick,
            "start_tick should be less than end_tick"
        );
    }
}

// ============================================================================
// T024: Unit test for pickup measure handling
// ============================================================================

#[test]
fn test_detect_phrases_pickup_measure_included_in_first_phrase() {
    // Score with pickup (anacrusis): measure 0 is shorter
    let mut score = make_score(8);
    score.pickup_ticks = PPQ; // 1 beat pickup

    // Adjust measure_end_ticks: measure 0 ends at PPQ, rest are 3840 apart
    score.measure_end_ticks[0] = PPQ;
    for i in 1..8 {
        score.measure_end_ticks[i] = PPQ + i as u32 * 3840;
    }

    let phrases = musicore_backend::domain::phrases::detect_phrases(&score);
    assert!(!phrases.is_empty(), "Should have phrases");
    assert_eq!(
        phrases[0].start_measure, 0,
        "First phrase should include pickup measure 0"
    );
}

// ============================================================================
// T025: Unit test for whole-score fallback
// ============================================================================

#[test]
fn test_detect_phrases_whole_score_fallback() {
    // Score with only 1 measure → single phrase spanning entire score
    let score = make_score(1);
    let phrases = musicore_backend::domain::phrases::detect_phrases(&score);
    assert_eq!(
        phrases.len(),
        1,
        "Single measure score should have 1 phrase"
    );
    assert_eq!(phrases[0].start_measure, 0);
    assert_eq!(phrases[0].end_measure, 0);
    assert_eq!(phrases[0].start_tick, 0);
    assert_eq!(phrases[0].end_tick, 3840);
}

#[test]
fn test_detect_phrases_no_signals_uses_fallback() {
    // 8 measures, no slurs, no repeats, no rests → fallback grouping (4-measure)
    let score = make_score(8);
    let phrases = musicore_backend::domain::phrases::detect_phrases(&score);
    assert_eq!(
        phrases.len(),
        2,
        "8 measures in 4/4 with no signals should produce 2 phrases"
    );
    assert_eq!(phrases[0].start_measure, 0);
    assert_eq!(phrases[0].end_measure, 3);
    assert_eq!(phrases[1].start_measure, 4);
    assert_eq!(phrases[1].end_measure, 7);
}

// ============================================================================
// T026: Integration test — parse real MusicXML fixture
// ============================================================================

#[test]
fn test_parse_arabesque_produces_phrases() {
    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::domain::phrases::detect_phrases;
    use musicore_backend::ports::importers::IMusicXMLImporter;
    use std::path::Path;

    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .expect("Failed to import Arabesque");

    let phrases = detect_phrases(&result.score);

    assert!(
        !phrases.is_empty(),
        "Arabesque should have detected phrases"
    );

    // All phrases should have valid measure indices
    let num_measures = result.score.measure_end_ticks.len();
    for phrase in &phrases {
        assert!(
            phrase.start_measure <= phrase.end_measure,
            "start_measure should be <= end_measure"
        );
        assert!(
            phrase.end_measure < num_measures,
            "end_measure {} should be < num_measures {}",
            phrase.end_measure,
            num_measures
        );
        assert!(
            phrase.start_tick < phrase.end_tick,
            "start_tick should be < end_tick"
        );
        assert!(
            phrase.instrument_index < result.score.instruments.len(),
            "instrument_index should be valid"
        );
    }

    // Phrases should cover measurespace without overlap for each instrument
    let inst0_phrases: Vec<_> = phrases.iter().filter(|p| p.instrument_index == 0).collect();
    for window in inst0_phrases.windows(2) {
        assert!(
            window[0].end_measure < window[1].start_measure,
            "Phrases should not overlap: {:?} and {:?}",
            window[0],
            window[1]
        );
    }
}

// ============================================================================
// T055: Validate all 7 preloaded scores produce reasonable phrases
// ============================================================================

#[test]
fn test_all_preloaded_scores_produce_phrases() {
    use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
    use musicore_backend::domain::phrases::detect_phrases;
    use musicore_backend::ports::importers::IMusicXMLImporter;
    use std::path::Path;

    let scores = [
        ("Burgmuller_Arabesque", "../scores/Burgmuller_Arabesque.mxl"),
        ("Burgmuller_LaCandeur", "../scores/Burgmuller_LaCandeur.mxl"),
        ("Beethoven_FurElise", "../scores/Beethoven_FurElise.mxl"),
        ("Bach_InventionNo1", "../scores/Bach_InventionNo1.mxl"),
        ("Pachelbel_CanonD", "../scores/Pachelbel_CanonD.mxl"),
        (
            "Chopin_NocturneOp9No2",
            "../scores/Chopin_NocturneOp9No2.mxl",
        ),
        ("clef", "../scores/clef.mxl"),
    ];

    let importer = MusicXMLImporter::new();

    for (name, path) in &scores {
        let result = importer
            .import_file(Path::new(path))
            .unwrap_or_else(|_| panic!("Failed to import {name}"));
        let phrases = detect_phrases(&result.score);
        let num_measures = result.score.measure_end_ticks.len();

        assert!(!phrases.is_empty(), "{name} should have detected phrases");

        // SC-004: Scores longer than 8 measures should have at least 2 phrases
        if num_measures > 8 {
            assert!(
                phrases.len() >= 2,
                "{name}: {num_measures} measures should produce at least 2 phrases, got {}",
                phrases.len()
            );
        }

        // Validate phrase integrity
        for phrase in &phrases {
            assert!(
                phrase.start_measure <= phrase.end_measure,
                "{name}: invalid measure range"
            );
            assert!(
                phrase.end_measure < num_measures,
                "{name}: end_measure out of bounds"
            );
            assert!(
                phrase.start_tick < phrase.end_tick,
                "{name}: invalid tick range"
            );
            assert!(
                phrase.instrument_index < result.score.instruments.len(),
                "{name}: invalid instrument_index"
            );
        }

        // No overlaps within same instrument
        let mut by_inst: std::collections::HashMap<usize, Vec<_>> =
            std::collections::HashMap::new();
        for phrase in &phrases {
            by_inst
                .entry(phrase.instrument_index)
                .or_default()
                .push(phrase);
        }
        for (inst, mut inst_phrases) in by_inst {
            inst_phrases.sort_by_key(|p| p.start_measure);
            for window in inst_phrases.windows(2) {
                assert!(
                    window[0].end_measure < window[1].start_measure,
                    "{name} inst {inst}: overlapping phrases {:?} and {:?}",
                    window[0],
                    window[1]
                );
            }
        }

        eprintln!(
            "{name}: {num_measures} measures, {} phrases ✓",
            phrases.len()
        );
    }
}
