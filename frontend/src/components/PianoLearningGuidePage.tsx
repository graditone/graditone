import { useTranslation } from '../i18n/index';
import './PianoLearningGuidePage.css';

export interface PianoLearningGuidePageProps {
  onBack: () => void;
}

export function PianoLearningGuidePage({ onBack }: PianoLearningGuidePageProps) {
  const { t } = useTranslation();

  return (
    <div className="piano-guide">
      {/* Page header */}
      <div className="piano-guide__header">
        <button
          type="button"
          className="piano-guide__back-btn"
          onClick={onBack}
          aria-label={t('guide.piano.back_button')}
        >
          {t('guide.piano.back_button')}
        </button>
        <h1 className="piano-guide__title">{t('guide.piano.page_title')}</h1>
        <p className="piano-guide__subtitle">{t('guide.piano.page_subtitle')}</p>
      </div>

      {/* Core Practice Features */}
      <section className="piano-guide__section piano-guide__highlights">
        <h2>{t('guide.piano.section_highlights_title')}</h2>
        <div className="piano-guide__cards">
          <div className="piano-guide__card">
            <h3>{t('guide.piano.highlight_notes_title')}</h3>
            <p>{t('guide.piano.highlight_notes_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.highlight_tempo_title')}</h3>
            <p>{t('guide.piano.highlight_tempo_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.highlight_loops_title')}</h3>
            <p>{t('guide.piano.highlight_loops_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.highlight_vkeyboard_title')}</h3>
            <p>{t('guide.piano.highlight_vkeyboard_benefit')}</p>
          </div>
        </div>
      </section>

      {/* Piano-Specific Features */}
      <section className="piano-guide__section piano-guide__piano-features">
        <h2>{t('guide.piano.section_piano_title')}</h2>
        <div className="piano-guide__cards">
          <div className="piano-guide__card">
            <h3>{t('guide.piano.piano_stacked_title')}</h3>
            <p>{t('guide.piano.piano_stacked_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.piano_dynamics_title')}</h3>
            <p>{t('guide.piano.piano_dynamics_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.piano_onehand_title')}</h3>
            <p>{t('guide.piano.piano_onehand_benefit')}</p>
          </div>
          <div className="piano-guide__card">
            <h3>{t('guide.piano.piano_midi_title')}</h3>
            <p>{t('guide.piano.piano_midi_benefit')}</p>
          </div>
        </div>
        <p className="piano-guide__prerequisite">{t('guide.piano.piano_midi_prerequisite')}</p>
      </section>

      {/* Practice Workflow */}
      <section className="piano-guide__section piano-guide__workflow">
        <h2>{t('guide.piano.section_workflow_title')}</h2>
        <ol className="piano-guide__steps">
          <li>{t('guide.piano.workflow_step1')}</li>
          <li>{t('guide.piano.workflow_step2')}</li>
          <li>{t('guide.piano.workflow_step3')}</li>
          <li>{t('guide.piano.workflow_step4')}</li>
          <li>{t('guide.piano.workflow_step5')}</li>
          <li>{t('guide.piano.workflow_step6')}</li>
        </ol>
      </section>

      {/* Practice Tips */}
      <section className="piano-guide__section piano-guide__tips">
        <h2>{t('guide.piano.section_tips_title')}</h2>
        <ul className="piano-guide__tips-list">
          <li>{t('guide.piano.tip1')}</li>
          <li>{t('guide.piano.tip2')}</li>
          <li>{t('guide.piano.tip3')}</li>
          <li>{t('guide.piano.tip4')}</li>
        </ul>
      </section>
    </div>
  );
}

export default PianoLearningGuidePage;
