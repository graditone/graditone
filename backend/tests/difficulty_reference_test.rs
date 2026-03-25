//! T019/T020: Reference score difficulty validation tests.
//! Parse each bundled MusicXML and assert the computed difficulty level.
//!
//! Combined formula: 0.6 * note_density + 0.4 * polyphony
//! Thresholds: < 2.5 Easy, 2.5–3.5 Medium, > 3.5 Hard
//! Note density uses notes-per-beat (tempo-independent), per-staff max.
//! See research.md "Reference Score Calibration" section for details.

use musicore_backend::domain::difficulty::DifficultyLevel;
use musicore_backend::domain::difficulty::density::compute_difficulty;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

fn compute_for_score(relative_path: &str) -> (f64, DifficultyLevel) {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new(relative_path))
        .expect("Failed to import score");
    let rating =
        compute_difficulty(&result.score).expect("Expected difficulty rating for non-empty score");
    (rating.density_rate, rating.level)
}

#[test]
fn reference_bach_invention_no1() {
    let (rate, level) = compute_for_score("../scores/Bach_InventionNo1.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Medium,
        "Bach Invention density_rate={:.4}",
        rate
    );
}

#[test]
fn reference_beethoven_fur_elise() {
    let (rate, level) = compute_for_score("../scores/Beethoven_FurElise.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Hard,
        "Fur Elise density_rate={:.4}",
        rate
    );
}

#[test]
fn reference_burgmuller_arabesque() {
    let (rate, level) = compute_for_score("../scores/Burgmuller_Arabesque.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Medium,
        "Arabesque density_rate={:.4}",
        rate
    );
}

#[test]
fn reference_burgmuller_la_candeur() {
    let (rate, level) = compute_for_score("../scores/Burgmuller_LaCandeur.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Easy,
        "La Candeur density_rate={:.4}",
        rate
    );
}

#[test]
fn reference_chopin_nocturne_op9_no2() {
    let (rate, level) = compute_for_score("../scores/Chopin_NocturneOp9No2.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Hard,
        "Nocturne density_rate={:.4}",
        rate
    );
}

#[test]
fn reference_pachelbel_canon_d() {
    let (rate, level) = compute_for_score("../scores/Pachelbel_CanonD.mxl");
    assert_eq!(
        level,
        DifficultyLevel::Easy,
        "Canon D density_rate={:.4}",
        rate
    );
}
