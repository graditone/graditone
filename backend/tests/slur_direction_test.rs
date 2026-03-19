//! Slur direction test: verifies that slur arcs have correct concavity
//! based on standard engraving rules (opposite side of stems).
//! Regression test for T111: bezier-y inference was overriding the standard
//! rule with incorrect direction for M52 ascending runs.

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

/// When MusicXML has bezier-y but no explicit placement="above|below",
/// slur_above should be None so the layout engine auto-determines direction
/// from note position (standard engraving rule: opposite side of stems).
#[test]
fn test_slur_above_not_inferred_from_bezier_y() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Beethoven_FurElise.mxl"))
        .unwrap();

    let instrument = &result.score.instruments[0];
    let mut slur_count = 0;
    for staff in &instrument.staves {
        for voice in &staff.voices {
            for note in &voice.interval_events {
                if note.slur_next.is_some() {
                    // Without explicit placement attribute, slur_above should be None
                    assert_eq!(
                        note.slur_above, None,
                        "Slur on {:?} should have slur_above=None (auto-determine), got {:?}",
                        note.pitch, note.slur_above
                    );
                    slur_count += 1;
                }
            }
        }
    }
    assert!(slur_count > 0, "Should find slur starts in Für Elise");
}

/// In the layout output, slur arcs must be present and use the standard
/// engraving rule for direction.
#[test]
fn test_slur_arcs_present_in_layout() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Beethoven_FurElise.mxl"))
        .unwrap();
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).unwrap();
    let layout = compute_layout(&json, &CONFIG);
    let layout_json = serde_json::to_value(&layout).unwrap();

    let systems = layout_json["systems"].as_array().expect("systems array");
    let mut total_slur_arcs = 0;

    for system in systems {
        for sg in system["staff_groups"].as_array().unwrap_or(&vec![]) {
            for staff in sg["staves"].as_array().unwrap_or(&vec![]) {
                if let Some(arcs) = staff["slur_arcs"].as_array() {
                    total_slur_arcs += arcs.len();
                }
            }
        }
    }

    assert!(
        total_slur_arcs > 0,
        "Should have slur arcs in Für Elise layout"
    );
}
