// Feature 011: Offline Detection Hook
// Detects online/offline status using a fetch probe for reliability.
// navigator.onLine is intentionally NOT used as the primary source because
// it returns false on valid connections (VPN, certain WiFi/proxy setups).

import { useState, useEffect } from 'react';

/**
 * Verify connectivity with a lightweight HEAD request to /favicon.ico.
 * Returns true if the request succeeds, false if it fails or times out.
 */
async function probe(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`/favicon.ico?_=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook for detecting online/offline status.
 *
 * Starts optimistic (online) and verifies with a fetch probe on the `offline`
 * window event. This avoids false positives from unreliable navigator.onLine.
 *
 * @returns isOnline - true if reachable, false if offline
 */
export function useOfflineDetection(): boolean {
  // Start optimistic — avoids false offline banners on page load
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);

    // When the browser fires `offline`, verify with a real probe before
    // showing the banner (handles false positives from navigator.onLine).
    const handleOffline = () => {
      probe().then(setIsOnline);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If the browser already thinks we're offline on mount, verify now.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      probe().then(setIsOnline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
