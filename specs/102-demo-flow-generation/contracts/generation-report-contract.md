# Contract: Generation Report

**Feature**: `102-demo-flow-generation`  
**Producer**: `demos/src/generate/report.ts`, emitted by the generation workflow  
**Consumers**: the demo author (review), the quickstart verification (SC-001/SC-002/SC-008)

The report lets the author judge a draft without reading the flow in full, and records the evidence the success criteria are measured against.

---

## 1. Shape

```json
{
  "flowId": "play-a-score-tempo",
  "elapsedMs": 7400,
  "lookupMs": 180,
  "stepsProduced": 14,
  "resolved": [
    { "step": "open Play Score", "target": "plugin-launch-play-score" },
    { "step": "raise the tempo", "target": "tempo-plus" }
  ],
  "unresolved": [
    { "step": "open the settings tab", "reason": "missing", "candidates": ["play-score/play", "landing/plugin-launch-play-score"] }
  ],
  "gaps": ["No annotated control for \"settings tab\" in screen 'play-score'."]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `flowId` | string | yes | The produced flow (must not collide with an existing flow, FR-012). |
| `elapsedMs` | number | yes | Goal submission → flow file written (SC-001). |
| `lookupMs` | number | yes | Time spent in the deterministic element lookup (research D7). |
| `stepsProduced` | number | yes | Total steps written to the flow. |
| `resolved` | `{ step: string; target: string }[]` | yes | Each resolved step and the control it targets (SC-008). |
| `unresolved` | `{ step: string; reason: string; candidates: string[] }[]` | yes | Each flagged step; `reason` names why. |
| `gaps` | string[] | yes | Annotation gaps to close (spec Edge Case "Control is not annotated"). |

---

## 2. Rules

- **No hidden guesses**: every `unresolved` entry corresponds to a phrase that produced no target; the flow contains no step for it (FR-006, SC-003).
- **Report completeness**: `resolved.length + unresolved.length` covers every goal phrase that maps to a control interaction (SC-008).
- **Gaps actionable**: each `gaps` line names the phrase and the screen where an annotation is missing, so the author can add a handle and refresh the index.
- **Timing honesty**: `elapsedMs` is wall-clock from submission to file written; `lookupMs` is the deterministic part, so a missed target can be attributed to lookup or to the model (D7).
- **Idempotence**: running twice on the same goal yields the same `resolved` targets, allowing for controls added in between (FR-015).
