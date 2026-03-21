# Quickstart: Fix Nocturne Op.9 No.2 Layout Defects (M29–M37)

**Date**: 2026-03-21  
**Branch**: `001-fix-nocturne-layout`

This guide walks a developer through verifying each defect, running the test suite, applying a fix, and validating the result.

---

## Prerequisites

```bash
# From repo root
cd /path/to/graditone

# Ensure correct branch
git checkout 001-fix-nocturne-layout

# Build the backend (Rust)
cd backend && cargo build
cd ..

# Install frontend dependencies (first time only)
cd frontend && npm install
cd ..
```

---

## 1. Reproduce the Defects (Visual)

Start the development server:

```bash
cd frontend && npm run dev
```

Open the app in a browser, load the Chopin Nocturne Op.9 No.2, and navigate to:

| Measure | Expected | Current (buggy) |
|---------|----------|-----------------|
| M29 | Note with 𝄫 (double-flat) sign | Shows ♮ (natural) instead |
| M30 | "8va" bracket begins above the staff | No bracket visible |
| M34–M36 | Courtesy accidentals visible on all required notes | Accidentals missing |
| M34–M36 | Rests centred at standard voice position | Rests floating off-centre |
| M37 | Slur arc connects correct note heads | Slur start/end misaligned |
| M32–M33, M33–M34 | Clean separation between measure elements | Elements overlap at barlines |

---

## 2. Run Existing Tests (Baseline)

```bash
# Full Rust test suite — should pass before you touch anything
cd backend && cargo test 2>&1 | tail -20

# Nocturne-specific existing tests
cargo test nocturne
cargo test chopin

# E2E (requires dev server running on localhost:5173)
cd ../frontend && npx playwright test e2e/m21-flat-check.spec.ts
```

---

## 3. Fix Workflows (Test-First, per Principle V & VII)

### Fix 1: M29 Double-Flat Accidental (positioner.rs)

```bash
# Step 1: Write the failing test
# Add to backend/tests/nocturne_m29_m37_test.rs:
#   test_nocturne_m29_double_flat_accidental()
cargo test test_nocturne_m29_double_flat_accidental   # Must FAIL (Red)

# Step 2: Fix positioner.rs
# In backend/src/layout/positioner.rs (~line 927), change the match block:
#   -2 => ('\u{E264}', "accidentalDoubleFlat"),
#   -1 => ('\u{E260}', "accidentalFlat"),
#    0 => ('\u{E261}', "accidentalNatural"),
#    1 => ('\u{E262}', "accidentalSharp"),
#    2 => ('\u{E263}', "accidentalDoubleSharp"),
#   _  => ('\u{E261}', "accidentalNatural"),  # keep for safety

# Step 3: Run the test again — must PASS (Green)
cargo test test_nocturne_m29_double_flat_accidental

# Step 4: No regressions
cargo test
```

### Fix 2: M30 Missing 8va Bracket (extraction.rs / parser.rs)

```bash
# Step 1: Write the failing test
# Add to backend/tests/nocturne_m29_m37_test.rs:
#   test_nocturne_m30_ottava_bracket_starts_at_m30()
cargo test test_nocturne_m30_ottava_bracket_starts_at_m30   # Must FAIL (Red)

# Step 2: Trace octave-shift region start tick
# Check: backend/src/domain/importers/musicxml/parser.rs — find <octave-shift type="down"> parsing
# Check: backend/src/layout/extraction.rs — find octave_shift_regions population
# Verify that the start tick corresponds to M30's first beat, not M31's first beat

# Step 3: Fix the off-by-one (either parser or extraction)
# Step 4: cargo test test_nocturne_m30_ottava_bracket_starts_at_m30   # Must PASS
# Step 5: cargo test   # No regressions
```

### Fix 3: M34–M36 Missing Courtesy Accidentals (positioner.rs)

```bash
# Step 1: Write the failing test
# test_nocturne_m34_m36_courtesy_accidentals()
cargo test test_nocturne_m34_m36_courtesy_accidentals   # Must FAIL (Red)

# Step 2: In positioner.rs, find where accidental state is tracked inside octave-shift regions
# Ensure all comparisons use written pitch (not sounding pitch) — i.e., use note.spelling.step/alter,
# not the display-transposed pitch

# Step 3–5: same pattern as above
```

