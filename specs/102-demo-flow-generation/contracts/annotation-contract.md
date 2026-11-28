# Contract: Demo-Relevant Control Annotations

**Feature**: `102-demo-flow-generation`  
**Applies to**: `frontend/src/components/LandingScreen.tsx`, `frontend/src/components/TempoMetronomeControl.tsx`, `frontend/src/components/plugins/ScoreSelectorPlugin.tsx`, `frontend/plugins/play-score/playbackToolbar.tsx`, `frontend/src/i18n/locales/{en,es}.json`, `frontend/e2e/annotation-coverage.spec.ts`, `frontend/scripts/check-demo-annotations.mjs`

This contract defines what the application MUST expose for the controls the demos use. It is written so the coverage guard can be authored before the annotations are fixed, and so the derived index has a stable shape to scan. All names are localized; English strings below are illustrative.

---

## 1. What every demo-relevant control MUST expose

| Attribute | Requirement |
|-----------|-------------|
| `role` | A correct semantic role (usually `button`, `link`, `menuitem`, or `dialog`). A native `<button>`/`<a>` satisfies this. |
| accessible name | A meaningful name: the visible localized text, or `aria-label` from i18n when there is no text. MUST NOT be empty. |
| `data-testid` | A stable, unique, kebab-case handle. This is the primary lookup key and the diff-stable identity. |

**Rules**
- Use ARIA for real semantics, not test prose: do **not** put capability descriptions in `aria-roledescription`/`aria-description` (research D5).
- Prefer `data-testid` over class/`:has-text` selectors (replace selectors like `.score-selector-item__btn:has-text("Für Elise")`).
- A control that is demo-relevant but currently has no stable handle MUST gain one; the coverage gap is recorded in the index/report until it does.

---

## 2. Surfaces in scope (initial set)

| Surface | Owner | Required hooks |
|---------|-------|----------------|
| Plugin launcher cards | `LandingScreen.tsx` | `data-testid="plugin-launch-<pluginId>"` (for example `plugin-launch-play-score`), role `button`, accessible name = plugin title. |
| Score selection rows | `ScoreSelectorPlugin.tsx` | Per-row `data-testid` (stable per score), role `button` or `option`, accessible name = score title (for example "Für Elise"). Container keeps `data-testid="score-selector-dialog"` with role `dialog`. |
| Play Score toolbar — Play | `playbackToolbar.tsx` | role `button`, accessible name `play_score.toolbar.play_aria` ("Play"), within `[role="toolbar"]`. |
| Play Score toolbar — Stop | `playbackToolbar.tsx` | role `button`, accessible name `play_score.toolbar.stop_aria` ("Stop"), within `[role="toolbar"]`. |
| Tempo widget — decrease | `TempoMetronomeControl.tsx` | `data-testid="tempo-minus"`, role `button`, accessible name `play_score.toolbar.tempo_decrease` ("Decrease tempo"). |
| Tempo widget — display | `TempoMetronomeControl.tsx` | `data-testid="tempo-display"`, exposes the BPM readout in its accessible name/text. |
| Tempo widget — increase | `TempoMetronomeControl.tsx` | `data-testid="tempo-plus"`, role `button`, accessible name `play_score.toolbar.tempo_increase` ("Increase tempo"). |
| Metronome subdivision | `TempoMetronomeControl.tsx` | role `button`, accessible name matching `/metronome subdivision/i`; menu items `role="menuitem"`. |
| Phrases toggle | `ScoreRendererPlugin.tsx` | `data-testid="score-phrases-toggle"`, role `button`, accessible name `score.phrases.show_aria` / `hide_aria` ("Show phrases" / "Hide phrases"). |
| Previous phrase | `ScoreRendererPlugin.tsx` | `data-testid="score-phrases-prev"`, role `button`, accessible name `score.phrases.prev_aria` ("Previous phrase"). |
| Next phrase | `ScoreRendererPlugin.tsx` | `data-testid="score-phrases-next"`, role `button`, accessible name `score.phrases.next_aria` ("Next phrase"). |
| Measure note glyphs | `RenderingPipeline.ts` (renderer) | each note glyph carries `data-measure="N"` and `aria-label="Measure N"` — purely descriptive, added in the SVG (no new handler, no `tabindex`); tapping a glyph keeps its existing seek+play behaviour. Numbering is per-system from the bar lines; the lookup templates it as the `measure-<n>` family. |

> Additional surfaces may be added as the demo catalogue grows; each addition extends this table and the coverage guard.

---

## 3. Coverage guard

**`frontend/e2e/annotation-coverage.spec.ts`** — for each control in the table above, assert it:
1. is reachable by `getByTestId(...)`, and
2. has the expected `role` and a non-empty accessible name, and
3. is reachable by `getByRole(role, { name })` (proving role+name matching works).

**`frontend/scripts/check-demo-annotations.mjs`** — a static check over the source that fails when a listed control loses its `data-testid` or its accessible name binding. Intended to be run from `frontend` lint/CI.

**Acceptance**: the guard fails if any demo-relevant control loses a handle (FR-017), and the derived index resolves ≥95% of listed controls (SC-005).

---

## 4. i18n

- New accessible names use i18n keys; `en.json` and `es.json` stay at parity (`frontend/src/i18n/locales.test.ts`).
- Name-based lookup is a secondary signal; the primary handle is `data-testid`, so a non-English demo still resolves where testids exist (spec Edge Case "Localized interface").
