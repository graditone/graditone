use musicore_backend::domain::difficulty::density::compute_difficulty;
use musicore_backend::domain::difficulty::{DifficultyLevel, DifficultyRating};
use musicore_backend::domain::events::note::Note;
use musicore_backend::domain::events::tempo::TempoEvent;
use musicore_backend::domain::events::time_signature::TimeSignatureEvent;
use musicore_backend::domain::instrument::Instrument;
use musicore_backend::domain::score::Score;
use musicore_backend::domain::value_objects::{BPM, Pitch, Tick};

// ============================================================================
// T007: DifficultyLevel::from_density_rate boundary tests
// ============================================================================

#[test]
fn test_level_zero_density_is_easy() {
    assert_eq!(
        DifficultyLevel::from_density_rate(0.0),
        DifficultyLevel::Easy
    );
}

#[test]
fn test_level_easy_below_threshold() {
    assert_eq!(
        DifficultyLevel::from_density_rate(2.4),
        DifficultyLevel::Easy
    );
}

#[test]
fn test_level_medium_at_lower_bound() {
    assert_eq!(
        DifficultyLevel::from_density_rate(2.5),
        DifficultyLevel::Medium
    );
}

#[test]
fn test_level_medium_at_upper_bound() {
    assert_eq!(
        DifficultyLevel::from_density_rate(3.5),
        DifficultyLevel::Medium
    );
}

#[test]
fn test_level_hard_above_threshold() {
    assert_eq!(
        DifficultyLevel::from_density_rate(3.51),
        DifficultyLevel::Hard
    );
}

#[test]
fn test_level_hard_very_high_density() {
    assert_eq!(
        DifficultyLevel::from_density_rate(20.0),
        DifficultyLevel::Hard
    );
}

#[test]
fn test_level_easy_negative_density_treated_as_easy() {
    // Edge case: negative density should map to Easy
    assert_eq!(
        DifficultyLevel::from_density_rate(-1.0),
        DifficultyLevel::Easy
    );
}

// ============================================================================
// T009: Density computation tests
// ============================================================================

/// Helper: create a Score with a single instrument, one staff, one voice,
/// with the given notes in a single measure of 4/4 at the given BPM.
/// measure_end_ticks is set to [3840] for a single 4/4 bar.
fn make_single_bar_score(bpm: u16, notes: Vec<Note>) -> Score {
    let mut score = Score::new();
    // Replace default tempo with specified BPM
    score.global_structural_events.clear();
    score
        .add_tempo_event(TempoEvent::new(Tick::new(0), BPM::new(bpm).unwrap()))
        .unwrap();
    score
        .add_time_signature_event(TimeSignatureEvent::new(Tick::new(0), 4, 4))
        .unwrap();
    // Single measure: ends at tick 3840 (4/4 at 960 PPQ)
    score.measure_end_ticks = vec![3840];

    let mut instrument = Instrument::new("Piano".to_string());
    {
        let staff = &mut instrument.staves[0]; // default staff
        let voice = &mut staff.voices[0]; // default voice
        for note in notes {
            voice.add_note(note).unwrap();
        }
    }
    score.add_instrument(instrument);
    score
}

/// Helper: create a note at given tick with given duration
fn make_note(start_tick: u32, duration_ticks: u32) -> Note {
    Note::new(
        Tick::new(start_tick),
        duration_ticks,
        Pitch::new(60).unwrap(),
    )
    .unwrap()
}

#[test]
fn test_single_bar_single_note_120bpm() {
    // 1 note in a 4/4 bar → bar_duration = 4 beats
    // density = 1/4 = 0.25 notes/beat, polyphony = 1.0
    // combined = 0.6*0.25 + 0.4*1.0 = 0.55 → Easy
    let notes = vec![make_note(0, 960)];
    let score = make_single_bar_score(120, notes);
    let result = compute_difficulty(&score).unwrap();
    assert!((result.density_rate - 0.55).abs() < 0.001);
    assert_eq!(result.level, DifficultyLevel::Easy);
}

#[test]
fn test_chord_counts_each_pitch() {
    // 4 simultaneous notes (chord) in a 4/4 bar
    // density = 4/4 = 1.0 notes/beat, polyphony = 4.0 (all at same onset)
    // combined = 0.6*1.0 + 0.4*4.0 = 2.2 → Easy
    let notes = vec![
        Note::new(Tick::new(0), 960, Pitch::new(60).unwrap()).unwrap(),
        Note::new(Tick::new(0), 960, Pitch::new(64).unwrap()).unwrap(),
        Note::new(Tick::new(0), 960, Pitch::new(67).unwrap()).unwrap(),
        Note::new(Tick::new(0), 960, Pitch::new(72).unwrap()).unwrap(),
    ];
    let score = make_single_bar_score(120, notes);
    let result = compute_difficulty(&score).unwrap();
    assert!((result.density_rate - 2.2).abs() < 0.001);
    assert_eq!(result.level, DifficultyLevel::Easy);
}

#[test]
fn test_tie_continuation_excluded() {
    // 2 notes: first regular, second is a tie continuation
    // Only the first should count → 1 pitch
    // density = 1/4 = 0.25, polyphony = 1.0
    // combined = 0.6*0.25 + 0.4*1.0 = 0.55
    let note1 = make_note(0, 960);
    let note2 = make_note(960, 960).with_tie_continuation();
    let score = make_single_bar_score(120, vec![note1, note2]);
    let result = compute_difficulty(&score).unwrap();
    assert!((result.density_rate - 0.55).abs() < 0.001);
}

