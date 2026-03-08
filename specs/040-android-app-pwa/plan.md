# Implementation Plan: Android App Distribution via Google Play

**Branch**: `040-android-app-pwa` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/040-android-app-pwa/spec.md`

## Summary

Package the existing Graditone PWA (deployed at `https://graditone.com/`) as an Android Trusted Web Activity (TWA) and publish it to the Google Play Store. Implementation uses Bubblewrap CLI to generate the Android project from the existing Web App Manifest, adds Digital Asset Links verification to the PWA production host, configures anonymous crash reporting (Firebase Crashlytics, no PII), and extends GitHub Actions CI to build and sign the Android App Bundle on each release tag. Publishing follows a staged rollout: internal → closed beta → production.

No backend or frontend domain logic changes. The Rust/WASM engine and React frontend remain untouched; this feature adds only a new `android/` project and a new CI workflow.

## Technical Context

**Language/Version**: Kotlin/Gradle (Android TWA wrapper, Bubblewrap-generated). Existing stack: Rust 1.93 (WASM), TypeScript/React 18, Node.js 22.  
**Primary Dependencies**: Bubblewrap CLI (Google official TWA generator), Android Gradle Plugin 8.x, Android SDK API 34 (target) / API 28 (minimum), Firebase Crashlytics (anonymous), `r0adkll/upload-google-play` GitHub Action  
**Storage**: N/A — all app state lives in the PWA IndexedDB / Service Worker cache  
**Testing**: Node.js manifest validation script for TWA-readiness checks; manual device testing for Digital Asset Links verification  
**Target Platform**: Android 9.0 (API 28) and above. Production PWA host: `https://graditone.com/`  
**Project Type**: Mobile — new `android/` directory in existing monorepo  
**Performance Goals**: Cold-start launch to interactive < 3 s; AAB size < 5 MB (wrapper only)  
**Constraints**: No PII collected; anonymous crash diagnostics only; staged rollout enforced; CI builds signed AAB on release tag; manual Play Console publish gate

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Domain-Driven Design | N/A | No domain model changes |
| II. Hexagonal Architecture | N/A | No backend changes |
| III. PWA Architecture | PASS | TWA wraps the existing PWA; offline capability preserved via existing Service Worker |
| IV. Precision & Fidelity | N/A | No timing or music logic changes |
| V. Test-First Development | APPLICABLE | Digital Asset Links validation script and manifest check written before integration |
| VI. Layout Engine Authority | N/A | No rendering or layout changes |
| VII. Regression Prevention | APPLICABLE | Issues found during setup → regression test created before any fix |

**Gate result: PASS** — No violations.

## Project Structure

### Documentation (this feature)

```text
specs/040-android-app-pwa/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── assetlinks.json  # Digital Asset Links contract template
│   └── twa-config.json  # Bubblewrap TWA config schema and example
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/                              # UNCHANGED — Rust/WASM domain
frontend/                             # MOSTLY UNCHANGED — React PWA
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json           # NEW — TWA domain verification (auto-deployed with PWA)
│   └── privacy-policy.html           # NEW — required for Play Store listing
└── src/                              # UNCHANGED
android/                              # NEW — Bubblewrap-generated TWA Android project
├── app/
│   ├── build.gradle
│   └── src/main/AndroidManifest.xml
├── build.gradle
├── gradle.properties
├── twa-manifest.json                 # Bubblewrap source config (checked in)
├── scripts/
│   └── validate-manifest.js          # TWA manifest readiness check
├── store-listing.md                  # Play Store copy (descriptions)
└── RELEASE.md                        # Release process documentation
assets/
└── store/
    ├── feature-graphic.png           # 1024×500 Play Store feature graphic
    └── screenshots/
        ├── phone/                    # Min 2 phone screenshots
        └── tablet/                   # Tablet screenshots
.github/workflows/
├── deploy-pwa.yml                    # UNCHANGED
├── pr-check.yml                      # UNCHANGED
└── build-android.yml                 # NEW — builds signed AAB on v* tags
```

**Structure Decision**: Mobile (new `android/` top-level directory alongside existing `backend/` and `frontend/`). The `assetlinks.json` lives inside `frontend/public/.well-known/` so it deploys automatically with the existing PWA build. The Bubblewrap-generated Android project is committed as source code; the CI workflow manages SDK setup and signing using repository secrets.

## Complexity Tracking

*No constitutional violations — table omitted.*
