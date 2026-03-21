#!/usr/bin/env python3
"""Inspect rest elements in M34-M36."""
import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile("scores/Chopin_NocturneOp9No2.mxl") as z:
    tree = ET.parse(z.open("score.xml"))

root = tree.getroot()
ns = root.tag.split("}")[0].strip("{") if "}" in root.tag else ""

def find(el, tag):
    return el.find("{%s}%s" % (ns, tag)) if ns else el.find(tag)

parts = [el for el in root if (el.tag.split("}")[-1] if "}" in el.tag else el.tag) == "part"]
part = parts[0]
print(f"Found part: {part.get('id')}, children: {len(list(part))}")

# Iterate child elements regardless of namespace
measures = [ch for ch in part if ch.tag.endswith("measure") or "measure" in ch.tag]
print(f"Total measures: {len(measures)}")

for m in measures:
    mnum = m.get("number")
    if mnum in ("34", "35", "36"):
        print(f"\n=== M{mnum} ===")
        for elem in m:
            etag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if etag == "note":
                rest_el = None
                voice_el = None
                staff_el = None
                type_el = None
                dur_el = None
                for child in elem:
                    ctag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                    if ctag == "rest":
                        rest_el = child
                    elif ctag == "voice":
                        voice_el = child
                    elif ctag == "staff":
                        staff_el = child
                    elif ctag == "type":
                        type_el = child
                    elif ctag == "duration":
                        dur_el = child
                if rest_el is not None:
                    voice = voice_el.text if voice_el is not None else "?"
                    staff = staff_el.text if staff_el is not None else "?"
                    ntype = type_el.text if type_el is not None else "NONE"
                    dur = dur_el.text if dur_el is not None else "?"
                    measure_attr = rest_el.get("measure", "no")
                    print(f"  REST voice={voice} staff={staff} type={ntype} dur={dur} rest@measure={measure_attr}")
