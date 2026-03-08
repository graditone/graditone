#!/usr/bin/env node
/**
 * TWA Manifest Readiness Validator
 *
 * Validates that the Graditone PWA Web App Manifest satisfies all requirements
 * for packaging as a Trusted Web Activity (TWA) via Bubblewrap.
 *
 * Usage:
 *   node android/scripts/validate-manifest.js
 *   node android/scripts/validate-manifest.js --url https://graditone.com/manifest.webmanifest
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks fail
 */

'use strict';

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// --- Configuration -----------------------------------------------------------

const DEFAULT_MANIFEST_URL = 'https://graditone.com/manifest.webmanifest';

// Minimum icon sizes required by Bubblewrap / Play Store
const REQUIRED_ICON_SIZES = ['192x192', '512x512'];

// Required fields and their expected values / validators
const REQUIRED_FIELDS = [
  { field: 'name', validate: (v) => typeof v === 'string' && v.length > 0, message: 'must be a non-empty string' },
  { field: 'short_name', validate: (v) => typeof v === 'string' && v.length > 0 && v.length <= 12, message: 'must be a non-empty string ≤12 chars' },
  { field: 'display', validate: (v) => v === 'standalone' || v === 'fullscreen', message: 'must be "standalone" or "fullscreen"' },
  { field: 'start_url', validate: (v) => typeof v === 'string' && v.length > 0, message: 'must be a non-empty string' },
  { field: 'theme_color', validate: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v), message: 'must be a 6-digit hex colour' },
  { field: 'background_color', validate: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v), message: 'must be a 6-digit hex colour' },
  { field: 'icons', validate: (v) => Array.isArray(v) && v.length > 0, message: 'must be a non-empty array' },
];

// --- Helpers -----------------------------------------------------------------

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

function fetchManifest(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https://') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching manifest at ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (err) {
          reject(new Error(`Failed to parse manifest JSON: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

function loadLocalManifest() {
  // Try to read the built manifest from frontend/dist/manifest.webmanifest
  const candidates = [
    path.resolve(__dirname, '../../frontend/dist/manifest.webmanifest'),
    path.resolve(__dirname, '../../frontend/dist/manifest.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`  Loading local manifest from ${candidate}`);
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  }
  return null;
}

// --- Validation logic --------------------------------------------------------

function validateRequiredFields(manifest) {
  console.log('\n[1] Required fields');
  let errors = 0;
  for (const { field, validate, message } of REQUIRED_FIELDS) {
    if (!(field in manifest)) {
      fail(`"${field}" is missing`);
      errors++;
    } else if (!validate(manifest[field])) {
      fail(`"${field}" ${message} (got: ${JSON.stringify(manifest[field])})`);
      errors++;
    } else {
      pass(`"${field}": ${JSON.stringify(manifest[field])}`);
    }
  }
  return errors;
}

function validateIcons(manifest) {
  console.log('\n[2] Icon requirements');
  let errors = 0;
  const icons = manifest.icons || [];

  for (const size of REQUIRED_ICON_SIZES) {
    const iconsForSize = icons.filter((icon) => icon.sizes === size);

    if (iconsForSize.length === 0) {
      fail(`No icon found for size ${size}`);
      errors++;
      continue;
    }

    // Check that purpose values are split (not combined "any maskable")
    for (const icon of iconsForSize) {
      const purposeRaw = (icon.purpose || '').trim();

      if (purposeRaw.includes(' ')) {
        fail(
          `Icon ${size} has combined purpose "${purposeRaw}" — ` +
          'Bubblewrap requires separate entries for "any" and "maskable". ' +
          'Fix: split into two separate icon objects in frontend/vite.config.ts'
        );
        errors++;
        continue;
      }

      if (purposeRaw === 'any' || purposeRaw === 'maskable') {
        pass(`Icon ${size} purpose "${purposeRaw}" — OK`);
      } else {
        fail(`Icon ${size} has unrecognised purpose "${purposeRaw}" (expected "any" or "maskable")`);
        errors++;
      }
    }

    // Check both "any" and "maskable" exist for this size
    const purposes = iconsForSize.map((i) => (i.purpose || '').trim());
    if (!purposes.includes('any')) {
      fail(`Icon ${size} is missing a separate "any" purpose entry`);
      errors++;
    }
    if (!purposes.includes('maskable')) {
      fail(`Icon ${size} is missing a separate "maskable" purpose entry`);
      errors++;
    }
  }
  return errors;
}

function validateTWARequirements(manifest) {
  console.log('\n[3] TWA-specific requirements');
  let errors = 0;

  // display must be standalone or fullscreen
  if (!['standalone', 'fullscreen'].includes(manifest.display)) {
    fail(`"display" must be "standalone" or "fullscreen" for TWA (got: "${manifest.display}")`);
    errors++;
  } else {
    pass(`"display": "${manifest.display}" is compatible with TWA`);
  }

  // scope should be present (Bubblewrap uses it to restrict URL bar hiding)
  if (manifest.scope) {
    pass(`"scope": "${manifest.scope}"`);
  } else {
    // Not a hard error — Bubblewrap defaults to start_url origin, but worth flagging
    console.warn('  ⚠ "scope" not set — Bubblewrap will default to origin of start_url');
  }

  // short_name ≤ 12 chars (Android launcher label limit)
  if (manifest.short_name && manifest.short_name.length > 12) {
    fail(`"short_name" must be ≤12 chars (got ${manifest.short_name.length}: "${manifest.short_name}")`);
    errors++;
  }

  return errors;
}

// --- Entry point -------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const urlFlagIdx = args.indexOf('--url');
  const manifestUrl = urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : DEFAULT_MANIFEST_URL;
  const useLocal = args.includes('--local');

  console.log('═══════════════════════════════════════════════════');
  console.log('  Graditone TWA Manifest Readiness Validator');
  console.log('═══════════════════════════════════════════════════');

  let manifest;
  try {
    if (useLocal) {
      manifest = loadLocalManifest();
      if (!manifest) {
        console.error('ERROR: No local manifest found. Run `npm run build` in frontend/ first.');
        process.exit(1);
      }
    } else {
      console.log(`\nFetching manifest from ${manifestUrl} …\n`);
      manifest = await fetchManifest(manifestUrl);
    }
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    console.error('Tip: use --local to validate against the local build instead of fetching live.');
    process.exit(1);
  }

  let totalErrors = 0;
  totalErrors += validateRequiredFields(manifest);
  totalErrors += validateIcons(manifest);
  totalErrors += validateTWARequirements(manifest);

  console.log('\n═══════════════════════════════════════════════════');
  if (totalErrors === 0) {
    console.log('  PASS — Manifest is ready for Bubblewrap packaging');
    console.log('═══════════════════════════════════════════════════');
    process.exit(0);
  } else {
    console.error(`  FAIL — ${totalErrors} issue(s) found. Fix before running bubblewrap init.`);
    console.log('═══════════════════════════════════════════════════');
    process.exit(1);
  }
}

main();
