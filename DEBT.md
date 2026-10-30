# Tech Debt Register

Known issues in the current codebase that we have *chosen not to fix yet*.
One row per debt item, so it can be prioritised, referenced and closed.

**Only record debt you are not fixing now.** If it is trivial or in scope,
just fix it. Record it here when it is out of scope, pre-existing, or a
deliberate trade-off — and always describe the **impact**, because that is
what drives the priority.

See the **`tech-debt`** skill (`.agents/skills/tech-debt/SKILL.md`) for the
full workflow.

## Priority scale

| Priority | Meaning | Rule of thumb |
|----------|---------|---------------|
| **P1** | High — actively causes user-visible bugs / blocks work | fix in the next few changes |
| **P2** | Medium — real risk or recurring friction, not urgent | schedule; guard against growth |
| **P3** | Low — cosmetic, or cheap to live with | fix opportunistically |

`P1` is the **most** urgent. Pick the lowest priority you can honestly
justify; when in doubt between two levels, prefer the higher (more urgent) one.

## Row format

| Column | Rule |
|--------|------|
| **ID** | Unique, semantic, kebab-case slug describing the problem (e.g. `theme-hardcoded-colors`). Never reuse an ID; retired IDs may get a `→ id` successor. |
| **Description** | What the debt is, where it lives (paths), and the scale/evidence. |
| **Impact** | Why it matters: user-visible effects, the themes/features at risk, and what it blocks. This is the prioritisation input. |
| **Priority** | `P1` / `P2` / `P3` per the scale above. |

## Open debt

| ID | Description | Impact | Priority |
|----|-------------|--------|----------|
| `theme-hardcoded-colors` | ~502 hardcoded colour literals (`#hex`, `rgb()`/`hsl()`) across 28 CSS files in `frontend/src` and `frontend/plugins` — hotspots: `practice-view-plugin/PracticeViewPlugin.css` (79), `components/ScoreViewer.css` (68), `train-view/TrainPlugin.css` (57), `App.css` (45). (`themes/landing-themes.css` is the token source and is intentionally excluded.) Tracked per-file in `frontend/scripts/theme-colors-baseline.json`. | Colours do not adapt to the 10 landing themes, producing contrast/legibility bugs (already seen: white text on light-amber accents in Saffron/Honey/Marigold; an armed metronome chip that was gold-on-purple). Makes theme work risky and every new theme a regression hunt. **Guard:** `npm run lint:colors` (ratchet) blocks *new* literals and any increase per file, so the debt cannot grow — but the 502 existing sites remain to be migrated. | P2 |

## Closed debt

| ID | Resolution | Closed |
|----|------------|--------|
| *(none yet)* | | |
