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

#[test]
fn test_debug_m2_slur() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Chopin_NocturneOp9No2.mxl"))
        .unwrap();
    let dto: ScoreDto = (&result.score).into();

    // Check the DTO to see slur_above values
    let json = serde_json::to_value(&dto).unwrap();

    // Look in instruments[0].staves[0].voices for slur data
    if let Some(instruments) = json["instruments"].as_array() {
        for (inst_idx, inst) in instruments.iter().enumerate() {
            if let Some(staves) = inst["staves"].as_array() {
                for (staff_idx, staff) in staves.iter().enumerate() {
                    if let Some(voices) = staff["voices"].as_array() {
                        for (voice_idx, voice) in voices.iter().enumerate() {
                            if let Some(notes) = voice["interval_events"].as_array() {
                                for note in notes {
                                    let slur_next = &note["slur_next"];
                                    if !slur_next.is_null() {
                                        let tick = note["start_tick"].as_u64().unwrap_or(0);
                                        let pitch = note["pitch"].as_u64().unwrap_or(0);
                                        let slur_above = &note["slur_above"];
                                        // M2 is at tick 480..6240
                                        if tick < 12000 {
                                            eprintln!(
                                                "SLUR START: inst={} staff={} voice={} tick={} pitch={} slur_above={} slur_next={}",
                                                inst_idx,
                                                staff_idx,
                                                voice_idx,
                                                tick,
                                                pitch,
                                                slur_above,
                                                slur_next
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Now check layout slur arcs
    let layout = compute_layout(&json, &CONFIG);
    let layout_json = serde_json::to_value(&layout).unwrap();
    let systems = layout_json["systems"].as_array().expect("systems");

    // System 0 should contain M1-M2
    for (si, system) in systems.iter().enumerate() {
        if si > 0 {
            break;
        } // Only system 0
        let st = system["tick_range"]["start_tick"].as_u64().unwrap_or(0);
        let et = system["tick_range"]["end_tick"].as_u64().unwrap_or(0);
        eprintln!("\nSystem {} tick range: {}..{}", si, st, et);

        if let Some(staff_groups) = system["staff_groups"].as_array() {
            for sg in staff_groups {
                if let Some(staves) = sg["staves"].as_array() {
                    // Print ALL glyphs in treble staff (staff 0) to find noteheads
                    let treble = &staves[0];
                    let empty_runs = vec![];
                    let mut note_count = 0;
                    for run in treble["glyph_runs"].as_array().unwrap_or(&empty_runs) {
                        let empty_g = vec![];
                        for glyph in run["glyphs"].as_array().unwrap_or(&empty_g) {
                            let cp = glyph["codepoint"].as_str().unwrap_or("");
                            let ch = cp.chars().next().unwrap_or('\0');
                            let x = glyph["position"]["x"].as_f64().unwrap_or(0.0);
                            let y = glyph["position"]["y"].as_f64().unwrap_or(0.0);
                            // Match all notehead glyphs: quarter U+E0A4, half U+E0A3,
                            // whole U+E0A2, eighth uses same as quarter
                            if ch == '\u{E0A4}' || ch == '\u{E0A3}' || ch == '\u{E0A2}' {
                                note_count += 1;
                                eprintln!(
                                    "  NOTEHEAD staff=0: x={:.1} y={:.1} glyph=U+{:04X}",
                                    x, y, ch as u32
                                );
                            }
                        }
                    }
                    eprintln!("  Total noteheads on treble: {}", note_count);

                    // Now check slur arcs on treble
                    if let Some(slur_arcs) = treble["slur_arcs"].as_array() {
                        for (ai, arc) in slur_arcs.iter().enumerate() {
                            let sx = arc["start"]["x"].as_f64().unwrap_or(0.0);
                            let sy = arc["start"]["y"].as_f64().unwrap_or(0.0);
                            let ex = arc["end"]["x"].as_f64().unwrap_or(0.0);
                            let ey = arc["end"]["y"].as_f64().unwrap_or(0.0);
                            let cp1x = arc["cp1"]["x"].as_f64().unwrap_or(0.0);
                            let cp1y = arc["cp1"]["y"].as_f64().unwrap_or(0.0);
                            let cp2x = arc["cp2"]["x"].as_f64().unwrap_or(0.0);
                            let cp2y = arc["cp2"]["y"].as_f64().unwrap_or(0.0);
                            let above = arc["above"].as_bool().unwrap_or(false);
                            eprintln!(
                                "\n  TREBLE SLUR #{}: above={} start=({:.1},{:.1}) end=({:.1},{:.1})",
                                ai, above, sx, sy, ex, ey
                            );
                            eprintln!(
                                "    cp1=({:.1},{:.1}) cp2=({:.1},{:.1})",
                                cp1x, cp1y, cp2x, cp2y
                            );
                            for i in 0..=10 {
                                let t = i as f64 / 10.0;
                                let u = 1.0 - t;
                                let bx = u * u * u * sx
                                    + 3.0 * u * u * t * cp1x
                                    + 3.0 * u * t * t * cp2x
                                    + t * t * t * ex;
                                let by = u * u * u * sy
                                    + 3.0 * u * u * t * cp1y
                                    + 3.0 * u * t * t * cp2y
                                    + t * t * t * ey;
                                eprintln!("    t={:.1}: ({:.1}, {:.1})", t, bx, by);
                            }
                        }
                    }

                    // ---- Bass staff (staff 1) ----
                    if staves.len() > 1 {
                        let bass = &staves[1];
                        let empty_runs2 = vec![];
                        let mut bass_note_count = 0;
                        for run in bass["glyph_runs"].as_array().unwrap_or(&empty_runs2) {
                            let empty_g2 = vec![];
                            for glyph in run["glyphs"].as_array().unwrap_or(&empty_g2) {
                                let cp = glyph["codepoint"].as_str().unwrap_or("");
                                let ch = cp.chars().next().unwrap_or('\0');
                                let x = glyph["position"]["x"].as_f64().unwrap_or(0.0);
                                let y = glyph["position"]["y"].as_f64().unwrap_or(0.0);
                                if ch == '\u{E0A4}' || ch == '\u{E0A3}' || ch == '\u{E0A2}' {
                                    bass_note_count += 1;
                                    eprintln!(
                                        "  NOTEHEAD staff=1(bass): x={:.1} y={:.1} glyph=U+{:04X}",
                                        x, y, ch as u32
                                    );
                                }
                            }
                        }
                        eprintln!("  Total noteheads on bass: {}", bass_note_count);

                        if let Some(slur_arcs) = bass["slur_arcs"].as_array() {
                            for (ai, arc) in slur_arcs.iter().enumerate() {
                                let sx = arc["start"]["x"].as_f64().unwrap_or(0.0);
                                let sy = arc["start"]["y"].as_f64().unwrap_or(0.0);
                                let ex = arc["end"]["x"].as_f64().unwrap_or(0.0);
                                let ey = arc["end"]["y"].as_f64().unwrap_or(0.0);
                                let cp1y = arc["cp1"]["y"].as_f64().unwrap_or(0.0);
                                let cp2y = arc["cp2"]["y"].as_f64().unwrap_or(0.0);
                                let above = arc["above"].as_bool().unwrap_or(false);
                                eprintln!(
                                    "\n  BASS SLUR #{}: above={} start=({:.1},{:.1}) end=({:.1},{:.1}) cp_y={:.1}",
                                    ai, above, sx, sy, ex, ey, cp1y
                                );
                                for i in 0..=10 {
                                    let t = i as f64 / 10.0;
                                    let u = 1.0 - t;
                                    let by = u * u * u * sy
                                        + 3.0 * u * u * t * cp1y
                                        + 3.0 * u * t * t * cp2y
                                        + t * t * t * ey;
                                    eprintln!("    t={:.1}: y={:.1}", t, by);
                                }
                            }
                        } else {
                            eprintln!("  No bass slur_arcs found");
                        }

                        // Also check tie_arcs on bass
                        if let Some(tie_arcs) = bass["tie_arcs"].as_array() {
                            eprintln!("  Bass tie_arcs count: {}", tie_arcs.len());
                        }
                    }
                }
            }
        }
    }
}