### Fix 4: M34–M36 Rests Not Centred (positioner.rs)

```bash
# Step 1: Write the failing test
# test_nocturne_m34_m36_rest_centering()
cargo test test_nocturne_m34_m36_rest_centering   # Must FAIL (Red)

# Step 2: Find rest_y() in positioner.rs (~line 1264)
# Confirm: if MusicXML voice is 1-based, use (voice - 1) when indexing the Y-offset table
# Fix the voice index arithmetic

# Step 3–5: same pattern
```

### Fix 5: M37 Slur Mispositioned (annotations.rs)

```bash
# Step 1: Write the failing test
# test_nocturne_m37_slur_coordinates()
cargo test test_nocturne_m37_slur_coordinates   # Must FAIL (Red)

# Step 2: In annotations.rs (~line 642), find slur arc generation
# Check whether M37's slur is cross-system: if yes, confirm is_cross_system = true and
# that start/end x values are system-relative

# Step 3–5: same pattern
```

### Fix 6: M32–M34 Overlaps at Measure Boundaries (positioner.rs)

```bash
# Step 1: Write the failing test
# test_nocturne_m32_m34_no_overlaps()
cargo test test_nocturne_m32_m34_no_overlaps   # Must FAIL (Red)

# Step 2: Add enforce_measure_boundary_clearance() to positioner.rs
# For each consecutive measure pair, compute:
#   clearance = first_element_x_of_next_measure - last_element_x_of_current_measure
#   if clearance < MIN_CLEARANCE: shift_right(next_measure_elements, MIN_CLEARANCE - clearance)

# Step 3–5: same pattern
```

---

## 4. Validate All Fixes Together

```bash
# All new Rust tests
cd backend && cargo test nocturne_m29_m37

# Full Rust suite — zero new failures
cargo test

# E2E visual check — add tests before running
cd ../frontend
npx playwright test e2e/nocturne-m29-m37-layout.spec.ts

# Full E2E suite — zero regressions
npx playwright test
```

---

## 5. Key Files Quick Reference

| Task | File | Line Approx. |
|------|------|------|
| Accidental codepoint mapping | `backend/src/layout/positioner.rs` | ~927 |
| Accidental state machine | `backend/src/layout/positioner.rs` | ~730–920 |
| Rest vertical positioning | `backend/src/layout/positioner.rs` | ~1264 |
| Measure boundary clearance | `backend/src/layout/positioner.rs` | TBD (new function) |
| Ottava bracket generation | `backend/src/layout/mod.rs` | ~879–920 |
| Ottava region extraction | `backend/src/layout/extraction.rs` | — |
| Octave-shift parsing | `backend/src/domain/importers/musicxml/parser.rs` | — |
| Slur arc geometry | `backend/src/layout/annotations.rs` | ~642–800 |
| New regression tests | `backend/tests/nocturne_m29_m37_test.rs` | new file |
| E2E visual tests | `frontend/e2e/nocturne-m29-m37-layout.spec.ts` | new file |
| Existing accidental E2E pattern | `frontend/e2e/m21-flat-check.spec.ts` | existing |
| Source score | `scores/Chopin_NocturneOp9No2.mxl` | — |

---

## 6. MusicXML Inspection Utility

To inspect specific measures in the Nocturne MXL:

```bash
# Extract and inspect measures 29-37
python3 - <<'EOF'
import zipfile, xml.etree.ElementTree as ET

with zipfile.ZipFile('scores/Chopin_NocturneOp9No2.mxl') as z:
    xml_name = [n for n in z.namelist() if n.endswith('.xml')][0]
    root = ET.fromstring(z.read(xml_name))

parts = root.findall('.//part')
for part in parts:
    measures = part.findall('measure')
    for m in measures:
        num = m.get('number', '?')
        if 29 <= int(num) <= 37:
            print(f"\n=== Measure {num} ===")
            for elem in m.iter():
                if elem.tag in ('alter', 'accidental', 'octave-shift'):
                    print(f"  <{elem.tag}> {elem.text or ''} {dict(elem.attrib)}")
EOF
```
