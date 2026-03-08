# Tasks: Android App Distribution via Google Play

**Branch**: `040-android-app-pwa`  
**Input**: `specs/040-android-app-pwa/` — spec.md, research.md, data-model.md, contracts/, quickstart.md  
**Tech stack**: Bubblewrap CLI (TWA generator), Android Gradle Plugin 8.x, Kotlin, Firebase Crashlytics, GitHub Actions  
**No tests**: tests not requested in spec

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelisable (independent files, no incomplete blockers)
- **[Story]**: User Story scope — [US1], [US2], [US3]
- Setup/Foundational/Polish phases: no Story label

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Fix the one PWA manifest gap, generate the Android project, and establish signing credentials. Nothing else can start until this phase is complete.

- [X] T001 Fix PWA manifest icon `purpose` — split combined `"any maskable"` value into separate `"any"` and `"maskable"` entries per icon size in `frontend/vite.config.ts`
- [X] T002 [P] Create manifest TWA-readiness validation script that asserts required fields and correct icon purpose values in `android/scripts/validate-manifest.js`
- [X] T003 Generate Android release keystore (25-year validity), record SHA-256 fingerprint, and store base64-encoded keystore + passwords as GitHub Actions secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`)
- [X] T004 Initialise Android TWA project using Bubblewrap CLI (`bubblewrap init --manifest https://graditone.com/manifest.webmanifest`) with package ID `com.graditone.app`, minSdk 28, targetSdk 34 — commit generated project to `android/`

**Checkpoint**: Android project exists in `android/`; signing credentials are stored; manifest icons are correct.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure that all user story phases depend on — Digital Asset Links, crash reporting, CI workflow, and privacy policy.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create Digital Asset Links file with upload key SHA-256 fingerprint placeholder at `frontend/public/.well-known/assetlinks.json` (schema: `contracts/assetlinks.json`)
- [X] T006 [P] Create privacy policy HTML page declaring no PII collection and anonymous crash diagnostics at `frontend/public/privacy-policy.html`
- [ ] T007 [P] Create Firebase project in Firebase Console, download `google-services.json`, add it to `android/app/google-services.json`
- [ ] T008 Integrate Firebase Crashlytics SDK into the Android project — add Firebase BOM and Crashlytics Gradle plugin in `android/app/build.gradle` and `android/build.gradle`
- [X] T009 Create Android CI build workflow that triggers on `v*` tags, decodes keystore secret, reads version from `frontend/package.json`, computes `versionCode = major×10000 + minor×100 + patch`, builds signed release AAB, and uploads as workflow artifact at `.github/workflows/build-android.yml`
- [X] T010 Enrol app in Google Play App Signing; retrieve Play App Signing key SHA-256 fingerprint from Play Console; update `frontend/public/.well-known/assetlinks.json` with both fingerprints (upload key + Play App Signing key)
- [X] T011 Deploy PWA to production (push to main → triggers `deploy-pwa.yml`); verify `https://graditone.com/.well-known/assetlinks.json` returns valid JSON with correct fingerprints

**Checkpoint**: Digital Asset Links live at production URL with correct fingerprints; CI workflow builds signed AAB; privacy policy is live; Crashlytics SDK integrated.

---

## Phase 3: User Story 1 — Install App from Google Play (Priority: P1) 🎯 MVP

**Goal**: Graditone is publicly available on the Google Play Store. Any Android user can find it, install it, and launch it full-screen with no browser chrome.

**Independent Test**: Search "Graditone" on the Play Store → install → launch → verify full-screen display, correct icon, all PWA features functional.

- [ ] T012 [P] [US1] Create Play Store feature graphic 1024×500 PNG at `assets/store/feature-graphic.png`
- [ ] T013 [P] [US1] Capture minimum 2 phone screenshots at 1080×1920–2400 resolution at `assets/store/screenshots/phone/`
- [ ] T014 [P] [US1] Capture tablet screenshots at 1200×1920 resolution at `assets/store/screenshots/tablet/`
- [X] T015 [US1] Write Play Store short description (≤80 chars) and full description (≤4000 chars) in `android/store-listing.md`
- [X] T016 [US1] Create new app in Google Play Console ($25 one-time fee); set app name "Graditone", default language English, category "Music & Audio"
- [ ] T017 [US1] Upload all store listing assets (icon, feature graphic, screenshots, descriptions, privacy policy URL) in Play Console → Store presence
- [ ] T018 [US1] Complete Play Store content rating questionnaire in Play Console (expected result: PEGI 3 / Everyone)
- [ ] T019 [US1] Complete Play Store Data Safety form: declare "App diagnostics" collected, not linked to identity (per research.md Unknown 4)
- [ ] T020 [US1] Build signed release AAB using CI workflow (push release tag → download artifact from GitHub Actions)
- [ ] T021 [US1] Upload AAB to Play Console → Testing → Internal testing track; create release
- [ ] T022 [US1] Test internal track on a physical Android device: verify full-screen display with no browser chrome, Graditone icon on home screen, all PWA core features (score loading, playback, navigation) work identically to browser PWA
- [ ] T023 [US1] Promote release to closed testing (beta) track in Play Console; invite minimum 1 external tester
- [ ] T024 [US1] Verify closed beta: external tester searches "Graditone" on Play Store (beta), installs, verifies app icon, home screen display, and full-screen launch
- [ ] T025 [US1] Submit release to production track in Play Console for Google Play review

