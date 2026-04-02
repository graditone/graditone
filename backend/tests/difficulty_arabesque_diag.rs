/// Diagnostic test: print density rates for Arabesque regions to understand difficulty classification
use musicore_backend::domain::difficulty::density::compute_region_difficulty;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

#[test]
fn diagnose_arabesque_difficulty_per_measure() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .expect("Failed to import Arabesque");

    let score = &result.score;
    let num_measures = score.measure_end_ticks.len();

    println!("\n=== Arabesque difficulty per region ===");
    println!("Thresholds: Easy < 2.5, Medium 2.5-3.5, Hard > 3.5");
    println!();

    // Per-measure difficulty for staff 0 (RH)
    println!("--- Staff 0 (RH) per-measure ---");
    for m in 0..num_measures {
        if let Some(rating) = compute_region_difficulty(score, m, m, Some(0)) {
            println!(
                "  m.{:>2}: density_rate={:.3}, level={:?}",
                m + 1,
                rating.density_rate,
                rating.level
            );
        } else {
            println!("  m.{:>2}: None (no notes?)", m + 1);
        }
    }

    // Per-measure difficulty for staff 1 (LH)
    println!("\n--- Staff 1 (LH) per-measure ---");
    for m in 0..num_measures {
        if let Some(rating) = compute_region_difficulty(score, m, m, Some(1)) {
            println!(
                "  m.{:>2}: density_rate={:.3}, level={:?}",
                m + 1,
                rating.density_rate,
                rating.level
            );
        } else {
            println!("  m.{:>2}: None (no notes?)", m + 1);
        }
    }

    // Per-measure difficulty for BH (staff_index = None = max across staves)
    println!("\n--- BH (max of staves) per-measure ---");
    for m in 0..num_measures {
        if let Some(rating) = compute_region_difficulty(score, m, m, None) {
            println!(
                "  m.{:>2}: density_rate={:.3}, level={:?}",
                m + 1,
                rating.density_rate,
                rating.level
            );
        } else {
            println!("  m.{:>2}: None (no notes?)", m + 1);
        }
    }

    // Region-level: what the goal engine would compute for each phrase
    println!("\n=== Region-level difficulty (what the goal engine sees) ===");
    let sample_regions = vec![
        (0, 1, "m.1-2"),
        (2, 9, "m.3-10"),
        (10, 10, "m.11"),
        (11, 18, "m.12-19"),
        (19, 25, "m.20-26"),
        (26, 26, "m.27"),
        (27, 32, "m.28-33"),
    ];

    for (start, end, label) in &sample_regions {
        println!("\n  Region {} (0-based: {}-{}):", label, start, end);
        for (staff_idx, staff_name) in [(Some(0_usize), "RH"), (Some(1), "LH"), (None, "BH")] {
            if let Some(rating) = compute_region_difficulty(score, *start, *end, staff_idx) {
                println!(
                    "    {}: density_rate={:.3}, level={:?}",
                    staff_name, rating.density_rate, rating.level
                );
            } else {
                println!("    {}: None", staff_name);
            }
        }
    }
}
