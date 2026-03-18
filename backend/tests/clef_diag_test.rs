/// Diagnostic test for Für Elise clef changes and beams around m14-m15
use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLConverter, MusicXMLParser,
};
use std::path::Path;

fn load_fur_elise() -> musicore_backend::domain::score::Score {
    let fixture_path = Path::new("../scores/Beethoven_FurElise.mxl");
    let xml = CompressionHandler::load_content(fixture_path).expect("load");
    let mut ctx = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml, &mut ctx).expect("parse");
    MusicXMLConverter::convert(doc, &mut ctx).expect("convert")
}

#[test]
fn check_clef_events() {
    let score = load_fur_elise();

    // Print measure_end_ticks for m8-m16
    eprintln!("pickup_ticks={}", score.pickup_ticks);
    for (i, &end_tick) in score.measure_end_ticks.iter().enumerate() {
        if i >= 7 && i <= 16 {
            eprintln!("measure_end_ticks[{i}] = {end_tick}");
        }
    }

    for (ii, inst) in score.instruments.iter().enumerate() {
        for (si, staff) in inst.staves.iter().enumerate() {
            for event in &staff.staff_structural_events {
                if let musicore_backend::domain::events::staff::StaffStructuralEvent::Clef(ce) =
                    event
                {
                    eprintln!(
                        "inst={ii} staff={si} clef_tick={} clef={:?}",
                        ce.tick.value(),
                        ce.clef
                    );
                }
            }
        }
    }
}

#[test]
fn check_beam_info_m14_m15() {
    let score = load_fur_elise();
    // Show ALL LH notes from tick 17000 to 22000
    let inst = &score.instruments[0];
    let staff = &inst.staves[1]; // LH staff (index 1)
    for voice in &staff.voices {
        for note in &voice.interval_events {
            let tick = note.start_tick.value();
            if tick >= 17000 && tick < 22000 {
                eprintln!(
                    "LH note tick={tick} pitch={:?} dur={} beams={:?}",
                    note.pitch, note.duration_ticks, note.beams
                );
            }
        }
    }
}

#[test]
fn check_lh_rests_m15_m18() {
    let score = load_fur_elise();
    // Measure boundaries
    eprintln!("pickup_ticks={}", score.pickup_ticks);
    for i in 14..=18 {
        if i < score.measure_end_ticks.len() {
            eprintln!(
                "measure_end_ticks[{i}] = {} (m{} end / m{} start)",
                score.measure_end_ticks[i],
                i + 1,
                i + 2
            );
        }
    }
    // LH staff notes and rests
    let inst = &score.instruments[0];
    let staff = &inst.staves[1];
    eprintln!("\n--- LH notes (all voices) tick range 20000-25000 ---");
    for (vi, voice) in staff.voices.iter().enumerate() {
        for note in &voice.interval_events {
            let tick = note.start_tick.value();
            if tick >= 20000 && tick < 25000 {
                eprintln!(
                    "  voice={vi} NOTE tick={tick} pitch={:?} dur={}",
                    note.pitch, note.duration_ticks
                );
            }
        }
        for rest in &voice.rest_events {
            let tick = rest.start_tick.value();
            if tick >= 20000 && tick < 25000 {
                eprintln!("  voice={vi} REST tick={tick} dur={}", rest.duration_ticks);
            }
        }
    }
    // Also show clef events
    for event in &staff.staff_structural_events {
        if let musicore_backend::domain::events::staff::StaffStructuralEvent::Clef(ce) = event {
            let t = ce.tick.value();
            if t >= 20000 && t <= 25000 {
                eprintln!("  CLEF tick={t} clef={:?}", ce.clef);
            }
        }
    }
}

#[test]
fn check_system_boundaries_m16_m18() {
    use musicore_backend::layout::{LayoutConfig, compute_layout};
    let score = load_fur_elise();
    let score_json = serde_json::to_value(&score).expect("serialize");
    let config = LayoutConfig::default();
    let layout = compute_layout(&score_json, &config);
    for sys in &layout.systems {
        if sys.tick_range.start_tick <= 23040 && sys.tick_range.end_tick >= 20160 {
            eprintln!(
                "System {} tick_range=[{}, {}) measure_number={:?}",
                sys.index, sys.tick_range.start_tick, sys.tick_range.end_tick, sys.measure_number
            );
        }
    }
}
