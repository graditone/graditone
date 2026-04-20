# Research: GDPR-Compliant Logging

## 1. Analytics Service Selection
- **Decision**: Plausible Analytics (or similar self-hosted/privacy-first alternative like PostHog/Umami configured without cookies).
- **Rationale**: The spec requires strict GDPR compliance without cookie consent banners, anonymous usage tracking, and no PII/IP storage. Plausible explicitly fulfills these requirements out of the box by using a privacy-focused anonymous hashing mechanism for daily unique users, without persistent cookies.
- **Alternatives considered**: Google Analytics 4 (GA4 requires complex proxying or consent mode to be legally compliant under GDPR without banners, and often still requires them for full IP anonymization compliance). Custom backend telemetry (requires spinning up a new service/DB which adds unnecessary maintenance burden).

## 2. Cookie-less Tracking Implementation
- **Decision**: Use the selected analytics provider's lightweight script via a standard `<script defer>` tag on the landing page, and minimal JS for custom interaction events.
- **Rationale**: Avoids any `document.cookie` usage or `localStorage` persistence of client IDs. The provider hashes attributes (IP + User Agent) with a daily rotating salt to count uniques without persistence.
- **Alternatives considered**: Generating and storing an anonymized UUID in `sessionStorage` (adds complexity, risks borderline compliance if the ID persists too long).

## 3. Performance Constraints
- **Decision**: Load tracking script asynchronously/deferred.
- **Rationale**: Fulfills SC-003: "Landing page performance and load times are not degraded by more than 100ms as a result of the tracking implementation."
