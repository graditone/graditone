# Contract: Strict Tempo UI

**Feature**: `101-strict-tempo-mode`  
**Applies to**: `practiceToolbar.tsx`, `PracticeViewPlugin.tsx`, `ResultsOverlay.tsx`, `PracticeTimingDetails.tsx`, `PracticeViewPlugin.css`, `en.json`, `es.json`

This contract describes the user-visible surfaces and their stable test hooks. It is written so the UI tests can be authored before the implementation. All strings are localized; the English text below is illustrative, not a hard-coded value.

---

## 1. Toolbar — strict indicator

**Owner**: `PracticeToolbar` (props supplied by `PracticeViewPlugin`)

**Props**

```ts
interface PracticeToolbarProps {
  // ...existing...
  readonly isFreePractice?: boolean;
  readonly strictTempoActive?: boolean;
  readonly strictFailureCount?: number;
}
```

**Visibility**

- Shown only when `strictTempoActive === true` **and** `isFreePractice !== true`.
- Hidden when the metronome is off, during Free Practice, and when `strictTempoActive` is false.
- Visible from the moment Score Practice starts with the metronome armed/active, before the first note (count `0/3`).

**Content**

| State | Text (en) | Visual |
|-------|-----------|--------|
| 0 failures | `Strict 0/3` | Accent/neutral badge |
| 1 failure | `Strict 1/3` | Warning badge |
| 2 failures | `Strict 2/3` | Danger badge |
| 3 failures | Transient only (`Strict 3/3`) | Results overlay opens immediately; the badge is not expected to remain interactive |

**Markup / test hooks**

```tsx
<span
  className={`practice-plugin__strict-badge practice-plugin__strict-badge--${level}`}
  data-testid="strict-tempo-indicator"
  data-failures={count}
  aria-live="polite"
  title={t('practice.toolbar.strict_tempo_title', { n: count })}
>
  {t('practice.toolbar.strict_tempo', { n: count })}
</span>
```

Where `level` is `none` (0), `warn` (1), or `danger` (2+).

**Accessibility**

- `aria-live="polite"` so the count is announced when it changes.
- The badge is informational; it is not a button and must not take focus.
- The title includes the full explanation (“Metronome strict tempo — N of 3 consecutive timing misses”).

---

## 2. Live timing feedback

**Owner**: existing `TimingFeedbackOverlay`; value computed in `PracticeViewPlugin.tsx`

- One feedback flash per finalized result, as today. It auto-dismisses after the existing interval.
- Hidden when the results overlay is visible, during replay, and during Free Practice.

**Displayed value**

| Result | Value |
|--------|-------|
| Strict onset failure (`strictFailure && outcome === 'correct-late'`) | `formatStateLabel(beatDeltaMs ?? relativeDeltaMs)` |
| Strict early release (`strictFailure && outcome === 'early-release'`) | `formatStateLabel(-(requiredHoldMs - holdDurationMs))` — the shortfall, negative |
| Legacy `correct-late` / `early-release` (no `strictFailure`) | Existing `formatStateLabel(relativeDeltaMs)` behavior |
| `correct`, `wrong`, `auto-advanced` | No timing flash |

- A strict onset failure must flash even when the legacy relative delta is below 500 ms.
- On the third failure the session stops; the results overlay is the primary explanation. The live flash may be superseded by the overlay and is not required to remain visible.
- The value is rounded to an integer before formatting.

---

## 3. Results overlay — complete results

**Owner**: `ResultsOverlay.tsx` + `PracticeTimingDetails.tsx`

### 3.1 Strict stats

- Existing stats remain: Notes, Correct, Off-beat, Wrong.
- Add a conditional fifth stat when `practiceReport.strictFailureCount > 0`:

```tsx
<div className="practice-results__stat" data-testid="strict-fail-count">
  <span className="practice-results__stat-value practice-results__stat-value--error">
    {practiceReport.strictFailureCount}
  </span>
  <span className="practice-results__stat-label">{t('practice.results.tempo_failures')}</span>
</div>
```

- The stats container must wrap on narrow screens (`.practice-results__stats { flex-wrap: wrap; }`).

### 3.2 Timing table

- Reuse the existing collapsible table; extract it into `PracticeTimingDetails` and render it in both complete and partial branches.
- Columns: note number (1-based), expected, played, status, wrong tries, timing Δ.
- Timing value: `beatDeltaMs ?? relativeDeltaMs`; render `—` for a zero grace delta where the existing UI renders a dash.
- Strict failure rows get `practice-results__row--strict-failure` plus the existing outcome class. The row is visually distinct (left rule / tinted background) and includes the signed delta.
- Status:
  - in-time / grace → `Correct`
  - strict onset failure → the signed beat delta (existing late rendering)
  - strict early release → `Released {ms} ms early` using `requiredHoldMs - holdDurationMs`
  - legacy early release → existing behavior (`formatStateLabel(relativeDeltaMs)`), preserving current tests
