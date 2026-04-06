/**
 * GuidePlugin.tsx — Feature 001-docs-plugin: Graditone Documentation Plugin
 *
 * Stateless React component rendering the complete Guide view.
 * Single scrollable page with five sections: overview, playback, practice,
 * train, and MusicXML loading.
 *
 * Receives no props — all content is static and fully offline (FR-010, FR-011).
 * CSS uses --color-* custom properties so the active landing theme cascades in
 * automatically (same pattern as TrainPlugin.css and plugin-dialog.css).
 *
 * All user-facing text is translated via the i18n module (Feature 073).
 * Rich content (bold, links, code) uses dangerouslySetInnerHTML with
 * HTML from our own static translation catalogs (safe — not user input).
 */

import { useTranslation } from '../../src/i18n/index';
import './GuidePlugin.css';

export function GuidePlugin() {
  const { t } = useTranslation();

  return (
    <div className="guide-plugin">
      <div className="guide-plugin__inner">

      {/* ── Section 1: What is Graditone? ─────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-what">
        <h2 id="guide-h-what">{t('guide.what.heading')}</h2>
        <p>{t('guide.what.p1')}</p>
        <p>{t('guide.what.p2')}</p>
        <p dangerouslySetInnerHTML={{ __html: t('guide.what.p3') }} />
      </section>

      {/* ── Section 2: Playing a Score ───────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-play">
        <h2 id="guide-h-play">{t('guide.play.heading')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('guide.play.intro') }} />
        <ul>
          <li dangerouslySetInnerHTML={{ __html: t('guide.play.tap_note') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.play.longpress_note') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.play.longpress_second') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.play.tap_loop') }} />
        </ul>
        <p>{t('guide.play.tempo')}</p>
      </section>

      {/* ── Section 3: Practice Mode ──────────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-practice">
        <h2 id="guide-h-practice">{t('guide.practice.heading')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('guide.practice.intro') }} />
        <ol>
          <li>{t('guide.practice.step1')}</li>
          <li>{t('guide.practice.step2')}</li>
          <li dangerouslySetInnerHTML={{ __html: t('guide.practice.step3') }} />
          <li>{t('guide.practice.step4')}</li>
          <li>{t('guide.practice.step5')}</li>
        </ol>
        <p>{t('guide.practice.freeplay')}</p>
      </section>

      {/* ── Section 4: Train ──────────────────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-train">
        <h2 id="guide-h-train">{t('guide.train.heading')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('guide.train.intro') }} />
        <p dangerouslySetInnerHTML={{ __html: t('guide.train.complexity') }} />
        <ul>
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.low') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.mid') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.high') }} />
        </ul>
        <p>{t('guide.train.level_remembered')}</p>
        <p dangerouslySetInnerHTML={{ __html: t('guide.train.modes') }} />
        <ul>
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.step') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.flow') }} />
        </ul>
        <p dangerouslySetInnerHTML={{ __html: t('guide.train.presets') }} />
        <ul>
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.random') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.c4scale') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.train.score_preset') }} />
        </ul>
        <p dangerouslySetInnerHTML={{ __html: t('guide.train.input') }} />
      </section>

      {/* ── Section 5: Loading a Score ───────────────────────────────────── */}
      <section className="guide-section" aria-labelledby="guide-h-loading">
        <h2 id="guide-h-loading">{t('guide.loading.heading')}</h2>
        <p dangerouslySetInnerHTML={{ __html: t('guide.loading.formats') }} />
        <p dangerouslySetInnerHTML={{ __html: t('guide.loading.preloaded') }} />
        <p dangerouslySetInnerHTML={{ __html: t('guide.loading.own_heading') }} />
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('guide.loading.step1') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.loading.step2') }} />
          <li dangerouslySetInnerHTML={{ __html: t('guide.loading.step3') }} />
          <li>{t('guide.loading.step4')}</li>
        </ol>
        <p dangerouslySetInnerHTML={{ __html: t('guide.loading.sources') }} />
      </section>

      </div>
    </div>
  );
}
