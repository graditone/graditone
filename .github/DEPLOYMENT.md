# Deploying Musicore PWA to GitHub Pages

This guide explains how to deploy the Musicore PWA to GitHub Pages for testing on physical devices.

## Prerequisites

- GitHub repository with Pages enabled
- Main branch containing the PWA code (Feature 012)
- Repository secrets configured (if needed)

---

## Quick Start

### 1. Enable GitHub Pages

1. Go to your GitHub repository → **Settings** → **Pages**
2. Under **Source**, select: **GitHub Actions**
3. Save the configuration

### 2. Push to Main Branch

The workflow automatically triggers on push to `main`:

```bash
# From your feature branch (012-pwa-distribution)
git checkout main
git merge 012-pwa-distribution
git push origin main
```

### 3. Monitor Deployment

1. Go to **Actions** tab in GitHub repository
2. Watch the "Deploy PWA to GitHub Pages" workflow
3. Deployment typically takes 2-4 minutes:
   - Build WASM module (~1 min)
   - Build frontend (~30 sec)
   - Deploy to Pages (~30 sec)

### 4. Access Your PWA

After successful deployment:

- **Base URL**: `https://graditone.com/`
- **Manifest**: `https://graditone.com/manifest.webmanifest`
- **Service Worker**: `https://graditone.com/sw.js`

---

## Testing PWA Installation

### On iPad (iOS 15+/Safari 15+)

1. Open the deployed URL in Safari
2. The **IOSInstallModal** will appear automatically
3. Follow instructions:
   - Tap **Share** button (⎋)
   - Scroll down → **Add to Home Screen**
   - Tap **Add**
4. Verify standalone mode: No browser UI visible

### On Android Tablet (Chrome 90+)

1. Open the deployed URL in Chrome
2. Look for install prompt banner
3. Tap **Install** or:
   - Menu (⋮) → **Install app**
4. App installs to home screen
5. Verify standalone mode: No browser UI visible

### On Surface Pro (Edge 90+)

1. Open the deployed URL in Edge
2. Look for install icon in address bar
3. Click install icon or:
   - Menu (⋯) → **Apps** → **Install Musicore**
4. App installs as desktop PWA
5. Verify standalone mode: Dedicated window

---

## Configuration

### Base Path Configuration

The workflow supports two deployment scenarios:

#### Scenario 1: User/Organization Site
**URL Pattern**: `https://<username>.github.io/`

No configuration needed - uses default `base: '/'`

#### Scenario 2: Project Site (Default)
**URL Pattern**: `https://graditone.com/`

Configure base path in GitHub Actions workflow:

```yaml
# In .github/workflows/deploy-pwa.yml
- name: Build frontend with PWA
  working-directory: frontend
  run: npm run build
  env:
VITE_BASE: '/'  # Uncomment and set your repo name
```

The `vite.config.ts` automatically picks up `VITE_BASE` environment variable.

### Custom Domain (Optional)

To use a custom domain (e.g., `musicore.app`):

1. Add `CNAME` file to `frontend/public/`:
   ```
   musicore.app
   ```

2. Configure DNS:
   ```
   Type: CNAME
   Name: @
   Value: <username>.github.io
   ```

3. Enable HTTPS in GitHub Pages settings

---

## Workflow Details

### Build Process

The GitHub Actions workflow (`deploy-pwa.yml`) performs:

1. **Checkout**: Clones repository
2. **Rust Setup**: Installs Rust 1.93 + wasm-pack
3. **WASM Build**: Compiles `musiccore_backend` to WebAssembly
4. **Node.js Setup**: Installs Node.js 22
5. **Frontend Build**: Compiles React + PWA with Vite
6. **PWA Generation**: vite-plugin-pwa creates manifest + service worker
7. **Deploy**: Uploads to GitHub Pages

### Caching Strategy

- **Cargo dependencies**: Cached by `Cargo.lock` hash
- **npm dependencies**: Cached by `package-lock.json` hash
- **Build artifacts**: Not cached (full rebuild ~3-4 min)

### Deployment Outputs

After deployment, the workflow reports:
- ✅ Deployment URL
- 📱 Testing instructions for tablets
- 🔍 Links to manifest and service worker

---

## Verification Checklist

After deployment, verify these assets:

### 1. PWA Manifest
```bash
curl https://graditone.com/manifest.webmanifest
```

Should return JSON with:
- `name`: "Musicore - Intelligent Music Stand"
- `theme_color`: "#6366f1"
- `display`: "standalone"
- `icons`: Array with 192x192 and 512x512 PNGs

