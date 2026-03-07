# Versioning Strategy

## Automatic Version Bumping

**Every merge to `main` automatically bumps the patch version and deploys.**

### How It Works

1. **Merge PR to main** → GitHub Actions workflow triggers
2. **Auto-bump version**: `0.1.0` → `0.1.1` → `0.1.2` (patch increment)
3. **Create git tag**: `v0.1.1`, `v0.1.2`, etc.
4. **Commit back to main**: `chore: bump version to v0.1.X [skip ci]`
5. **Build and deploy**: New version deployed to GitHub Pages
6. **Version visible in app**: Header shows `🎵 Graditone v0.1.X`

### Version Display

The version number appears in the app header:
```
🎵 Graditone v0.1.2
           ^^^^^^ (gray, smaller text)
```

This helps users verify they're running the latest deployed version.

## Manual Version Control

For **breaking changes** or **major features**, manually bump the version before merging:

### Minor Version Bump (New Features)
```bash
cd frontend
npm version minor  # 0.1.5 → 0.2.0
git push origin <branch>
```

### Major Version Bump (Breaking Changes)
```bash
cd frontend
npm version major  # 0.2.3 → 1.0.0
git push origin <branch>
```

After merging, the CI will continue auto-bumping from the new base:
- `1.0.0` → `1.0.1` → `1.0.2` (patch increments)

## Semantic Versioning

We follow [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`

- **PATCH** (auto): Bug fixes, performance improvements, minor tweaks
- **MINOR** (manual): New features, non-breaking changes
- **MAJOR** (manual): Breaking changes, API changes

## Version History

View all versions and their deployment dates:
```bash
git tag -l "v*"
```

View changes in a specific version:
```bash
git show v0.1.2
```

## Workflow Details

### GitHub Actions Workflow
File: `.github/workflows/deploy-pwa.yml`

**Version Bump Step:**
```yaml
- name: Bump version and create tag
  working-directory: frontend
  run: |
    npm version patch --no-git-tag-version
    NEW_VERSION=$(node -p "require('./package.json').version")
    git commit -am "chore: bump version to v$NEW_VERSION [skip ci]"
    git tag "v$NEW_VERSION"
    git push origin main
    git push origin "v$NEW_VERSION"
```

**Skip CI Tag:**
The `[skip ci]` tag prevents infinite loops (version bump commit doesn't trigger another workflow run).

## Examples

### Typical Development Flow

1. **Feature branch**: Develop Feature 014
2. **Create PR**: `014-new-feature` → `main`
3. **Merge PR**: Version auto-bumps `0.1.5` → `0.1.6`
4. **Deployed**: App shows `v0.1.6`

### Major Release Flow

1. **Feature complete**: Ready for v1.0.0
2. **Manual bump**: `npm version major` (0.9.3 → 1.0.0)
3. **Merge to main**: Deploy v1.0.0
4. **Future merges**: Auto-bump `1.0.0` → `1.0.1` → `1.0.2`

## Troubleshooting

### Version not updating in app?
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear site data: DevTools → Application → Clear site data
- PWA may cache old version (service worker update can take up to 24h)

### Version bump failed in CI?
Check workflow logs: https://github.com/aylabs/graditone/actions
- Ensure `contents: write` permission is set
- Check for merge conflicts in package.json

### Need to fix version manually?
```bash
cd frontend
npm version <version>  # e.g., npm version 0.1.7
git push origin main --tags
```

## Release Notes

For major/minor releases, create GitHub releases:
```bash
gh release create v1.0.0 --title "v1.0.0 - Major Release" --notes "Release notes here"
```

Or via GitHub UI: Releases → Draft a new release → Tag: v1.0.0
