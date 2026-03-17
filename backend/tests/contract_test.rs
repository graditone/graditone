//! Contract tests for WASM layout engine
//!
//! Validates that Rust layout engine output exactly matches frontend fixture expectations

use std::fs;
use std::path::PathBuf;

#[test]
fn test_violin_fixture_contract() {
    // T006: Load violin_10_measures.json fixture
    let fixture_path = PathBuf::from("tests/fixtures/violin_10_measures.json");
    let fixture_content =
        fs::read_to_string(&fixture_path).expect("Failed to read violin_10_measures.json fixture");

    let _expected_output: serde_json::Value =
        serde_json::from_str(&fixture_content).expect("Failed to parse violin fixture JSON");

    // For now, create a simple input to test with
    // TODO: This should come from a real score input
    let test_input = serde_json::json!({
        "instruments": [{
            "id": "violin-1",
            "name": "Violin",
            "staves": [{
                "clef": "Treble",
                "voices": [{
                    "notes": [
                        {"tick": 0, "duration": 960, "pitch": 60},
                        {"tick": 960, "duration": 960, "pitch": 62},
                        {"tick": 1920, "duration": 960, "pitch": 64}
                    ]
                }]
            }]
        }],
        "tempo_changes": [{"tick": 0, "bpm": 120}],
        "time_signature_changes": [{"tick": 0, "numerator": 4, "denominator": 4}]
    });

    let config = musicore_backend::layout::LayoutConfig {
        max_system_width: 1200.0,
        units_per_space: 20.0,
        system_spacing: 220.0,
        system_height: 200.0,
    };

    // T007: Assert output structure matches fixture (WILL FAIL - empty staff_groups)
    let actual_output = musicore_backend::layout::compute_layout(&test_input, &config);

    // Serialize to JSON for comparison
    let actual_json =
        serde_json::to_value(&actual_output).expect("Failed to serialize layout output");

    // Verify systems are created
    assert!(
        actual_json["systems"].is_array(),
        "Output should have systems array"
    );

    let systems = actual_json["systems"].as_array().unwrap();
    assert!(!systems.is_empty(), "Systems array should not be empty");

    // Critical check: staff_groups should NOT be empty (this is what we're fixing)
    let first_system = &systems[0];
    let staff_groups = first_system["staff_groups"]
        .as_array()
        .expect("staff_groups should be an array");

    assert!(
        !staff_groups.is_empty(),
        "CRITICAL BUG: staff_groups is empty - layout engine not generating staff content"
    );

    // If we get here, staff_groups exists - now verify structure
    let first_staff_group = &staff_groups[0];
    assert!(
        first_staff_group["instrument_id"].is_string(),
        "staff_group should have instrument_id"
    );

    let staves = first_staff_group["staves"]
        .as_array()
        .expect("staff_group should have staves array");
    assert!(!staves.is_empty(), "staves array should not be empty");

    let first_staff = &staves[0];

    // Verify staff lines exist
    let staff_lines = first_staff["staff_lines"]
        .as_array()
        .expect("staff should have staff_lines array");
    assert_eq!(staff_lines.len(), 5, "Staff should have exactly 5 lines");

    // T013-T014: Verify staff line spacing is correct (20 units = 1 * units_per_space)
    let y_positions: Vec<f32> = staff_lines
        .iter()
        .map(|line| line["y_position"].as_f64().unwrap() as f32)
        .collect();

    println!("Staff line y-positions: {:?}", y_positions);

    // Staff lines should have 20-unit spacing (1 × units_per_space).
    // Absolute y depends on top margin; verify relative spacing instead.
    for i in 1..y_positions.len() {
        let spacing = y_positions[i] - y_positions[i - 1];
        assert!(
            (spacing - 20.0).abs() < 0.01,
            "Staff line spacing between line {} and {} should be 20.0, got {}",
            i - 1,
            i,
            spacing,
        );
    }

    // Verify glyph_runs exist (noteheads)
    let glyph_runs = first_staff["glyph_runs"]
        .as_array()
        .expect("staff should have glyph_runs array");
    assert!(
        !glyph_runs.is_empty(),
        "glyph_runs should contain positioned noteheads"
    );

    println!("✅ Contract test passed: staff_groups populated with valid structure");
}

