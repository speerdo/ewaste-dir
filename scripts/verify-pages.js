#!/usr/bin/env node

/**
 * Page verification script to check if important pages were generated
 * This helps catch build issues before deploying to production
 *
 * Usage: node scripts/verify-pages.js
 */

import fs from 'fs';
import path from 'path';

const DIST_DIR = './dist';
const STATES_DIR = path.join(DIST_DIR, 'states');

// List of important city pages that must be present
// Format: [state-folder, city-folder, display name]
const CRITICAL_PAGES = [
  ['new-york', 'new-york', 'New York, NY'],
  ['new-york', 'new-york-city', 'New York City, NY'],
  ['florida', 'miami', 'Miami, FL'],
  ['california', 'los-angeles', 'Los Angeles, CA'],
  ['texas', 'austin', 'Austin, TX'],
  ['texas', 'houston', 'Houston, TX'],
  ['illinois', 'chicago', 'Chicago, IL'],
];

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Error: dist directory not found. Run the build first.');
  process.exit(1);
}

console.log('🔍 Verifying important pages in the build...');

// Verify critical pages
let missingPages = [];
let foundPages = [];

for (const [state, city, displayName] of CRITICAL_PAGES) {
  const cityDir = path.join(STATES_DIR, state, city);
  const indexFile = path.join(cityDir, 'index.html');

  if (fs.existsSync(indexFile)) {
    foundPages.push(displayName);
    console.log(
      `✅ Found page for ${displayName} at ${path.relative(
        DIST_DIR,
        indexFile
      )}`
    );
  } else {
    missingPages.push(displayName);
    console.error(
      `❌ Missing page for ${displayName} (expected at ${path.relative(
        DIST_DIR,
        indexFile
      )})`
    );
  }
}

// Summary and exit accordingly
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`✅ Found ${foundPages.length} critical pages`);

if (missingPages.length === 0) {
  console.log('🎉 All critical pages verified successfully!');
  process.exit(0);
} else {
  console.error(
    `❌ Missing ${missingPages.length} critical pages: ${missingPages.join(
      ', '
    )}`
  );
  console.error(
    '⚠️ The build is incomplete. Please fix the issues before deploying.'
  );

  // Suggest next steps
  console.log('\n=== SUGGESTED FIXES ===');
  console.log('1. Check your Supabase credentials in the Vercel environment');
  console.log(
    '2. Make sure all special city name variants are handled in getRecyclingCentersByCity()'
  );
  console.log(
    '3. Check if your build process is hitting Vercel timeout limits'
  );
  console.log(
    '4. Verify pagination is working correctly in the getStaticPaths() function'
  );
  console.log('5. Run a local build with verbose logging to debug further');

  process.exit(1);
}
