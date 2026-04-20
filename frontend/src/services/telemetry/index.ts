import type { TelemetryEvent } from './contract';

/**
 * Removes sensitive query parameters from a URL to prevent PII leakage.
 */
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString, window.location.origin);
    // Typical sensitive params. We can also just clear all search params if we want to be safe.
    const sensitiveParams = ['token', 'key', 'password', 'email', 'name', 'session'];
    sensitiveParams.forEach(param => url.searchParams.delete(param));
    return url.pathname + url.search;
  } catch (_e) {
    // If invalid URL, return empty or safe fallback
    return '';
  }
}

/**
 * Tracks a pageview recursively.
 */
export function trackPageview(url: string = window.location.href): void {
  const sanitizedUrl = sanitizeUrl(url);
  const event: TelemetryEvent = {
    name: 'pageview',
    url: sanitizedUrl,
    domain: window.location.hostname
  };

  sendToUmami(event);
}

/**
 * Tracks a custom interaction.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  const event: TelemetryEvent = {
    name,
    url: sanitizeUrl(window.location.href),
    domain: window.location.hostname,
    props
  };

  sendToUmami(event);
}

function sendToUmami(event: TelemetryEvent): void {
  // Only invoke if script is loaded
  if (typeof window !== 'undefined' && window.umami) {
    if (event.name === 'pageview') {
      window.umami.track(props => ({ ...props, url: event.url }));
    } else {
      window.umami.track(event.name, event.props);
    }
  } else {
    // Optionally log to console in dev mode
    if (import.meta.env.DEV) {
      console.log('[Telemetry Disabled/Missing]', event);
    }
  }
}

