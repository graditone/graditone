# Implementation Plan: GDPR-Compliant Logging

**Branch**: `082-gdpr-logging` | **Date**: 20 April 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/082-gdpr-logging/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement anonymous, GDPR-compliant usage tracking on the graditone.com landing page using Plausible Analytics (or similar tracker). Provide aggregate telemetry metrics without capturing PII or setting tracking cookies, thereby eliminating the need for a cookie banner.

## Technical Context

**Language/Version**: HTML, TypeScript, React 19 / Vite
**Primary Dependencies**: Plausible Analytics script (frontend injection)
**Storage**: N/A (strictly no cookies, no localStorage for analytics identifiers)
**Testing**: Playwright (for e2e privacy checks: ensuring cookies lack identifiers), Vitest
**Target Platform**: Tablet devices and standard browsers on graditone.com
**Project Type**: web (frontend static site / PWA)
**Performance Goals**: < 100ms script evaluation overhead (script loaded asynchronously limit)
**Constraints**: ZERO tracking cookies; NO PII sent; fully autonomous execution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **DDD**: N/A (Tracking domain sits on the periphery and does not interact with the music engine).
- **Test-First**: Verified via Playwright testing that the network payloads don't contain PII, and cookies are unset.
- **Hexagonal Architecture**: Telemetry adapter must be abstracted so the rest of the TS app sends `trackEvent('click')` instead of directly calling `window.plausible()`.
- **User Profile Awareness**: (N/A) Tracking is strictly anonymous, not tied to internal user profiles.

## Project Structure

### Documentation (this feature)

```text
specs/082-gdpr-logging/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── index.html                     # (Contains script tag injection for analytics service)
├── src/
│   └── services/
│       └── telemetry/             # (Hexagonal adapter for JS analytics tracking, e.g., Plausible)
└── tests/
    └── e2e/
        └── telemetry.spec.ts      # (Ensures cookies are off, events are fired properly)
```

**Structure Decision**: A small lightweight directory `frontend/src/services/telemetry` will act as our "adapter" inside the frontend so we aren't strongly coupled to one specific analytics script. This fulfills the Hexagonal context requirement.

## Complexity Tracking

*(None needed - architecture stays within existing frameworks)*
