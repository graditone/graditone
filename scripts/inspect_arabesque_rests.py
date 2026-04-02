#!/usr/bin/env python3
"""Inspect rest structure in Burgmuller Arabesque first two measures."""
import zipfile
import xml.etree.ElementTree as ET


def analyze():
    with zipfile.ZipFile("scores/Burgmuller_Arabesque.mxl") as z:
        with z.open("score.xml") as f:
            tree = ET.parse(f)

    root = tree.getroot()
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    part = root.findall(f"{ns}part")[0]
    measures = list(part.findall(f"{ns}measure"))

    print("=== First 12 measures: note/rest content per staff/voice ===")
    for m in measures[:12]:
        mn = m.get("number")
        notes_by_sv: dict = {}
        for n in m.findall(f"{ns}note"):
            staff_el = n.find(f"{ns}staff")
            voice_el = n.find(f"{ns}voice")
            staff = staff_el.text if staff_el is not None else "1"
            voice = voice_el.text if voice_el is not None else "1"
            key = f"s{staff}v{voice}"
            is_rest = n.find(f"{ns}rest") is not None
            dur_el = n.find(f"{ns}duration")
            dur = dur_el.text if dur_el is not None else "?"
            p = n.find(f"{ns}pitch")
            pname = p.find(f"{ns}step").text + p.find(f"{ns}octave").text if p is not None else "REST"
            chrd = "(chord)" if n.find(f"{ns}chord") is not None else ""
            if key not in notes_by_sv:
                notes_by_sv[key] = []
            notes_by_sv[key].append(f"{'REST' if is_rest else pname}[{dur}]{chrd}")

        print(f"  m.{mn}:")
        for sv, items in sorted(notes_by_sv.items()):
            print(f"    {sv}: {', '.join(items)}")


if __name__ == "__main__":
    analyze()
