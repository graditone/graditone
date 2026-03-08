import { useState } from 'react';
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
    <div className="android-install-banner" role="banner" aria-label="Install Graditone from Google Play">
      <div className="android-install-banner__icon" aria-hidden="true">🎵</div>
      <div className="android-install-banner__text">
        <span className="android-install-banner__title">Graditone is on Google Play</span>
        <span className="android-install-banner__subtitle">Install the app for the best experience</span>
      </div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="android-install-banner__cta"
        aria-label="Get Graditone on Google Play"
      >
        Get the app
      </a>
      <button
        type="button"
        className="android-install-banner__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss Play Store banner"
      >
        ✕
      </button>
    </div>
  );
};