- The table remains scrollable horizontally on narrow screens.

### 3.3 Delay chart

- Reuse the existing SVG delay chart in `PracticeTimingDetails`.
- X axis: elapsed practice time; Y axis: signed timing deviation.
- Point value: `beatDeltaMs ?? relativeDeltaMs`.
- Point styling:
  - strict failure → danger/red dot
  - legacy late → existing warning/orange dot
  - normal → existing neutral dot
- Render when at least two results exist. The chart is inside the existing collapsible details section.
- Test hooks: retain `.practice-results__chart` and its `aria-label`; add `data-strict-failure="true"` on failing points if the implementation uses per-point elements.

### 3.4 Actions

- Existing actions (Replay, Repractice, Save, Session) remain.
- The complete overlay is shown only when no partial record is active:
  `showComplete = resultsOverlayVisible && practiceReport && (mode === 'complete' || (mode === 'inactive' && !!performanceRecord && !partialPerformanceRecord))`.
- A stale complete record must not mask a tempo-stop partial.

---

## 4. Results overlay — tempo-stop partial

**Owner**: `ResultsOverlay.tsx` partial branch

### 4.1 Banner

For `partialPerformanceRecord.stopReason === 'tempo'`, replace the existing “Stopped at note X of Y” badge with:

```tsx
<div
  className="practice-results__tempo-stop"
  data-testid="tempo-stop-banner"
  role="status"
>
  <div className="practice-results__tempo-stop-title">
    {t('practice.results.tempo_stopped')}
  </div>
  <div className="practice-results__tempo-stop-hint">
    {t('practice.results.tempo_stopped_hint')}
  </div>
  <ul className="practice-results__tempo-stop-list">
    {lastThreeFailures.map((r, i) => (
      <li key={`${r.noteIndex}-${i}`} data-testid="tempo-stop-failure">
        {t('practice.results.tempo_failure_item', {
          note: String(r.noteIndex + 1),
          delta: formatFailure(r),
        })}
      </li>
    ))}
  </ul>
</div>
```

- `lastThreeFailures = results.filter(r => r.strictFailure).slice(-3)`.
- Exactly three items are expected for a genuine tempo stop; if data is incomplete, show the available items rather than fabricating.
- `formatFailure(r)`:
  - early release with `requiredHoldMs > 0` → `t('practice.results.released_early', { ms: String(Math.round(r.requiredHoldMs - r.holdDurationMs)) })`
  - otherwise → `formatStateLabel(r.beatDeltaMs ?? r.relativeDeltaMs)`
- The banner is the first content block after the header, before the score/stats.
- For manual partials and old records, the existing stopped-at badge remains; no tempo banner.

### 4.2 Details and chart

- Render `PracticeTimingDetails` for the partial results, below the time comparison.
- Strict failure rows/dots are marked exactly as in the complete overlay.
- The three failing notes are visually identifiable in both the banner and the table.
- The partial overlay must not be limited to score/stats/time comparison.

### 4.3 Actions

For `stopReason === 'tempo'`, add an action row after the details:

```tsx
<div className="practice-results__actions practice-results__actions--partial">
  <button
    className="practice-results__repractice-btn"
    data-testid="tempo-stop-repractice"
    onClick={handleRepractice}
    aria-label={t('practice.results.repractice_aria')}
  >
    ↺ Repractice
  </button>
  {onSave && (
    <button
      className="practice-results__save-btn"
      data-testid="tempo-stop-save"
      onClick={handleSaveClick}
      disabled={isSaved || isSaving}
      aria-label={isSaved ? t('practice.results.saved_aria') : t('practice.results.save_aria')}
    >
      {isSaved ? '✓ Saved' : '💾 Save'}
    </button>
  )}
  {onReturnToSession && (
    <button
      className="practice-results__session-btn"
      data-testid="tempo-stop-session"
      onClick={onReturnToSession}
      aria-label={t('practice.results.session_aria')}
    >
      ↩ Session
    </button>
  )}
</div>
```

- Repractice starts a new session; because the metronome is re-armed by `onSessionEnd`, `START` resets the strict count and the badge returns to `0/3`.
- Save persists the partial record with `stopReason: 'tempo'`; the button reflects `isSaved`/`isSaving` and shows the existing save error if it fails.
- Session returns to the originating session when the practice was launched from one.
- The existing close (`onDismiss`) remains available. Dismissing keeps the metronome enabled/armed so pressing Practice starts another strict session.
- The partial overlay must not show these actions for manual partials (preserve existing behavior) unless the product later chooses to broaden them.

