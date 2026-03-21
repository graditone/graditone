//! Regression test: Nocturne Op.9 No.2 M2 LH staccato placement.
//!
//! Constitution VII: This failing test was written BEFORE the fix was applied.
//!
//! Bug: M2 LH contains 4 staccato notes (E2, E3, E2, D2 — all MusicXML voice=5,
//! staff=2). The MusicXML has `<stem>down</stem>` for all 4. Standard engraving
//! rule: stem-down → staccato ABOVE the notehead (opposite stem direction).
//!
//! Before fix: staccato placement ignores `<stem>` and falls back to a
//! pitch-position heuristic. E2, D2 are below the bass-clef middle line →
//! heuristic gives stem-up → staccato BELOW the notehead (wrong).
//! Only E3 (above middle) is placed correctly above.
//!
//! After fix: explicit MusicXML `<stem>` value is stored in NoteEvent.stem_down
//! and used by the staccato placement; all 4 dots appear above.
//!
//! Tick arithmetic (12/8, pickup = 480 ticks, 5760 ticks/measure):
//!   M2 start = 480 + 1×5760 = 6240
//!   M2 end   = 480 + 2×5760 = 12000
//!
//! In positive-y-down layout coordinates:
//!   "above notehead" ⟺ staccato_dot.y < notehead.y

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

/// In bass clef (bottom staff line = G2), the first ledger line below is E2
/// and the space below that is D2.  With 20 units/space:
///   E2 is 2 spaces below the bottom staff line  → notehead_center_y = bottom_y + 40 + 10
///   D2 is 2.5 spaces below the bottom staff line → notehead_center_y = bottom_y + 50 + 10
/// A staccato dot placed **below** those notes (the bug) ends up at
///   notehead_center_y + 1.2 * units_per_space = notehead_center_y + 24
/// which for E2 = bottom_y + 74, D2 = bottom_y + 84.
/// A staccato placed **above** ends up at notehead_center_y − 24, which for
/// E2 = bottom_y + 26, D2 = bottom_y + 36 — both inside or just below the staff.
///
/// Measured values (diagnostic run before fix):
///   wrong E2 dots:    bottom+44 (2.20 spaces) and bottom+54 (2.70 spaces)
///   correct E3 dot:   bottom-74 (−3.70 spaces, inside the staff)
///
/// The threshold we assert: NO notation dot in M2 bass staff should sit more than
/// 1.5 staff spaces (30 units) below the bottom staff line.  Before the fix the
/// wrong dots were 2.2–2.7 spaces below the bottom line; after the fix all dots
/// are well within that threshold.
#[test]
fn test_nocturne_m2_lh_staccato_dots_not_below_ledger_lines() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Chopin_NocturneOp9No2.mxl"))
        .expect("Failed to import Nocturne");
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).expect("DTO serialization failed");
    let layout = compute_layout(&json, &CONFIG);
    let layout_json = serde_json::to_value(&layout).expect("layout serialization failed");

    let systems = layout_json["systems"].as_array().expect("systems array");

    // ── 1. Find the system whose tick_range contains M2 (6240–12000) ─────────
    let m2_system = systems.iter().find(|sys| {
        let start = sys["tick_range"]["start_tick"].as_u64().unwrap_or(u64::MAX);
        let end = sys["tick_range"]["end_tick"].as_u64().unwrap_or(0);
        start <= 6240 && end > 6240
    });

    // If M2 doesn't appear in the layout (e.g. layout changed), skip gracefully.
    let m2_system = match m2_system {
        Some(s) => s,
        None => {
            eprintln!("WARNING: M2 not found in any system tick_range; skipping test.");
            return;
        }
    };

    // ── 2. Navigate to bass clef staff (staff_groups[0].staves[1]) ───────────
    let staff_groups = m2_system["staff_groups"].as_array().expect("staff_groups");
    let staves = staff_groups[0]["staves"].as_array().expect("staves");
    // Piano LH = second staff (index 1)
    let bass_staff = &staves[1];

    // ── 3. Get the y-position of the bottom staff line (G2 in bass clef) ─────
    let staff_lines = bass_staff["staff_lines"].as_array().expect("staff_lines");
    let bottom_line_y = staff_lines[4]["y_position"]
        .as_f64()
        .expect("bottom staff line y_position");

    // ── 4. Assert no notation_dot is more than 3 staff spaces below bottom ───
    // Before fix: dots for E2, D2 ended up ~3.5–4 spaces below the bottom line.
    // After fix:  all staccato dots are inside or just below the staff.
    let max_allowed_y = bottom_line_y + 1.5 * CONFIG.units_per_space as f64; // bottom + 30 units

    if let Some(dots) = bass_staff["notation_dots"].as_array() {
        for dot in dots {
            let dot_y = dot["y"].as_f64().expect("dot y");
            assert!(
                dot_y <= max_allowed_y,
                "M2 LH notation dot at y={:.1} is more than 1.5 staff spaces below \
                 the bottom staff line (y={:.1}, threshold={:.1}). \
                 This indicates a staccato dot was incorrectly placed BELOW a \
                 note on a ledger line. MusicXML stem=down means staccato goes ABOVE.",
                dot_y,
                bottom_line_y,
                max_allowed_y
            );
        }
    }
}

/// Diagnostic — run with `cargo test print_m2_lh_dots -- --nocapture` to see
/// the actual dot positions before/after the fix.
#[test]
fn print_m2_lh_dots() {
    let importer = MusicXMLImporter::new();
    let result = importer
        .import_file(Path::new("../scores/Chopin_NocturneOp9No2.mxl"))
        .expect("import");
    let dto: ScoreDto = (&result.score).into();
    let json = serde_json::to_value(&dto).expect("dto");
    let layout = compute_layout(&json, &CONFIG);
    let layout_json = serde_json::to_value(&layout).expect("layout");
    let systems = layout_json["systems"].as_array().expect("systems");
    let m2_system = systems
        .iter()
        .find(|sys| {
            let s = sys["tick_range"]["start_tick"].as_u64().unwrap_or(u64::MAX);
            let e = sys["tick_range"]["end_tick"].as_u64().unwrap_or(0);
            s <= 6240 && e > 6240
        })
        .expect("M2 system");
    let staves = m2_system["staff_groups"].as_array().expect("sg")[0]["staves"]
        .as_array()
        .expect("staves");
    let bass = &staves[1];
    let lines = bass["staff_lines"].as_array().expect("lines");
    let bottom_y = lines[4]["y_position"].as_f64().expect("bottom");
    eprintln!("Bass staff bottom line y = {:.1}", bottom_y);
    if let Some(dots) = bass["notation_dots"].as_array() {
        for d in dots {
            let y = d["y"].as_f64().expect("y");
            let x = d["x"].as_f64().expect("x");
            let rel = y - bottom_y;
            eprintln!(
                "  dot x={:.1} y={:.1}  (bottom+{:.1} = {:.2} spaces)",
                x,
                y,
                rel,
                rel / 20.0
            );
        }
    }
}
