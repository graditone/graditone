#!/usr/bin/env node
/**
 * check-demo-annotations.ts — guards the demo-relevant control annotations.
 *
 * Feature 102: the application's own accessibility surface (role + accessible
 * name + a stable `data-testid`) is the source of truth for the generated demo
 * element index. If a listed control loses its handle or its accessible-name
 * binding, the derived index silently degrades; this static check fails fast so
 * annotated coverage cannot regress (spec FR-017, SC-009).
 *
 * The runtime proof lives in `e2e/annotation-coverage.spec.ts`; this is the
 * cheap, dependency-free source scan wired into `npm run lint`.
 *
 * Scope: annotation-contract.md §2. Extend CHECKS when a surface is added.
 *
 * Usage:
 *   node scripts/check-demo-annotations.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** One annotation a source file MUST keep: a human label and the pattern. */
interface Requirement {
  label: string;
  pattern: RegExp;
}

/** A source file and the annotations it must keep. */
interface FileCheck {
  file: string;
  requirements: Requirement[];
}

/** Each entry: a source file and the annotations it MUST keep. */
const CHECKS: FileCheck[] = [
  {
    file: 'src/components/LandingScreen.tsx',
    requirements: [
      {
        label: 'plugin launcher card keeps data-testid={`plugin-launch-${p.id}`}',
        pattern: /data-testid=\{`plugin-launch-\$\{p\.id\}`\}/,
      },
      {
        label: "plugin launcher card keeps an i18n accessible name (tDynamic('plugin.name.<id>'))",
        pattern: /aria-label=\{tDynamic\(`plugin\.name\.\$\{p\.id\}`/,
      },
    ],
  },
  {
    file: 'src/components/TempoMetronomeControl.tsx',
    requirements: [
      { label: 'tempo decrease keeps data-testid="tempo-minus"', pattern: /data-testid="tempo-minus"/ },
      { label: 'tempo decrease keeps an i18n name (labels.decreaseAria)', pattern: /aria-label=\{labels\.decreaseAria\}/ },
      { label: 'tempo display keeps data-testid="tempo-display"', pattern: /data-testid="tempo-display"/ },
      {
        label: 'tempo display name exposes the BPM readout (labels.metronomeAria + bpmReadout)',
        pattern: /aria-label=\{`\$\{labels\.metronomeAria\}[^`]*BPM`\}/,
      },
      { label: 'tempo increase keeps data-testid="tempo-plus"', pattern: /data-testid="tempo-plus"/ },
      { label: 'tempo increase keeps an i18n name (labels.increaseAria)', pattern: /aria-label=\{labels\.increaseAria\}/ },
      { label: 'metronome subdivision keeps data-testid="metronome-subdivision"', pattern: /data-testid="metronome-subdivision"/ },
      { label: 'metronome subdivision keeps an i18n name (labels.subdivisionAria)', pattern: /aria-label=\{labels\.subdivisionAria\}/ },
      { label: 'metronome subdivision menu items keep role="menuitem"', pattern: /role="menuitem"/ },
    ],
  },
  {
    file: 'src/components/plugins/ScoreSelectorPlugin.tsx',
    requirements: [
      { label: 'score selector dialog keeps data-testid="score-selector-dialog"', pattern: /data-testid="score-selector-dialog"/ },
      { label: 'score selector dialog keeps role="dialog"', pattern: /role="dialog"/ },
      {
        label: 'score rows keep a per-score data-testid (`score-selector-item-${entry.id}`)',
        pattern: /data-testid=\{`score-selector-item-\$\{entry\.id\}`\}/,
      },
      { label: 'score rows keep an accessible name = score title (entry.displayName)', pattern: /aria-label=\{entry\.displayName\}/ },
    ],
  },
  {
    file: 'src/components/plugins/ScoreRendererPlugin.tsx',
    requirements: [
      { label: 'phrases toggle keeps data-testid="score-phrases-toggle"', pattern: /data-testid="score-phrases-toggle"/ },
      {
        label: 'phrases toggle keeps an i18n name (score.phrases.show_aria/hide_aria)',
        pattern: /t\('score\.phrases\.(show|hide)_aria'\)/,
      },
      { label: 'previous-phrase keeps data-testid="score-phrases-prev"', pattern: /data-testid="score-phrases-prev"/ },
      { label: "previous-phrase keeps an i18n name (score.phrases.prev_aria)", pattern: /aria-label=\{t\('score\.phrases\.prev_aria'\)\}/ },
      { label: 'next-phrase keeps data-testid="score-phrases-next"', pattern: /data-testid="score-phrases-next"/ },
      { label: "next-phrase keeps an i18n name (score.phrases.next_aria)", pattern: /aria-label=\{t\('score\.phrases\.next_aria'\)\}/ },
    ],
  },
  {
    file: 'src/components/renderer/RenderingPipeline.ts',
    requirements: [
      { label: 'note glyphs carry their measure (dataset.measure)', pattern: /dataset\.measure = String\(measure\)/ },
      {
        label: 'note glyphs carry a "Measure N" aria-label',
        pattern: /setAttribute\('aria-label', `Measure \$\{measure\}`\)/,
      },
      { label: 'per-measure numbering comes from the bar lines', pattern: /firstMeasure \+ barlineXs\.filter/ },
    ],
  },
  {
    file: 'plugins/play-score/playbackToolbar.tsx',
    requirements: [
      { label: 'playback toolbar keeps role="toolbar"', pattern: /role="toolbar"/ },
      { label: 'Play keeps data-testid="play-score-play"', pattern: /data-testid="play-score-play"/ },
      { label: "Play keeps its i18n name (t('play_score.toolbar.play_aria'))", pattern: /aria-label=\{t\('play_score\.toolbar\.play_aria'\)\}/ },
      { label: 'Stop keeps data-testid="play-score-stop"', pattern: /data-testid="play-score-stop"/ },
      { label: "Stop keeps its i18n name (t('play_score.toolbar.stop_aria'))", pattern: /aria-label=\{t\('play_score\.toolbar\.stop_aria'\)\}/ },
    ],
  },
];

/** i18n keys the accessible names bind to; they must exist in both locales. */
const REQUIRED_I18N_KEYS: string[] = [
  'plugin.name.play-score',
  'score_selector.title',
  'play_score.toolbar.play_aria',
  'play_score.toolbar.stop_aria',
  'play_score.toolbar.tempo_decrease',
  'play_score.toolbar.tempo_increase',
  'play_score.toolbar.metronome_toggle_aria',
  'play_score.toolbar.metronome_sub_aria',
  'score.phrases.show_aria',
  'score.phrases.hide_aria',
  'score.phrases.prev_aria',
  'score.phrases.next_aria',
];

const LOCALES: string[] = ['src/i18n/locales/en.json', 'src/i18n/locales/es.json'];

const problems: string[] = [];

// ── Source annotations ───────────────────────────────────────────────────────

for (const { file, requirements } of CHECKS) {
  let source: string;
  try {
    source = readFileSync(join(FRONTEND_ROOT, file), 'utf8');
  } catch {
    problems.push(`${file}: file not found (expected a demo-relevant component).`);
    continue;
  }
  for (const { label, pattern } of requirements) {
    if (!pattern.test(source)) {
      problems.push(`${file}: missing — ${label}`);
    }
  }
}

// ── i18n key parity for the bound accessible names ───────────────────────────

for (const localeFile of LOCALES) {
  let catalog: Record<string, unknown>;
  try {
    catalog = JSON.parse(readFileSync(join(FRONTEND_ROOT, localeFile), 'utf8')) as Record<string, unknown>;
  } catch (err) {
    problems.push(`${localeFile}: could not be read/parsed — ${(err as Error).message}`);
    continue;
  }
  for (const key of REQUIRED_I18N_KEYS) {
    const value = catalog[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${localeFile}: missing or empty i18n key "${key}"`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error('✖ demo-annotation coverage check failed:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nEvery demo-relevant control must keep a correct role, a non-empty accessible name\n' +
      'and a stable data-testid (spec FR-007/SC-009; specs/102-demo-flow-generation/contracts/annotation-contract.md §2).\n' +
      'Fix the annotation, or extend the check if the surface legitimately changed.'
  );
  process.exit(1);
}

console.log(
  `✔ demo-annotation coverage OK (${CHECKS.length} files, ${REQUIRED_I18N_KEYS.length} i18n keys × ${LOCALES.length} locales).`
);
