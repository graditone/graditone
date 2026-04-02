use musicore_backend::domain::difficulty::density::compute_region_difficulty;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

#[test]
fn diagnose_lacandeur_difficulty() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_LaCandeur.mxl"))
        .expect("Failed to import La Candeur");

    let score = &result.score;
    let num_measures = score.measure_end_ticks.len();
    println!("\n=== La Candeur: {} measures ===", num_measures);

    // Regions matching goal engine phrases (4-measure groups)
    let mut start = 0;
    while start < num_measures {
        let end = std::cmp::min(start + 3, num_measures - 1);
        println!(
            "\n  Region m.{}-{} (0-based: {}-{}):",
            start + 1,
            end + 1,
            start,
            end
        );
        for (staff_idx, name) in [(Some(0_usize), "RH"), (Some(1), "LH"), (None, "BH")] {
            if let Some(r) = compute_region_difficulty(score, start, end, staff_idx) {
                println!(
                    "    {}: density_rate={:.3}, level={:?}",
                    name, r.density_rate, r.level
                );
            } else {
                println!("    {}: None", name);
            }
        }
        start = end + 1;
    }
}
