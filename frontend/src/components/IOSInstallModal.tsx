import { useState } from 'react';
import { useTranslation } from '../i18n/index';
import { scopedGetItem, scopedSetItem } from '../services/profiles/profileStorage';
import './IOSInstallModal.css';

// Extend Navigator interface for iOS-specific standalone property
interface IOSNavigator extends Navigator {
  standalone?: boolean;
}

/**
 * IOSInstallModal Component
 * 
 * Feature 012: PWA Distribution - iOS Install Instructions
 * 
 * Displays manual install instructions for iOS/iPad users who visit the PWA
 * in Safari but haven't added it to their home screen. iOS doesn't support
 * the BeforeInstallPrompt API, so we provide visual instructions.
 * 
 * Detection Logic:
 * - Shows if iOS/iPadOS detected (navigator.platform check)
 * - Hides if already in standalone mode (installed)
 * - Respects localStorage dismissal (user clicked "Got it")
 * 
 * Usage:
 * <IOSInstallModal />
 */
export const IOSInstallModal: React.FC = () => {
  const { t } = useTranslation()
  // Compute initial state to avoid setState in effect
  const [showModal, setShowModal] = useState(() => {
    // Detect iOS (iPad, iPhone, iPod) or iPad Pro with touchscreen
    const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Check if user is already in standalone mode (PWA installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as IOSNavigator).standalone === true;
    
    // Show modal only if iOS and not installed, and user hasn't dismissed it
    if (isIOS && !isStandalone) {
      const dismissed = scopedGetItem('ios-install-dismissed');
      return !dismissed;
    }
    return false;
  });

  const handleDismiss = () => {
    // Remember dismissal to avoid annoying user
    scopedSetItem('ios-install-dismissed', 'true');
    setShowModal(false);
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="ios-install-modal">
      <div className="ios-install-modal__backdrop" onClick={handleDismiss} />
      <div className="ios-install-modal__content">
        <h2 className="ios-install-modal__title">{t('ios_install.title')}</h2>
        <p className="ios-install-modal__description">
          {t('ios_install.step_intro')}
        </p>
        <ol className="ios-install-modal__steps">
          <li>{t('ios_install.step_share')} <span className="ios-install-modal__icon" role="img" aria-label={t('ios_install.step_share_aria')}>⎋</span> at the top</li>
          <li>{t('ios_install.step_add')}</li>
          <li>{t('ios_install.step_confirm')}</li>
        </ol>
        <button 
          className="ios-install-modal__button" 
          onClick={handleDismiss}
          aria-label={t('ios_install.dismiss_button_aria')}
        >
          {t('ios_install.dismiss_button')}
        </button>
      </div>
    </div>
  );
};
