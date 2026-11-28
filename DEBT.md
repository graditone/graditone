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
| `demos-runner-port-detection` | `demos/src/run.ts` `reachable()` treats any HTTP response below 500 as "the app is up", so a 404 from another dev server on port 5174 makes the demo runner skip starting Graditone and fail at the first selector. `ensureServer()` also always spawns Vite on 5174, even when `DEMO_BASE_URL` points at another port. Observed while running `play-a-score-tempo`; worked around with a manual server on 5175 and `DEMO_BASE_URL=http://localhost:5175`. | Demo runs fail with a misleading selector timeout when another worktree's Vite server owns the port; parallel worktrees and CI machines can hit it. The flow itself is fine — only the server bootstrap is wrong. | P2 |
| `speckit-version-drift` | The installed `specify` CLI is 0.5.0 (template 1.4.5) while this repo's `.specify` commands/scripts are 1.4.6.dev0 (newer). `specify init` skips files that already exist, so an earlier re-init left a hybrid: new `resolve-template.sh`/`setup-tasks.sh` beside an old `common.sh`/`check-prerequisites.sh`/`setup-plan.sh`. Repaired 2026-11-28 (see Closed debt), but `create-new-feature.sh` and `update-agent-context.sh` are still stale (unused by the current commands). | Running `specify init --force` would overwrite the scripts with the older 1.4.5 core pack and **re-break** `/speckit.specify` (its core pack has no `resolve-template.sh` / `resolve_template_content`). Aligning the CLI to a version ≥ the project's (or pinning both together) removes the drift and makes a clean `specify init` reproduce the working setup. | P2 |
| `demo-catalog-heuristic-scan` | `demos/src/catalog/build.ts` extracts controls from JSX with regular expressions. It reliably finds static `data-testid`/`role`/`aria-label` but can miss attributes on complex JSX (conditionals, spreads, ternaries) and dynamic ids such as the plugin launcher's `` data-testid={`plugin-launch-${p.id}`} `` (covered today only because the e2e specs and existing flows spell the literal testid). The optional `snapshot.ts` accessibility-tree enrichment exists but is not wired into `catalog:build`. | The derived index can under-cover real controls, which surfaces as "unresolved" steps or a `name: null` entry even though the control is annotated. Mitigations: run the snapshot enrichment, and prefer `data-testid` over label text. Related to the demo capture port trap (`demos-runner-port-detection`), which the authoring path avoids by recording no video. | P3 |

## Closed debt

| ID | Resolution | Closed |
|----|------------|--------|
| `speckit-template-resolver-broken` | `resolve-template.sh`/`setup-tasks.sh` called `resolve_template_content`, absent from `.specify/scripts/bash/common.sh`, so `/speckit.specify` failed with `resolve_template_content: command not found`. Restored the missing resolver helpers in `common.sh` (`resolve_template`, `resolve_template_content`, `has_jq`, `json_escape`, `format_speckit_command`), made `get_feature_paths` honor `.specify/feature.json`, and aligned `check-prerequisites.sh`, `setup-plan.sh` and `setup-tasks.sh` to the 1.4.6.dev0 command contract. Verified `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.checklist` and `/speckit.analyze` prerequisites. Leftover tracked as `speckit-version-drift`. | 2026-11-28 |
