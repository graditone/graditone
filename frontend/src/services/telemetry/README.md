# Telemetry Adapter

## GDPR Constraints
- **Strictly Cookie-less**: This adapter interfaces with Plausible Analytics without setting persistent cookies in the user's browser.
- **No PII**: `url` strings are sanitized of potentially sensitive search parameters.
- **Async Loading**: Initialized via `<script defer>` in `index.html` to minimize performance impact (< 100ms overhead).

## Usage
Import `trackPageview` or `trackEvent` to record analytics gracefully.

```typescript
import { trackEvent } from '../services/telemetry';

function onUserClick() {
  trackEvent('cta_click', { action: 'signup' });
}
```