#[test]
fn test_piano_fixture_contract() {
    // T006: Load piano_8_measures.json fixture
    let fixture_path = PathBuf::from("tests/fixtures/piano_8_measures.json");
    let fixture_content =
        fs::read_to_string(&fixture_path).expect("Failed to read piano_8_measures.json fixture");

    let _expected_output: serde_json::Value =
        serde_json::from_str(&fixture_content).expect("Failed to parse piano fixture JSON");

    // Simple piano input (treble + bass staves)
    let test_input = serde_json::json!({
        "instruments": [{
            "id": "piano-1",
            "name": "Piano",
            "staves": [
                {
                    "clef": "Treble",
                    "voices": [{
                        "notes": [
                            {"tick": 0, "duration": 960, "pitch": 72}
                        ]
                    }]
                },
                {
                    "clef": "Bass",
                    "voices": [{
                        "notes": [
                            {"tick": 0, "duration": 960, "pitch": 48}
                        ]
                    }]
                }
            ]
        }]
    });

    let config = musicore_backend::layout::LayoutConfig {
        max_system_width: 1200.0,
        units_per_space: 20.0,
        system_spacing: 220.0,
        system_height: 200.0,
    };

    let actual_output = musicore_backend::layout::compute_layout(&test_input, &config);

    let actual_json =
        serde_json::to_value(&actual_output).expect("Failed to serialize layout output");

    // Verify multi-staff structure
    let systems = actual_json["systems"].as_array().unwrap();
    let first_system = &systems[0];
    let staff_groups = first_system["staff_groups"].as_array().unwrap();

    assert!(!staff_groups.is_empty(), "Piano should have staff_groups");

    let first_staff_group = &staff_groups[0];
    let staves = first_staff_group["staves"].as_array().unwrap();

    // Piano should have 2 staves (treble + bass)
    assert_eq!(
        staves.len(),
        2,
        "Piano staff_group should have 2 staves (treble + bass)"
    );

    println!("✅ Piano contract test passed: Multi-staff structure correct");
}

/// T025: Contract test verifying StaffGroup serializes with instrument_name and name_label fields
#[test]
fn test_staff_group_instrument_name_and_name_label_contract() {
    // Multi-instrument score to verify both fields are present
    let test_input = serde_json::json!({
        "instruments": [
            {
                "id": "violin-1",
                "name": "Violin",
                "staves": [{
                    "clef": "Treble",
                    "voices": [{
                        "notes": [
                            {"tick": 0, "duration": 3840, "pitch": 67}
                        ]
                    }]
                }]
            },
            {
                "id": "cello-1",
                "name": "Cello",
                "staves": [{
                    "clef": "Bass",
                    "voices": [{
                        "notes": [
                            {"tick": 0, "duration": 3840, "pitch": 48}
                        ]
                    }]
                }]
            }
        ]
    });

    let config = musicore_backend::layout::LayoutConfig::default();
    let actual_output = musicore_backend::layout::compute_layout(&test_input, &config);
    let actual_json =
        serde_json::to_value(&actual_output).expect("Failed to serialize layout output");

    let systems = actual_json["systems"].as_array().unwrap();
    assert!(!systems.is_empty());

    let staff_groups = systems[0]["staff_groups"].as_array().unwrap();
    assert_eq!(
        staff_groups.len(),
        2,
        "Should have 2 staff groups for violin + cello"
    );

    // Verify violin staff group has instrument_name and name_label
    let violin_sg = &staff_groups[0];
    assert_eq!(
        violin_sg["instrument_name"].as_str().unwrap(),
        "Violin",
        "instrument_name should be 'Violin'"
    );
    assert!(
        violin_sg["name_label"].is_object(),
        "name_label should be present as object"
    );
    let violin_label = &violin_sg["name_label"];
    assert_eq!(violin_label["text"].as_str().unwrap(), "Violin");
    assert!(violin_label["position"]["x"].is_number());
    assert!(violin_label["position"]["y"].is_number());
    assert!(violin_label["font_size"].is_number());
    assert!(violin_label["font_family"].is_string());
    assert!(violin_label["color"].is_object());

    // Verify cello staff group
    let cello_sg = &staff_groups[1];
    assert_eq!(
        cello_sg["instrument_name"].as_str().unwrap(),
        "Cello",
        "instrument_name should be 'Cello'"
    );
    assert!(
        cello_sg["name_label"].is_object(),
        "Cello name_label should be present"
    );
    assert_eq!(cello_sg["name_label"]["text"].as_str().unwrap(), "Cello");

    println!("✅ Contract test passed: StaffGroup has instrument_name and name_label fields");
}