### 4.4 Zero-progress branch

A tempo stop cannot occur with zero results, so the existing zero-progress partial branch is unchanged.

---

## 5. Localization keys

Add to both `frontend/src/i18n/locales/en.json` and `es.json`:

| Key | English | Spanish |
|-----|---------|---------|
| `practice.toolbar.strict_tempo` | `Strict {n}/3` | `Estricto {n}/3` |
| `practice.toolbar.strict_tempo_title` | `Metronome strict tempo — {n} of 3 consecutive timing misses` | `Tempo estricto del metrónomo — {n} de 3 fallos de tempo consecutivos` |
| `practice.results.tempo_stopped` | `Tempo not followed` | `No seguiste el tempo` |
| `practice.results.tempo_stopped_hint` | `Practice stopped after 3 consecutive timing misses.` | `La práctica se detuvo tras 3 fallos de tempo consecutivos.` |
| `practice.results.tempo_failures` | `Tempo fails` | `Fallos de tempo` |
| `practice.results.tempo_failure_item` | `Note {note}: {delta}` | `Nota {note}: {delta}` |
| `practice.results.released_early` | `Released {ms} ms early` | `Soltada {ms} ms antes` |

- The existing `practice.results.repractice_aria`, `saved_aria`, `save_aria`, and `session_aria` keys are used for accessible names. Visible action labels follow the complete overlay’s existing pattern (`↺ Repractice`, `💾 Save`/`✓ Saved`, `↩ Session`). No new visible action keys are required; if the implementation chooses to localize the visible labels, add `practice.results.repractice`, `save`, `saved`, and `session` to both catalogs as a separate consistency improvement.
- `frontend/src/i18n/locales.test.ts` must pass (identical key sets).
- `TranslationKey` is derived from `en.json`; the new keys must be used through `t(...)`, not hard-coded.

---

## 6. Styling contract

Add to `PracticeViewPlugin.css`:

- `.practice-plugin__strict-badge` — compact pill in the toolbar; `white-space: nowrap`; uses theme accent.
- `.practice-plugin__strict-badge--warn` — warning color at 1 failure.
- `.practice-plugin__strict-badge--danger` — danger color at 2+ failures.
- `.practice-results__tempo-stop` — warning-tinted banner with border and radius.
- `.practice-results__tempo-stop-title` — bold heading.
- `.practice-results__tempo-stop-hint` — secondary text.
- `.practice-results__tempo-stop-list` — compact list of the three failures.
- `.practice-results__row--strict-failure` — visible marker (left rule or tinted background) on strict rows.
- `.practice-results__stats { flex-wrap: wrap; }` — allow the conditional fifth stat.
- `.practice-results__actions--partial` — action row for the tempo-stop partial.

The styles must respect the existing theme variables and remain legible in light/dark themes. No layout changes to the score renderer.

---

## 7. Accessibility

- Toolbar badge: `aria-live="polite"`, no focus, full text in `title`.
- Tempo banner: `role="status"` (announced when the overlay opens), meaningful list semantics for the three failures.
- Results table: existing table semantics preserved; strict-failure rows must not rely on color alone (the status/delta text carries the meaning).
- Chart: existing accessible label preserved; the table is the accessible alternative for the same data.
- Buttons: real `<button>` elements with localized accessible names; disabled states reflected with `disabled`.
- Focus: when the results overlay opens after a tempo stop, focus moves to the overlay's primary heading/close button as it does today; do not trap focus in the banner.

---

## 8. Test selection

UI tests must cover at least:

1. Badge hidden when metronome off / Free Practice; shown at `0/3`; updates to `1/3` and `2/3`; classes/levels.
2. Live flash for a strict onset failure below the legacy 500 ms threshold; early-release shortfall.
3. Tempo-stop partial: banner text, exactly three failure items with note numbers and signed values, table/chart present, Repractice/Save/Session actions.
4. Tempo-stop partial Save calls `onSave`; Repractice calls `onRepractice`; Session calls `onReturnToSession`.
5. Complete overlay: “Tempo fails” stat only when `strictFailureCount > 0`; strict rows/dots marked; no tempo banner.
6. Manual partial with 1–2 strict failures: no tempo banner, existing stopped-at badge, no new tempo action row; strict rows still marked.
7. Partial-over-stale-complete precedence: both records present → tempo partial wins.
8. Old saved partial without `stopReason` → manual presentation.
9. en/es key parity.
