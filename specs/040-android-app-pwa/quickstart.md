# Quickstart: Android App Distribution via Google Play

**Branch**: `040-android-app-pwa` | **Date**: 2026-03-08

---

## Prerequisites

### One-time accounts & tools
- Google Play Developer account (one-time $25 USD registration fee)
- Android Studio (for local debugging) — or Android SDK command-line tools only
- Node.js 22 (`node --version`)
- Java 17+ (`java -version`) — required by Gradle
- Bubblewrap CLI: `npm install -g @bubblewrap/cli`

### Secrets to generate (one-time, before CI setup)
| Secret name (GitHub Actions) | Content |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` keystore file |
| `ANDROID_KEY_ALIAS` | Keystore alias (e.g., `graditone-release`) |
| `ANDROID_KEY_PASSWORD` | Key password |
| `ANDROID_STORE_PASSWORD` | Keystore store password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play API service account JSON (for upload action) |

---

## Step 1: Fix PWA Manifest Icon Purpose

The current manifest lists icons with `"purpose": "any maskable"`. TWA requires separate entries.

Edit `frontend/vite.config.ts` — update the `icons` array in the `VitePWA` plugin config:

```ts
icons: [
  { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
],
```

Verify with: `npm run build` in `frontend/` and inspect `dist/manifest.webmanifest`.

---

## Step 2: Generate Android Keystore

```bash
keytool -genkey -v \
  -keystore graditone-release.jks \
  -alias graditone-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Graditone, OU=Mobile, O=Graditone, L=Unknown, ST=Unknown, C=ES"
```

**Immediately:**
1. Store `graditone-release.jks` in a secure password manager (1Password, Bitwarden).
2. Record the SHA-256 fingerprint:
   ```bash
   keytool -list -v -keystore graditone-release.jks -alias graditone-release | grep SHA256
   ```
3. Base64-encode for GitHub secret:
   ```bash
   base64 -i graditone-release.jks | pbcopy   # macOS — copies to clipboard
   ```
4. Add all 4 signing secrets to GitHub → Settings → Secrets and variables → Actions.

---

## Step 3: Generate Android Project with Bubblewrap

```bash
# From the repo root
bubblewrap init --manifest https://graditone.com/manifest.webmanifest
```

Follow the interactive prompts. When asked:
- Package ID: `com.graditone.app`
- Min SDK: `28`
- Target SDK: `34`
- Key alias: `graditone-release`

This generates the `android/` directory. Review and commit it:

```bash
git add android/
git commit -m "feat: add Bubblewrap-generated Android TWA project"
```

---

## Step 4: Add Digital Asset Links to PWA

1. Get the SHA-256 fingerprint of your upload key (Step 2).
2. Enrol in Google Play App Signing (done in Play Console during first upload). After enrolment, Play Console shows the Play App Signing fingerprint — you need both.
3. Create `frontend/public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.graditone.app",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:...:YOUR_UPLOAD_KEY_SHA256",
      "DD:EE:FF:...:PLAY_APP_SIGNING_KEY_SHA256"
    ]
  }
}]
```

4. Commit and push to `main` → the existing `deploy-pwa.yml` deploys it.
5. Verify: `curl https://graditone.com/.well-known/assetlinks.json`

---

## Step 5: Build Locally (Validation)

```bash
cd android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=../graditone-release.jks \
  -Pandroid.injected.signing.store.password=YOUR_STORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=graditone-release \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Step 6: First Upload to Play Console (Internal Track)

1. Go to [play.google.com/console](https://play.google.com/console).
2. Create a new app → App name: `Graditone` → Default language: English.
3. Complete all required metadata (store listing, content rating questionnaire, Data Safety form).
4. Main store listing → Upload:
   - Hi-res icon: 512×512 PNG
   - Feature graphic: 1024×500 PNG
   - Screenshots (min 2 phone screenshots)
5. Testing → Internal testing → Create new release → Upload `.aab` file.
6. After internal testing passes → Closed testing (beta) → invite testers.
7. After beta passes → Production → Submit for review (Google review ≈1–3 days first time).

---

## Step 7: CI Setup (build-android.yml)

After the first upload succeeds manually, add `.github/workflows/build-android.yml` to automate AAB generation on release tags:

```yaml
name: Build Android AAB

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Decode keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > android/graditone-release.jks

      - name: Read version from package.json
        id: version
        run: |
          VERSION=$(node -p "require('./frontend/package.json').version")
          IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
          VERSION_CODE=$((MAJOR * 10000 + MINOR * 100 + PATCH))
          echo "versionName=$VERSION" >> $GITHUB_OUTPUT
          echo "versionCode=$VERSION_CODE" >> $GITHUB_OUTPUT

      - name: Build release AAB
        working-directory: android
        run: |
          ./gradlew bundleRelease \
            -Pandroid.injected.signing.store.file=graditone-release.jks \
            -Pandroid.injected.signing.store.password=${{ secrets.ANDROID_STORE_PASSWORD }} \
            -Pandroid.injected.signing.key.alias=${{ secrets.ANDROID_KEY_ALIAS }} \
            -Pandroid.injected.signing.key.password=${{ secrets.ANDROID_KEY_PASSWORD }} \
            -PversionName=${{ steps.version.outputs.versionName }} \
            -PversionCode=${{ steps.version.outputs.versionCode }}

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: graditone-release-${{ steps.version.outputs.versionName }}.aab
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30
```

The team then manually downloads the `.aab` artifact and uploads it to the Play Console (manual publish gate, per FR-014).

---

## Verification Checklist (before first Play Store submission)

- [ ] `assetlinks.json` is accessible at `https://graditone.com/.well-known/assetlinks.json`
- [ ] TWA launches full-screen on a physical Android device (no browser chrome visible)
- [ ] Back button navigates within the app; pressing back at root prompts to exit
- [ ] App loads previously visited content while on airplane mode
- [ ] App shows a clear offline message on first launch without network
- [ ] Version code increments relative to any previously uploaded builds
- [ ] Firebase Crashlytics reports at least one test crash in the pre-production track
- [ ] Play Store Data Safety form completed (Diagnostics: App diagnostics, not linked to identity)
- [ ] Content rating questionnaire completed (result: PEGI 3 / Everyone)