### 2. Service Worker
```bash
curl https://graditone.com/sw.js
```

Should return minified JavaScript with Workbox

### 3. Icons
```bash
curl -I https://graditone.com/icons/icon-512x512.png
curl -I https://graditone.com/icons/apple-touch-icon.png
```

Should return `200 OK` with `Content-Type: image/png`

### 4. WASM Module
```bash
curl -I https://graditone.com/wasm/musicore_backend_bg.wasm
```

Should return `200 OK` with `Content-Type: application/wasm`

---

## Lighthouse PWA Audit

Run Lighthouse audit on deployed URL:

```bash
# Using Chrome DevTools
1. Open deployed URL in Chrome
2. F12 → Lighthouse tab
3. Select "Progressive Web App"
4. Click "Analyze page load"
5. Verify score ≥90
```

**Expected Results**:
- ✅ **Installable**: Manifest + service worker valid
- ✅ **PWA Optimized**: Fast, reliable, engaging
- ✅ **Service Worker**: Registered and active
- ✅ **HTTPS**: Required for PWA (GitHub Pages auto-HTTPS)
- ✅ **Responsive**: Works on tablets/mobile
- ⚠️ **Performance**: May be lower due to WASM size (~800KB)

---

## Troubleshooting

### Build Fails: "WASM module not found"

**Cause**: WASM build failed or artifacts not copied

**Fix**:
```bash
# Check workflow logs for Rust/wasm-pack errors
# Verify backend/Cargo.toml and backend/src/lib.rs exist
```

### Build Fails: "crypto.hash is not a function"

**Cause**: Node.js version mismatch

**Fix**: Workflow uses Node 22 automatically (no action needed)

### PWA Not Installable

**Cause**: Missing HTTPS or invalid manifest

**Fix**:
1. Verify GitHub Pages uses HTTPS (automatic)
2. Check manifest URL returns valid JSON
3. Verify service worker registers (check browser console)

### Icons Not Loading

**Cause**: Incorrect base path or missing icons

**Fix**:
1. Verify `VITE_BASE` matches deployment URL structure
2. Check `frontend/public/icons/` contains all 5 PNGs
3. Rebuild with correct base path

### Service Worker Not Updating

**Cause**: Browser cached old service worker

**Fix**:
1. Open DevTools → Application → Service Workers
2. Click "Unregister"
3. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
4. Verify new service worker activates

---

## Manual Deployment (Alternative)

If GitHub Actions is not available:

```bash
# 1. Build locally
cd backend
wasm-pack build --target web --out-dir pkg --release
cd ../frontend
mkdir -p public/wasm
cp ../backend/pkg/musicore_backend_bg.wasm public/wasm/
cp ../backend/pkg/musicore_backend.js public/wasm/
npm run build

# 2. Deploy dist/ directory to GitHub Pages
# Option A: Use gh-pages branch
npm install -g gh-pages
gh-pages -d dist

# Option B: Use GitHub CLI
gh workflow run deploy-pwa.yml
```

---

## Next Steps

After successful deployment:

1. **Test on Physical Devices** (T027-T031):
   - iPad with iOS 15+ / Safari 15+
   - Android tablet with Chrome 90+
   - Surface Pro with Edge 90+

2. **Verify Standalone Mode**:
   - No browser UI visible
   - App launches from home screen icon
   - Theme color applied to status bar

3. **Run Lighthouse Audit**:
   - Target score ≥90
   - Fix any identified issues

4. **Test Offline Functionality** (Phase 4):
   - Load score while online
   - Enable airplane mode
   - Verify app still works

5. **Test Update Flow** (Phase 5):
   - Push update to main
   - Wait for deployment
   - Verify update prompt appears

---

## Related Files

- **Workflow**: `.github/workflows/deploy-pwa.yml`
- **Vite Config**: `frontend/vite.config.ts` (base path configuration)
- **Manifest**: Generated by vite-plugin-pwa during build
- **Service Worker**: Generated by Workbox during build
- **Icons**: `frontend/public/icons/*.png` (5 placeholder PNGs)

## Reference

- **Feature Spec**: `specs/012-pwa-distribution/plan.md`
- **Tasks**: `specs/012-pwa-distribution/tasks.md`
- **Quickstart**: `specs/012-pwa-distribution/quickstart.md`
- **GitHub Pages**: https://docs.github.com/en/pages
- **PWA Guide**: https://web.dev/progressive-web-apps/
