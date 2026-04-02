#!/usr/bin/env python3
"""Analyze Arabesque phrase structure: slurs, hard boundaries, and expected phrases."""
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
    print(f"Total measures: {len(measures)}\n")
    
    print("=== Hard Boundaries (barlines, time/key changes) ===")
    for m in measures:
        mn = m.get("number")
        info = []
        for bl in m.findall(f"{ns}barline"):
            loc = bl.get("location", "right")
            rep = bl.find(f"{ns}repeat")
            volta = bl.find(f"{ns}ending")
            if rep is not None:
                info.append(f"repeat-{rep.get('direction')}@{loc}")
            if volta is not None:
                info.append(f"volta-{volta.get('type')}#{volta.get('number')}@{loc}")
        for attr in m.findall(f"{ns}attributes"):
            ts = attr.find(f"{ns}time")
            ks = attr.find(f"{ns}key")
            if ts is not None:
                beats = ts.find(f"{ns}beats").text
                bt = ts.find(f"{ns}beat-type").text
                info.append(f"time={beats}/{bt}")
            if ks is not None:
                fifths = ks.find(f"{ns}fifths").text
                info.append(f"key={fifths}")
        if info:
            print(f"  m.{mn}: {', '.join(info)}")
    
    print("\n=== Slurs in Staff 1 (voice 0) ===")
    slur_arcs = []
    active = {}  # slur_number -> start_measure
    for mi, m in enumerate(measures):
        mn = int(m.get("number"))
        for n in m.findall(f"{ns}note"):
            staff_el = n.find(f"{ns}staff")
            staff = staff_el.text if staff_el is not None else "1"
            if staff != "1":
                continue
            for nt in n.findall(f"{ns}notations"):
                for s in nt.findall(f"{ns}slur"):
                    stype = s.get("type")
                    snum = s.get("number", "1")
                    p = n.find(f"{ns}pitch")
                    pname = p.find(f"{ns}step").text + p.find(f"{ns}octave").text if p is not None else "R"
                    if stype == "start":
                        active[snum] = (mn - 1, pname)  # 0-based measure
                    elif stype == "stop" and snum in active:
                        start_m, start_p = active.pop(snum)
                        end_m = mn - 1  # 0-based
                        slur_arcs.append((start_m, end_m))
                        print(f"  Slur {snum}: m.{start_m+1}({start_p}) → m.{end_m+1}({pname})")
    
    # Check for dangling starts
    for snum, (sm, sp) in active.items():
        print(f"  Slur {snum}: m.{sm+1}({sp}) → NOT CLOSED")
    
    print("\n=== Expected Phrase Merging (slur_next chain simulation) ===")
    # Sort and merge adjacent/overlapping slurs
    slur_arcs.sort()
    merged = []
    for (s, e) in slur_arcs:
        if merged and s <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    
    print("Merged slur ranges (0-based):")
    for (s, e) in merged:
        print(f"  m.{s+1} - m.{e+1}  ({e-s+1} measures)")
    
    total = len(measures)
    covered = set()
    for (s, e) in merged:
        covered.update(range(s, e + 1))
    uncovered = sorted(set(range(total)) - covered)
    
    if uncovered:
        print(f"\nUncovered measures (0-based, will use fallback 4-measure grouping):")
        # Convert to runs
        runs = []
        start = uncovered[0]
        for i in range(1, len(uncovered)):
            if uncovered[i] != uncovered[i-1] + 1:
                runs.append((start, uncovered[i-1]))
                start = uncovered[i]
        runs.append((start, uncovered[-1]))
        for (s, e) in runs:
            print(f"  m.{s+1} - m.{e+1}  ({e-s+1} measures) → fallback 4-measure groups")


if __name__ == "__main__":
    analyze()
