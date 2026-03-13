import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './sw-registration'
import { trackInstall, trackStandaloneSession } from './analytics/index'

// NOTE: WASM layout engine is now initialized lazily by services/wasm/loader.ts
// when first needed (when LayoutView component mounts)

// Register service worker (T020-T021)
registerServiceWorker({
  onUpdate: (registration) => {
    console.log('Update available, show prompt');
    // Trigger UpdatePrompt component via custom event
    window.dispatchEvent(new CustomEvent('sw-update', { detail: registration }));
  },
  onSuccess: (registration) => {
    console.log('Service worker registered successfully');
    
    // Check for updates periodically (every 30 minutes) - T021
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);
  },
  onError: (error) => {
    console.error('Service worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// US2 — T019: Track standalone-mode sessions (PWA retention).
// Fires once at startup; no-op when launched from browser tab.
trackStandaloneSession()

// US2 — T018: Track PWA install events (PWA acquisition).
// Listens for the browser install prompt; fires trackInstall() only when
// the user confirms the installation (userChoice.outcome === 'accepted').
;(function setupInstallTracking() {
  let deferredPrompt: BeforeInstallPromptEvent | null = null

  window.addEventListener('beforeinstallprompt', (e) => {
    deferredPrompt = e as BeforeInstallPromptEvent
  })

  window.addEventListener('appinstalled', () => {
    // appinstalled fires after the prompt is accepted — use it as the signal
    // since userChoice is only readable after the prompt resolves.
    if (deferredPrompt) {
      trackInstall()
      deferredPrompt = null
    }
  })
})()

// BeforeInstallPromptEvent is not yet in the TS lib — minimal declaration.
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}
