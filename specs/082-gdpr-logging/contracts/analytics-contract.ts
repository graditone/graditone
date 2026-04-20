export interface TelemetryEvent {
  /**
   * The name of the event being tracked.
   * e.g., 'pageview', 'signup_click'
   */
  readonly name: string;

  /**
   * The URL from which the event was triggered.
   * Must have all sensitive query parameters stripped to prevent PII leakage.
   */
  readonly url: string;

  /**
   * The domain the script is running on.
   */
  readonly domain?: string;

  /**
   * Custom properties mapping for the event (e.g., button location).
   */
  readonly props?: Record<string, string | number | boolean>;
}

/**
 * Plausible Analytics (or similar) window function interface.
 */
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: {
        props?: Record<string, string | number | boolean>;
        callback?: () => void;
      }
    ) => void;
  }
}
