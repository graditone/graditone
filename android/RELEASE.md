# Graditone Android — Release Process

This document covers the end-to-end process for publishing a new version of the Graditone Android app to Google Play.

---

## Overview

```
Version bump → Push tag → CI builds signed AAB → CI uploads to Play Store production → Google review
```

The CI workflow (`.github/workflows/build-android.yml`) builds, signs, and **automatically uploads** the AAB to the Play Store production track when `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is configured. Publishing is still gated by Google's review, but the upload is fully automated.

> **If `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is not set**: The workflow still builds and signs the AAB, uploads it as a GitHub Actions artifact, and skips the Play Store upload step — fallback to manual upload.

---

## Prerequisites

- Access to the `graditone/graditone` GitHub repository with push permissions
- Access to Google Play Console (Publisher account)
- The signing keys are stored as GitHub Actions secrets — you do **not** need the keystore file locally to do a release

---

## Step-by-step Release

### 1. Bump the version in `frontend/package.json`

The Android `versionCode` and `versionName` are derived from this file.

```bash
# In the repo root
cd frontend
npm version patch    # for a patch release: 0.1.70 → 0.1.71
npm version minor    # for a minor release: 0.1.70 → 0.2.0
npm version major    # for a major release: 0.1.70 → 1.0.0
```

> **versionCode formula**: `major × 10000 + minor × 100 + patch`  
> Example: `0.1.71` → `0 × 10000 + 1 × 100 + 71` = **171**

The `npm version` command automatically:
- Updates `version` in `package.json`
- Creates a git commit with message `vX.Y.Z`
- Creates a git tag `vX.Y.Z`

### 2. Push the tag to trigger the CI build and deploy

```bash
git push origin main
git push origin vX.Y.Z    # e.g. git push origin v0.1.71
```

This triggers `.github/workflows/build-android.yml`, which:
- Builds and signs the AAB
- Uploads it directly to the Play Store production track (if `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is set)

### 3. Monitor the release

1. Go to <https://github.com/graditone/graditone/actions/workflows/build-android.yml>
2. Confirm the run succeeded — the build summary shows whether the Play Store upload step ran
3. In Play Console → **Production** → you'll see the new release in review

> If the CI upload step is skipped (secret not set), fall back to downloading the AAB artifact and uploading manually — see step 3 below.

### 4. (Fallback) Download the signed AAB from GitHub Actions

1. Go to <https://github.com/graditone/graditone/actions/workflows/build-android.yml>
2. Click the completed run for your tag
3. Under **Artifacts**, download `graditone-X.Y.Z-release`
4. Unzip → you'll have `app-release.aab`

### 5. (Fallback) Upload to Play Console manually

1. Open [Google Play Console](https://play.google.com/console)
2. Select **Graditone**
3. Navigate to **Testing > Internal testing** (or the target track)
4. Click **Create new release**
5. Upload `app-release.aab`
6. Fill in the **Release notes** (What's new in this version — keep concise, ≤500 chars per language)
7. Click **Review release**, then **Start rollout**

### 5. Promote through tracks

| Track | When to promote | Notes |
|-------|----------------|-------|
| **Internal testing** | Immediately after upload | For your own devices; max 100 testers |
| **Closed testing (beta)** | After internal verification | Opt-in URL for invited testers |
| **Production** | After beta verification (~1–3 days Google review for first submission) | Full public release |

To promote: Play Console → Testing → select track → **Promote release** → choose target track.

---

## Version Code History

| Tag | versionName | versionCode | Release date |
|-----|-------------|-------------|--------------|
| v0.1.70 | 0.1.70 | 170 | (first internal release) |

> Update this table after each release.

---

## Rollback

If a critical bug is discovered after production release:

1. **Halt rollout**: Play Console → Production → Manage release → **Pause rollout** (if still rolling out)
2. **Promote previous version**: Select the previous release and promote it back to production (this does a server-side rollback without requiring a new APK — Play Store handles it)
3. **Fix and release**: Fix the bug, bump the patch version, repeat the release process

> There is no "revert" for 100% rollouts. In that case, a new version with the fix must be released as quickly as possible.

---

## GitHub Secrets Required

These must be set in the repository Settings → Secrets and variables → Actions:

| Secret name | Description | How to obtain |
|-------------|-------------|---------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore | `base64 -i graditone-release.keystore` |
| `ANDROID_KEY_ALIAS` | Key alias used during `keytool -genkey` | From keystore generation (see quickstart.md) |
| `ANDROID_KEY_PASSWORD` | Password for the key entry | From keystore generation |
| `ANDROID_STORE_PASSWORD` | Password for the keystore | From keystore generation |
| `GOOGLE_SERVICES_JSON_BASE64` | Base64-encoded `google-services.json` | `base64 -i google-services.json` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account JSON (plain text) | See below |

### Setting up `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

1. Go to [Google Play Console](https://play.google.com/console) → **Setup → API access**
2. Click **Link to a Google Cloud project** (create new or use existing)
3. In Google Cloud Console → **IAM & Admin → Service Accounts** → **Create service account**
   - Name: `graditone-ci-deploy`
   - Role: none (permissions are granted in Play Console)
4. Create a JSON key for the service account → download it
5. Back in Play Console → **Setup → API access** → find the service account → click **Grant access**
   - Account permissions: **Release manager** (or **Admin** for full access)
6. Add the **full contents** of the JSON key file as the GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   (not base64 — paste the raw JSON)

> **CRITICAL**: If the upload keystore is ever lost or the password forgotten, you can no longer sign updates for the app. Keep a secure backup (e.g., password manager or encrypted storage).

---

## Play App Signing

Graditone uses **Google Play App Signing**. This means:

- Google holds the final **app signing key** (used on APKs delivered to devices)
- You use the **upload key** (keystore above) to sign the AAB you upload
- Google re-signs the AAB with the app signing key before distributing it

Benefits:
- If the upload key is compromised, Google can rotate it without breaking the app for users
- The upload key fingerprint and the Play App Signing key fingerprint are **different** — both must appear in `frontend/public/.well-known/assetlinks.json`

To find the Play App Signing key fingerprint:  
Play Console → Setup → App signing → App signing key certificate → SHA-256 certificate fingerprint

---

## Digital Asset Links

The file `frontend/public/.well-known/assetlinks.json` must contain **both** SHA-256 fingerprints (upload key + Play App Signing key) for the TWA to work in full-screen mode (no browser address bar).

If you ever regenerate the upload key, you must:
1. Update the fingerprint in `assetlinks.json`
2. Rebuild and redeploy the PWA (`push to main → deploy-pwa.yml`)
3. Re-verify in Play Console → Setup → App signing

---

## Checklist for Each Release

- [ ] `frontend/package.json` version bumped
- [ ] Git tag pushed (`v*`)
- [ ] CI build succeeded and `versionCode`/`versionName` verified in build summary
- [ ] AAB downloaded from GitHub Actions artifacts
- [ ] AAB uploaded to Play Console internal testing track
- [ ] Internal device verified: app launches, score loads, plays correctly
- [ ] Release notes written (max 500 chars per language)
- [ ] Release promoted to closed beta (if applicable)
- [ ] External beta testers verified (if applicable)
- [ ] Release promoted to production
- [ ] Version Code History table in this file updated
