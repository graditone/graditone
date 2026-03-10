//! Regression test: verify rests appear in layout for Burgmuller Arabesque.
//! Covers the full pipeline: MusicXML import → DTO → layout engine.

use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

/// SMuFL rest codepoints (U+E4E3 whole through U+E4E9 64th)
const REST_CODEPOINTS: &[&str] = &[
    "\u{E4E3}", "\u{E4E4}", "\u{E4E5}", "\u{E4E6}", "\u{E4E7}", "\u{E4E8}", "\u{E4E9}",
];

#[test]
fn arabesque_rests_in_domain_layer() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .unwrap();
    let rest_count: usize = result
        .score
        .instruments
        .iter()
        .flat_map(|i| &i.staves)
        .flat_map(|s| &s.voices)
        .map(|v| v.rest_events.len())
        .sum();
    assert!(rest_count > 0, "Domain layer has ZERO rest_events");
}

#[test]
fn arabesque_rests_in_dto_json() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .unwrap();
    let dto: musicore_backend::adapters::dtos::ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let rest_count: usize = json["instruments"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|i| i["staves"].as_array().unwrap().iter())
        .flat_map(|s| s["voices"].as_array().unwrap().iter())
        .map(|v| v["rest_events"].as_array().map_or(0, |a| a.len()))
        .sum();
    assert!(rest_count > 0, "DTO JSON has ZERO rest_events");
}

#[test]
fn arabesque_rests_positioned_in_layout() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .unwrap();
    let dto: musicore_backend::adapters::dtos::ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &LayoutConfig::default());
    let layout_json = serde_json::to_value(&layout).unwrap();

    let mut rest_count = 0;
    let mut all_at_fallback = true;
    for system in layout_json["systems"].as_array().unwrap() {
        for sg in system["staff_groups"].as_array().unwrap() {
            for staff in sg["staves"].as_array().unwrap() {
                for run in staff["glyph_runs"].as_array().unwrap() {
                    for glyph in run["glyphs"].as_array().unwrap() {
                        let cp = glyph["codepoint"].as_str().unwrap_or("");
                        if REST_CODEPOINTS.contains(&cp) {
                            rest_count += 1;
                            let x = glyph["position"]["x"].as_f64().unwrap_or(0.0);
                            // Rests should not all be at the same fallback x position
                            if (x - 210.0).abs() > 1.0 {
                                all_at_fallback = false;
                            }
                        }
                    }
                }
            }
        }
    }
    assert!(rest_count > 0, "No rest glyphs in layout glyph_runs");
    assert!(
        !all_at_fallback,
        "All rest glyphs at fallback x=210 — note_positions not used"
    );
}
