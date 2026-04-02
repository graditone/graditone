use musicore_backend::domain::difficulty::DifficultyLevel;
use musicore_backend::domain::difficulty::density::compute_region_difficulty;
use musicore_backend::domain::events::note::Note;
use musicore_backend::domain::events::tempo::TempoEvent;
use musicore_backend::domain::events::time_signature::TimeSignatureEvent;
use musicore_backend::domain::instrument::Instrument;
use musicore_backend::domain::score::Score;
use musicore_backend::domain::staff::Staff;
use musicore_backend::domain::value_objects::{BPM, Pitch, Tick};

fn make_note(start_tick: u32, duration_ticks: u32, pitch: u8) -> Note {
    Note::new(
        Tick::new(start_tick),
        duration_ticks,
        Pitch::new(pitch).unwrap(),
    )
    .unwrap()
}

fn make_two_staff_score() -> Score {
    let mut score = Score::new();
    score.global_structural_events.clear();
    score
        .add_tempo_event(TempoEvent::new(Tick::new(0), BPM::new(120).unwrap()))
        .unwrap();
    score
        .add_time_signature_event(TimeSignatureEvent::new(Tick::new(0), 4, 4))
        .unwrap();
    // Two measures in 4/4.
    score.measure_end_ticks = vec![3840, 7680];

    let mut instrument = Instrument::new("Piano".to_string());
    instrument.add_staff(Staff::new());

    // RH (staff 0): denser passage in measure 1.
    for i in 0..8 {
        instrument.staves[0].voices[0]
            .add_note(make_note(i * 480, 480, 60 + (i % 4) as u8))
            .unwrap();
    }

    // LH (staff 1): sparser passage.
    instrument.staves[1].voices[0]
        .add_note(make_note(0, 960, 48))
        .unwrap();
    instrument.staves[1].voices[0]
        .add_note(make_note(960, 960, 50))
        .unwrap();

    score.add_instrument(instrument);
    score
}

#[test]
fn region_valid_range_returns_difficulty() {
    let score = make_two_staff_score();
    let result = compute_region_difficulty(&score, 0, 0, None);
    assert!(result.is_some());
    assert!(result.unwrap().density_rate > 0.0);
}

#[test]
fn region_staff_filtering_produces_valid_results() {
    let score = make_two_staff_score();

    let rh = compute_region_difficulty(&score, 0, 0, Some(0)).unwrap();
    let lh = compute_region_difficulty(&score, 0, 0, Some(1)).unwrap();
    let both = compute_region_difficulty(&score, 0, 0, None).unwrap();

    assert!(rh.density_rate >= lh.density_rate);
    // BH sums pitches across staves, so it must be strictly harder than either hand alone.
    assert!(
        both.density_rate > rh.density_rate,
        "BH ({:.3}) should be > RH ({:.3})",
        both.density_rate,
        rh.density_rate
    );
    assert!(
        both.density_rate > lh.density_rate,
        "BH ({:.3}) should be > LH ({:.3})",
        both.density_rate,
        lh.density_rate
    );
}

#[test]
fn region_invalid_range_returns_none() {
    let score = make_two_staff_score();
    assert!(compute_region_difficulty(&score, 1, 0, None).is_none());
}

#[test]
fn region_out_of_bounds_returns_none() {
    let score = make_two_staff_score();
    assert!(compute_region_difficulty(&score, 0, 9, None).is_none());
}

#[test]
fn region_empty_returns_none() {
    let mut score = make_two_staff_score();
    score.instruments[0].staves[0].voices[0]
        .interval_events
        .clear();
    score.instruments[0].staves[1].voices[0]
        .interval_events
        .clear();

    let result = compute_region_difficulty(&score, 0, 0, None);
    assert!(result.is_none());
}

#[test]
fn region_level_is_valid_enum() {
    let score = make_two_staff_score();
    let result = compute_region_difficulty(&score, 0, 0, None).unwrap();

    assert!(matches!(
        result.level,
        DifficultyLevel::Easy | DifficultyLevel::Medium | DifficultyLevel::Hard
    ));
}
