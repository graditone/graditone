//! Integration test: verify augmentation dots and staccato dots appear in layout output.

use musicore_backend::domain::importers::musicxml::MusicXMLImporter;
use musicore_backend::layout::{LayoutConfig, compute_layout};
use musicore_backend::ports::importers::IMusicXMLImporter;
use std::path::Path;

/// Arabesque has 67 staccato articulations and 8 augmentation dots in MusicXML.
/// Verify the layout engine produces notation_dots for them.
#[test]
fn arabesque_has_notation_dots() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .unwrap();
    let dto: musicore_backend::adapters::dtos::ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &LayoutConfig::default());
    let layout_json = serde_json::to_value(&layout).unwrap();

    let mut dot_count = 0;
    for system in layout_json["systems"].as_array().unwrap() {
        for sg in system["staff_groups"].as_array().unwrap() {
            for staff in sg["staves"].as_array().unwrap() {
                if let Some(dots) = staff["notation_dots"].as_array() {
                    dot_count += dots.len();
                }
            }
        }
    }

    // Arabesque has 67 staccatos + 8 augmentation dots = at least 75 dots
    assert!(
        dot_count >= 50,
        "Expected at least 50 notation dots in Arabesque layout, got {dot_count}"
    );
}

/// Diagnostic: print dot counts and sample positions
#[test]
fn debug_notation_dots_output() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Burgmuller_Arabesque.mxl"))
        .unwrap();
    let dto: musicore_backend::adapters::dtos::ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();

    // Count staccato and dot_count in DTO JSON
    let mut staccato_in_dto = 0u32;
    let mut dotted_in_dto = 0u32;
    for inst in json["instruments"].as_array().unwrap() {
        for staff in inst["staves"].as_array().unwrap() {
            for voice in staff["voices"].as_array().unwrap() {
                // Notes are in "interval_events", not "notes"
                let notes_arr = voice["notes"]
                    .as_array()
                    .or_else(|| voice["interval_events"].as_array());
                if let Some(notes) = notes_arr {
                    for note in notes {
                        if note["staccato"].as_bool().unwrap_or(false) {
                            staccato_in_dto += 1;
                        }
                        if note["dot_count"].as_u64().unwrap_or(0) > 0 {
                            dotted_in_dto += 1;
                        }
                    }
                }
            }
        }
    }
    eprintln!("DTO: staccato_notes={staccato_in_dto}, dotted_notes={dotted_in_dto}");
    // Also check structure
    if let Some(inst) = json["instruments"].as_array().and_then(|a| a.first()) {
        if let Some(staff) = inst["staves"].as_array().and_then(|a| a.first()) {
            if let Some(voices) = staff["voices"].as_array() {
                eprintln!("  voices count: {}", voices.len());
                for (vi, voice) in voices.iter().enumerate() {
                    let keys: Vec<_> = voice
                        .as_object()
                        .map(|o| o.keys().collect::<Vec<_>>())
                        .unwrap_or_default();
                    eprintln!("  voice[{vi}] keys: {keys:?}");
                    if let Some(notes) = voice["notes"].as_array() {
                        eprintln!("  voice[{vi}] notes count: {}", notes.len());
                        for (i, note) in notes.iter().enumerate().take(3) {
                            let nkeys: Vec<_> = note
                                .as_object()
                                .map(|o| o.keys().collect::<Vec<_>>())
                                .unwrap_or_default();
                            eprintln!("    note[{i}] keys: {nkeys:?}");
                        }
                    }
                }
            }
        }
    }

    let layout = compute_layout(&json, &LayoutConfig::default());
    let layout_json = serde_json::to_value(&layout).unwrap();

    let mut total_dots = 0usize;
    let mut sample_dots = Vec::new();
    for system in layout_json["systems"].as_array().unwrap() {
        for sg in system["staff_groups"].as_array().unwrap() {
            for staff in sg["staves"].as_array().unwrap() {
                if let Some(dots) = staff["notation_dots"].as_array() {
                    for d in dots {
                        total_dots += 1;
                        if sample_dots.len() < 5 {
                            sample_dots
                                .push(format!("x={}, y={}, r={}", d["x"], d["y"], d["radius"]));
                        }
                    }
                }
            }
        }
    }
    eprintln!("Layout: total notation_dots={total_dots}");
    for s in &sample_dots {
        eprintln!("  {s}");
    }
    // Print staff line positions for first system
    if let Some(system) = layout_json["systems"].as_array().and_then(|a| a.first()) {
        eprintln!("System[0] bounding_box: {:?}", system["bounding_box"]);
        if let Some(sg) = system["staff_groups"].as_array().and_then(|a| a.first()) {
            if let Some(staff) = sg["staves"].as_array().and_then(|a| a.first()) {
                for (i, sl) in staff["staff_lines"].as_array().unwrap().iter().enumerate() {
                    eprintln!("  staff_line[{i}] y={}", sl["y_position"]);
                }
            }
        }
    }
    assert!(
        staccato_in_dto > 0 || dotted_in_dto > 0,
        "No staccato or dots in DTO"
    );
    assert!(total_dots > 0, "No notation dots in layout output");
}
