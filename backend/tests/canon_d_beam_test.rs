//! Regression test: system bounding boxes must contain all stems and beams.
//! Beams and stems can extend well beyond the staff area (up to 70+ units).
//! If the system bounding box doesn't include them, the frontend's viewport
//! virtualization (getVisibleSystems) may clip them at scroll boundary positions.

use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

fn layout_canon_d() -> serde_json::Value {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Pachelbel_CanonD.mxl"))
        .unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let config = LayoutConfig {
        max_system_width: 2410.0,
        units_per_space: 20.0,
        system_spacing: 200.0,
        system_height: 200.0,
    };
    let layout = compute_layout(&json, &config);
    serde_json::to_value(&layout).unwrap()
}

/// All beam glyphs must have positive width and fall within their system's bounding box.
#[test]
fn all_beams_inside_system_bounding_box() {
    let layout_json = layout_canon_d();
    let systems = layout_json["systems"].as_array().unwrap();

    let mut outside = Vec::new();

    for (sys_idx, system) in systems.iter().enumerate() {
        let sys_bb_y = system["bounding_box"]["y"].as_f64().unwrap();
        let sys_bb_h = system["bounding_box"]["height"].as_f64().unwrap();
        let sys_y_end = sys_bb_y + sys_bb_h;

        for sg in system["staff_groups"].as_array().unwrap() {
            for (staff_idx, staff) in sg["staves"].as_array().unwrap().iter().enumerate() {
                for run in staff["glyph_runs"].as_array().unwrap() {
                    for glyph in run["glyphs"].as_array().unwrap() {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        // U+0000 = stem, U+0001 = beam
                        if cp == "\u{0000}" || cp == "\u{0001}" {
                            let pos_y = glyph["position"]["y"].as_f64().unwrap();
                            let bb_y = glyph["bounding_box"]["y"].as_f64().unwrap();
                            let bb_h = glyph["bounding_box"]["height"].as_f64().unwrap();
                            let glyph_min_y = pos_y.min(bb_y);
                            let glyph_max_y = (pos_y + bb_h).max(bb_y + bb_h);

                            if glyph_min_y < sys_bb_y - 0.1 || glyph_max_y > sys_y_end + 0.1 {
                                outside.push(format!(
                                    "Sys {} Staff {}: glyph y={:.1}-{:.1}, bbox y={:.1}-{:.1}",
                                    sys_idx, staff_idx, glyph_min_y, glyph_max_y, sys_bb_y, sys_y_end
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    assert!(
        outside.is_empty(),
        "Stems/beams outside system bounding box:\n{}",
        outside.join("\n")
    );
}

/// All beam glyphs must have positive width (no zero-width or negative-width beams).
#[test]
fn all_beams_have_positive_width() {
    let layout_json = layout_canon_d();
    let systems = layout_json["systems"].as_array().unwrap();

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap() {
            for staff in sg["staves"].as_array().unwrap() {
                for run in staff["glyph_runs"].as_array().unwrap() {
                    for glyph in run["glyphs"].as_array().unwrap() {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        if cp == "\u{0001}" {
                            let w = glyph["bounding_box"]["width"].as_f64().unwrap();
                            assert!(w > 10.0, "Beam width {} is too small", w);
                        }
                    }
                }
            }
        }
    }
}
