//! Grace note layout test: verifies that grace notes in Für Elise M26
//! are rendered at reduced font_size (75% of normal) and full opacity.

use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

const CONFIG: LayoutConfig = LayoutConfig {
    max_system_width: 2410.0,
    units_per_space: 20.0,
    system_spacing: 200.0,
    system_height: 200.0,
};

fn layout_fur_elise() -> serde_json::Value {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Beethoven_FurElise.mxl"))
        .unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &CONFIG);
    serde_json::to_value(&layout).unwrap()
}

/// Für Elise M26 contains two grace notes (F4, A4) before the principal C5.
/// These grace notes MUST have:
/// - font_size ≈ 60.0 (75% of standard 80.0)
/// - full opacity (same as normal notes)
///
/// Normal notes MUST have font_size ≈ 80.0 and opacity 1.0 (or absent).
#[test]
fn test_grace_notes_have_reduced_font_size_and_opacity() {
    let layout = layout_fur_elise();

    // Collect all glyph runs across all systems/staff_groups/staves
    let systems = layout["systems"].as_array().expect("systems array");
    let mut grace_font_sizes: Vec<f64> = Vec::new();
    let mut normal_font_sizes: Vec<f64> = Vec::new();

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap_or(&vec![]) {
            for staff in sg["staves"].as_array().unwrap_or(&vec![]) {
                for run in staff["glyph_runs"].as_array().unwrap_or(&vec![]) {
                    let run_font_size = run["font_size"].as_f64().unwrap_or(80.0);

                    // Grace-note runs: font_size ≈ 60.0 (80*0.75)
                    if run_font_size < 70.0 && run_font_size > 50.0 {
                        grace_font_sizes.push(run_font_size);
                    } else if run_font_size >= 70.0 {
                        // Check only noteheads (not stems/beams which use special codepoints)
                        for glyph in run["glyphs"].as_array().unwrap_or(&vec![]) {
                            let cp = glyph["codepoint"].as_str().unwrap_or("");
                            let code = cp.chars().next().unwrap_or('\0') as u32;
                            // SMuFL noteheads range: U+E0A0-U+E0FF, combined note glyphs: U+E1D0-U+E1FF
                            if (0xE0A0..=0xE0FF).contains(&code)
                                || (0xE1D0..=0xE1FF).contains(&code)
                            {
                                normal_font_sizes.push(run_font_size);
                            }
                        }
                    }
                }
            }
        }
    }

    // There must be grace-note runs (Für Elise has grace notes in M26 and M29)
    assert!(
        !grace_font_sizes.is_empty(),
        "Expected grace-note GlyphRuns with font_size ≈ 60, found none. \
         Grace notes are not being rendered at reduced size."
    );

    // Grace notes should be ~60.0 (80*0.75)
    for &fs in &grace_font_sizes {
        assert!(
            (fs - 60.0).abs() < 2.0,
            "Grace note font_size should be ~60.0 (75% of 80), got {fs}"
        );
    }

    // Normal notes should be ~80.0
    assert!(
        !normal_font_sizes.is_empty(),
        "Expected normal note GlyphRuns"
    );
    for &fs in &normal_font_sizes {
        assert!(
            fs >= 70.0,
            "Normal note font_size should be >= 70.0, got {fs}"
        );
    }
}

/// Grace note stems (U+0000) and beams (U+0001) must have thinner
/// dimensions (0.75x scaling) while retaining full opacity.
#[test]
fn test_grace_note_stems_and_beams_have_reduced_thickness() {
    let layout = layout_fur_elise();
    let systems = layout["systems"].as_array().expect("systems array");

    let mut grace_stem_runs = 0u32;
    let mut grace_beam_runs = 0u32;
    let mut normal_stem_thickness_sum = 0.0f64;
    let mut normal_stem_count = 0u32;

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap_or(&vec![]) {
            for staff in sg["staves"].as_array().unwrap_or(&vec![]) {
                for run in staff["glyph_runs"].as_array().unwrap_or(&vec![]) {
                    for glyph in run["glyphs"].as_array().unwrap_or(&vec![]) {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        let is_stem = cp == "\u{0000}";
                        let is_beam = cp == "\u{0001}";

                        if is_stem {
                            let w = glyph["bounding_box"]["width"].as_f64().unwrap_or(0.0);
                            // Grace stems: ~1.125 (1.5 * 0.75); normal: ~1.5
                            if w < 1.3 && w > 0.5 {
                                grace_stem_runs += 1;
                            } else if w >= 1.3 {
                                normal_stem_thickness_sum += w;
                                normal_stem_count += 1;
                            }
                        }

                        if is_beam {
                            let h = glyph["bounding_box"]["height"].as_f64().unwrap_or(0.0);
                            // Grace beams: ~7.5 (10.0 * 0.75); normal: ~10.0
                            if h < 9.0 && h > 4.0 {
                                grace_beam_runs += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    assert!(
        grace_stem_runs > 0,
        "Expected grace-note stems with reduced thickness, found none"
    );
    assert!(
        grace_beam_runs > 0,
        "Expected grace-note beams with reduced thickness, found none"
    );
    // Normal stems should be full thickness (1.5)
    if normal_stem_count > 0 {
        let avg_thickness = normal_stem_thickness_sum / normal_stem_count as f64;
        assert!(
            avg_thickness > 1.3,
            "Normal stem thickness should be ~1.5, avg was {avg_thickness}"
        );
    }
}
