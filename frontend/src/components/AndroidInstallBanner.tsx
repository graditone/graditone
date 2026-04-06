import { useState } from 'react';
import { useTranslation } from '../i18n/index';
import './AndroidInstallBanner.css';

/**
 * AndroidInstallBanner Component
 *
 * Feature 040: Android App Distribution — Play Store install prompt
 *
 * Shows a dismissible banner to Android browser users who haven't installed
 * Graditone from Google Play. Hidden when:
 * - Not on Android
 * - Already in standalone/TWA mode (app is installed)
 * - User has dismissed it before
 */

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.graditone.app';
const DISMISS_KEY = 'android-install-banner-dismissed';

export const AndroidInstallBanner: React.FC = () => {
  const { t } = useTranslation()
  const [visible] = useState(() => {
    // Must be Android
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return false;

    // Already installed as TWA / standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return false;

    // User already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return false;

    return true;
  });

  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="android-install-banner" role="banner" aria-label={t('android_install.banner_aria')}>
      <div className="android-install-banner__icon" aria-hidden="true">🎵</div>
      <div className="android-install-banner__text">
        <span className="android-install-banner__title">{t('android_install.title')}</span>
        <span className="android-install-banner__subtitle">{t('android_install.subtitle')}</span>
      </div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="android-install-banner__cta"
        aria-label={t('android_install.cta_aria')}
      >
        {t('android_install.cta')}
      </a>
      <button
        type="button"
        className="android-install-banner__dismiss"
        onClick={handleDismiss}
        aria-label={t('android_install.dismiss_aria')}
      >
        ✕
      </button>
    </div>
  );
};