#[test]
fn test_grace_notes_excluded() {
    // 2 notes: first regular, second is grace (different pitch to avoid overlap)
    // Only the first should count → 1 pitch
    // density = 1/4 = 0.25, polyphony = 1.0
    // combined = 0.6*0.25 + 0.4*1.0 = 0.55
    let note1 = make_note(0, 960);
    let mut note2 = Note::new(Tick::new(480), 240, Pitch::new(72).unwrap()).unwrap();
    note2.is_grace = true;
    let score = make_single_bar_score(120, vec![note1, note2]);
    let result = compute_difficulty(&score).unwrap();
    assert!((result.density_rate - 0.55).abs() < 0.001);
}

#[test]
fn test_multi_bar_formula_avg_and_peak() {
    // Two bars at 120 BPM (4/4): bar_duration = 2.0s each
    // Bar 0: 2 notes → density = 1.0
    // Bar 1: 8 notes → density = 4.0
    // avg = (1.0 + 4.0) / 2 = 2.5
    // peak = 4.0
    // density_rate = 0.7 * 2.5 + 0.3 * 4.0 = 1.75 + 1.2 = 2.95
    let mut score = Score::new();
    score.global_structural_events.clear();
    score
        .add_tempo_event(TempoEvent::new(Tick::new(0), BPM::new(120).unwrap()))
        .unwrap();
    score
        .add_time_signature_event(TimeSignatureEvent::new(Tick::new(0), 4, 4))
        .unwrap();
    score.measure_end_ticks = vec![3840, 7680];

    let mut instrument = Instrument::new("Piano".to_string());
    {
        let voice = &mut instrument.staves[0].voices[0];
        // Bar 0 (tick 0–3840): 2 notes
        voice.add_note(make_note(0, 480)).unwrap();
        voice.add_note(make_note(480, 480)).unwrap();
        // Bar 1 (tick 3840–7680): 8 notes
        for i in 0..8 {
            voice.add_note(make_note(3840 + i * 480, 480)).unwrap();
        }
    }
    score.add_instrument(instrument);

    let result = compute_difficulty(&score).unwrap();
    // Bar 0: density=0.5, poly=1.0; Bar 1: density=2.0, poly=1.0
    // note_density = 0.7*1.25 + 0.3*2.0 = 1.475
    // polyphony = 1.0, combined = 0.6*1.475 + 0.4*1.0 = 1.285
    assert!((result.density_rate - 1.285).abs() < 0.01);
    assert_eq!(result.level, DifficultyLevel::Easy);
}

#[test]
fn test_multi_instrument_picks_max() {
    // Instrument 1: 1 note → low density
    // Instrument 2: 10 notes → high density
    // Score should pick the max
    let mut score = Score::new();
    score.global_structural_events.clear();
    score
        .add_tempo_event(TempoEvent::new(Tick::new(0), BPM::new(120).unwrap()))
        .unwrap();
    score
        .add_time_signature_event(TimeSignatureEvent::new(Tick::new(0), 4, 4))
        .unwrap();
    score.measure_end_ticks = vec![3840];

    // Instrument 1: 1 note
    let mut inst1 = Instrument::new("Easy".to_string());
    inst1.staves[0].voices[0]
        .add_note(make_note(0, 960))
        .unwrap();
    score.add_instrument(inst1);

    // Instrument 2: 10 notes (density = 10/2.0 = 5.0 → Hard)
    let mut inst2 = Instrument::new("Hard".to_string());
    for i in 0..10 {
        // Use different pitches to avoid overlapping notes in same voice
        let pitch = Pitch::new(60 + (i % 12) as u8).unwrap();
        inst2.staves[0].voices[0]
            .add_note(Note::new(Tick::new(i * 384), 384, pitch).unwrap())
            .unwrap();
    }
    score.add_instrument(inst2);

    let result = compute_difficulty(&score).unwrap();
    // inst2: density=2.5, poly=1.0, combined = 0.6*2.5 + 0.4*1.0 = 1.9
    // inst1: combined = 0.55. Max = 1.9 → Easy
    assert!((result.density_rate - 1.9).abs() < 0.01);
    assert_eq!(result.level, DifficultyLevel::Easy);
}

#[test]
fn test_empty_score_returns_none() {
    let score = Score::new();
    // No instruments, no measure_end_ticks
    assert!(compute_difficulty(&score).is_none());
}

#[test]
fn test_no_measures_returns_none() {
    let mut score = Score::new();
    score.add_instrument(Instrument::new("Piano".to_string()));
    // measure_end_ticks is empty
    assert!(compute_difficulty(&score).is_none());
}

#[test]
fn test_all_rests_returns_none() {
    // A bar with no notes at all → no difficulty rating (None)
    let mut score = Score::new();
    score.global_structural_events.clear();
    score
        .add_tempo_event(TempoEvent::new(Tick::new(0), BPM::new(120).unwrap()))
        .unwrap();
    score
        .add_time_signature_event(TimeSignatureEvent::new(Tick::new(0), 4, 4))
        .unwrap();
    score.measure_end_ticks = vec![3840];
    score.add_instrument(Instrument::new("Piano".to_string()));

    assert!(compute_difficulty(&score).is_none());
}

#[test]
fn test_default_120bpm_fallback() {
    // Score::new() adds 120 BPM by default at tick 0
    // 2 notes in 4 beats → density = 0.5, polyphony = 1.0
    // combined = 0.6*0.5 + 0.4*1.0 = 0.7 → Easy
    let notes = vec![make_note(0, 960), make_note(960, 960)];
    let score = make_single_bar_score(120, notes);
    let result = compute_difficulty(&score).unwrap();
    assert!((result.density_rate - 0.7).abs() < 0.001);
    assert_eq!(result.level, DifficultyLevel::Easy);
}
