import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './i18n/index'
import { registerServiceWorker } from './sw-registration'

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
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)


