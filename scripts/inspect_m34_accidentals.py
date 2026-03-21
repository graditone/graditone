#!/usr/bin/env python3
"""Inspect M34 accidentals in the Nocturne MusicXML."""
import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile("scores/Chopin_NocturneOp9No2.mxl") as z:
    tree = ET.parse(z.open("score.xml"))

root = tree.getroot()
# Detect namespace
ns_uri = ""
if "}" in root.tag:
    ns_uri = root.tag.split("}")[0].strip("{")

def find(el, tag):
    if ns_uri:
        return el.find(f"{{{ns_uri}}}{tag}")
    return el.find(tag)

def findall(el, tag):
    if ns_uri:
        return el.findall(f"{{{ns_uri}}}{tag}")
    return el.findall(tag)

parts = findall(root, ".//part")
if not parts:
    # Try without namespace prefix in XPath
    parts = root.iter()
    parts = [el for el in root.iter() if el.tag.endswith("part") and el.get("id")]
part = parts[0]

for m in list(part):
    mnum = m.get("number")
    if mnum in ("33", "34", "35", "36"):
        print(f"\n=== MEASURE {mnum} ===")
        note_idx = 0
        for elem in m:
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag == "note":
                pitch_el = find(elem, "pitch")
                rest_el = find(elem, "rest")
                acc_el = find(elem, "accidental")
                voice_el = find(elem, "voice")
                staff_el = find(elem, "staff")
                type_el = find(elem, "type")

                voice = voice_el.text if voice_el is not None else "?"
                staff = staff_el.text if staff_el is not None else "?"
                ntype = type_el.text if type_el is not None else "?"

                if rest_el is not None:
                    print(f"  [{note_idx:2d}] REST voice={voice} staff={staff} type={ntype}")
                elif pitch_el is not None:
                    step = find(pitch_el, "step")
                    octave = find(pitch_el, "octave")
                    alter = find(pitch_el, "alter")
                    s = step.text if step is not None else "?"
                    o = octave.text if octave is not None else "?"
                    a = alter.text if alter is not None else "0"
                    acc = acc_el.text if acc_el is not None else "NONE"
                    print(f"  [{note_idx:2d}] {s}{o} alter={a} acc={acc} voice={voice} staff={staff} type={ntype}")
                note_idx += 1
