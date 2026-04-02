/// Diagnostic: print whole-score difficulty for ALL preloaded scores
use musicore_backend::domain::difficulty::density::compute_difficulty;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

#[test]
fn diagnose_all_scores_difficulty() {
    let scores = [
        "Burgmuller_Arabesque",
        "Burgmuller_LaCandeur",
        "Beethoven_FurElise",
        "Bach_InventionNo1",
        "Pachelbel_CanonD",
        "Chopin_NocturneOp9No2",
    ];

    let importer = MusicXMLImporter::new();

    println!("\n=== Whole-score difficulty for preloaded scores ===");
    for name in &scores {
        let path = format!("../scores/{}.mxl", name);
        let result = importer
            .import_file(Path::new(&path))
            .unwrap_or_else(|_| panic!("Failed to import {name}"));

        if let Some(rating) = compute_difficulty(&result.score) {
            println!(
                "  {:<30} density_rate={:.3}  level={:?}",
                name, rating.density_rate, rating.level
            );
        } else {
            println!("  {:<30} None", name);
        }
    }
}
