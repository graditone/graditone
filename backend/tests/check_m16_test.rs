/// Check which system contains measures 16-17 and verify slur arcs
use musicore_backend::adapters::dtos::ScoreDto;
use musicore_backend::domain::importers::musicxml::{
    CompressionHandler, ImportContext, MusicXMLConverter, MusicXMLParser,
};
use musicore_backend::layout::{LayoutConfig, compute_layout};
use std::path::Path;

#[test]
fn check_m16_slur_system() {
    let fixture_path = Path::new("../scores/Bach_InventionNo1.mxl");
    let xml_content = CompressionHandler::load_content(fixture_path).unwrap();
    let mut context = ImportContext::new();
    let doc = MusicXMLParser::parse(&xml_content, &mut context).unwrap();
    let score = MusicXMLConverter::convert(doc, &mut context).unwrap();

    // Find which notes have slur_next and what ticks they're at
    for inst in &score.instruments {
        for (si, staff) in inst.staves.iter().enumerate() {
            for voice in &staff.voices {
                for note in &voice.interval_events {
                    if note.slur_next.is_some() {
                        eprintln!(
                            "Staff {} slur: pitch={:?} tick={:?} -> {:?} above={:?}",
                            si, note.pitch, note.start_tick, note.slur_next, note.slur_above
                        );
                    }
                }
            }
        }
    }

    let score_dto = ScoreDto::from(&score);
    let score_json = serde_json::to_value(&score_dto).unwrap();
    let config = LayoutConfig::default();
    let layout = compute_layout(&score_json, &config);

    eprintln!("\nSystems:");
    for (si, sys) in layout.systems.iter().enumerate() {
        let tick_start = sys.tick_range.start_tick;
        let tick_end = sys.tick_range.end_tick;
        // m16 starts at tick 15*3840 = 57600
        let m_start = tick_start / 3840 + 1;
        let m_end = (tick_end - 1) / 3840 + 1;

        let mut tie_count = 0;
        let mut slur_count = 0;
        for sg in &sys.staff_groups {
            for staff in &sg.staves {
                tie_count += staff.tie_arcs.len();
                slur_count += staff.slur_arcs.len();
            }
        }
        eprintln!(
            "  System {}: ticks {}..{} (m{}..m{}), ties={}, slurs={}",
            si, tick_start, tick_end, m_start, m_end, tie_count, slur_count
        );
    }
}