**Checkpoint**: US1 complete when app is live on Google Play Store and installable by any Android user.

---

## Phase 4: User Story 2 — Offline Usage (Priority: P2)

**Goal**: A user who has previously opened the app can use it fully — including loading and playing scores — with no internet connection.

**Independent Test**: Open app once with internet → enable airplane mode → reopen → verify previously loaded scores play and a clear offline message appears when offline for the first time.

- [ ] T026 [US2] Configure TWA back navigation in `android/twa-manifest.json` — set `navigationFallback` and `exitAnimations` to handle Android back-button correctly; verify pressing back at root prompts user before closing
- [ ] T027 [US2] Verify first-launch offline scenario on internal track device: install app, do NOT open it with internet, immediately enable airplane mode and open — verify app shows clear offline message (not blank screen, not crash)
- [ ] T028 [US2] Verify offline score playback on internal track device: open app with internet, load at least 2 scores, enable airplane mode, reopen — verify scores load and play without network
- [ ] T029 [US2] Verify graceful fallback when production URL is unavailable: simulate by blocking the URL in device hosts file — verify cached offline page is served from Service Worker, not a browser error

**Checkpoint**: US2 complete when offline playback verified and back-button behaviour confirmed on physical device.

---

## Phase 5: User Story 3 — App Update Delivery (Priority: P3)

**Goal**: When a new version is published, installed Android users receive and apply the update through Google Play without reinstalling.

**Independent Test**: Publish an incremented version to the internal testing track; verify the test device with the prior version receives an update notification and can update.

- [ ] T030 [US3] Validate CI version-code formula end-to-end: bump patch version in `frontend/package.json`, push `v*` tag, verify GitHub Actions produces AAB with correct `versionCode` and `versionName` values
- [X] T031 [US3] Create release process documentation covering: version bump → tag push → CI AAB artifact download → Play Console upload → track promotion at `android/RELEASE.md`
- [ ] T032 [US3] Perform end-to-end update test: upload a second AAB (incremented version) to internal testing track; verify device with first version receives update notification and update applies successfully

**Checkpoint**: US3 complete when update cycle verified and release process documented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, discoverability, and final validation.

- [X] T033 [P] Add Play Store download badge and link to `frontend/src/` landing page / PWA install prompt component
- [X] T034 [P] Update root `README.md` with Android distribution section (Play Store link, minimum Android requirement, update process pointer to `android/RELEASE.md`)
- [ ] T035 Run quickstart.md verification checklist end-to-end; confirm all items checked off

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion
  - US1 (P1) must be completed before US2 and US3 (US2/US3 require an app to be live)
  - US2 (P2) can begin as soon as internal track has the app installed (T022)
  - US3 (P3) can begin as soon as CI workflow is validated (T030)
- **Polish (Phase 6)**: Depends on US1 completion (needs a live Play Store URL)

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories. **Must complete first.**
- **US2 (P2)**: After US1 internal track build (T022) — all offline tests use the same installed TWA
- **US3 (P3)**: After US1 production submission (T025) — update cycle requires existing installed version

### Within Each User Story

- Store graphic assets (T012–T014) can be prepared in parallel with Foundational phase
- Play Console setup (T016–T019) can begin once Privacy Policy is live (T006)
- AAB upload (T021) requires both CI workflow (T009) and Play Console app created (T016)

### Parallel Opportunities

Within Phase 1: T002 runs while T003 keystore generation happens  
Within Phase 2: T006, T007 run in parallel; T008 blocks on T007  
Within Phase 3: T012, T013, T014, T015 all run in parallel; T016–T018 run in parallel

---

## Parallel Example: Phase 3 Setup sub-tasks

```bash
# Can all run in parallel:
T012: Create feature graphic — assets/store/feature-graphic.png
T013: Capture phone screenshots — assets/store/screenshots/phone/
T014: Capture tablet screenshots — assets/store/screenshots/tablet/
T015: Write store descriptions — android/store-listing.md

# Can then proceed in parallel:
T016: Create app in Play Console
T017: Upload all listing assets
T018: Content rating questionnaire
T019: Data Safety form
```

---

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + Phase 3 (US1)** — a publicly installable Graditone app on Google Play.

**Why US1 first**: US2 (offline) relies on the existing PWA Service Worker and requires a real device with the TWA installed. US3 (updates) requires an already-published version to update from. US1 is the prerequisite for all testing.

**Expected timeline shape**:
1. Phase 1 (1–2 days): manifest fix, Bubblewrap init, keystore
2. Phase 2 (1–2 days): assetlinks, Crashlytics, CI workflow
3. Phase 3 (3–5 days including Google Play review wait of 1–3 days for first submission)
4. Phase 4 (1 day): offline & back-button verification on device
5. Phase 5 (1 day): update cycle + documentation
6. Phase 6 (0.5 day): README + badge

**Total task count**: 35  
**US1 task count**: 14 (T012–T025)  
**US2 task count**: 4 (T026–T029)  
**US3 task count**: 3 (T030–T032)  
**Setup task count**: 4 (T001–T004)  
**Foundational task count**: 7 (T005–T011)  
**Polish task count**: 3 (T033–T035)
