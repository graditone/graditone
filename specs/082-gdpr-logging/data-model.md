# Data Model: GDPR-Compliant Logging

This feature does not introduce new database tables in the application's backend. The data model instead describes the shape of the telemetry payload sent to the analytics service (e.g. Plausible Analytics) and the aggregated structures accessed by admins.

## 1. Telemetry Event (Client Payload)

| Field | Type | Description / Notes |
|-------|------|---------------------|
| `name` | string | Standard `pageview` or custom event string (e.g., `cta_click`). |
| `url` | string | Current URL (sanitized of query params if they contain sensitive info). |
| `domain` | string | E.g., `graditone.com`. |
| `referrer` | string | Referring domain (without path or sensitive query params). |
| `props` | JSON | Key-value pairs for additional context on custom events. No PII allowed. |

*Note on Client IPs:* The client's IP and User-Agent are transmitted during the HTTP request but are instantly aggregated and one-way hashed by the analytics provider. **No raw IP or PII is ever retained.**

## 2. Aggregated Metric (Admin Dashboard view)

These metrics represent the queries exposed by the provider to administrators:
- `pageviews`: Count of interactions per path per time interval.
- `visitors`: Daily unique users (derived without persistent cookies using rotation hashes).
- `custom_events`: Count of tracked interaction (e.g. "Primary CTA Click").
