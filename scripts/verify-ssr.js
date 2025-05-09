#!/usr/bin/env node

/**
 * SSR verification script to check if the Netlify build output is correct
 * This helps catch build issues before deploying to production
 *
 * Usage: node scripts/verify-ssr.js
 */

import fs from 'fs';
import path from 'path';

const NETLIFY_OUTPUT_DIR = 'dist';
const FUNCTIONS_DIR = path.join('.netlify', 'functions');
const STATIC_DIR = path.join(NETLIFY_OUTPUT_DIR);

// Required files and directories for a valid SSR build
const REQUIRED_PATHS = [
  {
    path: NETLIFY_OUTPUT_DIR,
    type: 'directory',
    name: 'Netlify output directory',
  },
  {
    path: FUNCTIONS_DIR,
    type: 'directory',
    name: 'Serverless functions directory',
  },
  {
    path: path.join(FUNCTIONS_DIR, 'entry.js'),
    type: 'file',
    name: 'Main SSR function',
  },
  {
    path: path.join(STATIC_DIR, '_astro'),
    type: 'directory',
    name: 'Static assets directory',
  },
];

console.log('🔍 Verifying Netlify SSR build output...');

// Check if all required paths exist
let missingPaths = [];
let foundPaths = [];

for (const { path: pathToCheck, type, name } of REQUIRED_PATHS) {
  const exists =
    type === 'directory'
      ? fs.existsSync(pathToCheck) && fs.statSync(pathToCheck).isDirectory()
      : fs.existsSync(pathToCheck) && fs.statSync(pathToCheck).isFile();

  if (exists) {
    foundPaths.push(name);
    console.log(`✅ Found ${name} at ${pathToCheck}`);
  } else {
    missingPaths.push(name);
    console.error(`❌ Missing ${name} (expected at ${pathToCheck})`);
  }
}

// Summary and exit accordingly
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`✅ Found ${foundPaths.length} required components`);

if (missingPaths.length === 0) {
  console.log('🎉 SSR build verified successfully!');
  process.exit(0);
} else {
  console.error(
    `❌ Missing ${missingPaths.length} required components: ${missingPaths.join(
      ', '
    )}`
  );
  console.error(
    '⚠️ The SSR build is incomplete. Please fix the issues before deploying.'
  );

  // Suggest next steps
  console.log('\n=== SUGGESTED FIXES ===');
  console.log(
    '1. Check if astro.config.mjs is correctly configured for Netlify SSR'
  );
  console.log('2. Verify @astrojs/netlify adapter is properly installed');
  console.log('3. Make sure all environment variables are set');
  console.log('4. Try running build with --verbose flag for more details');
  console.log('5. Check for any build errors in the console output');

  process.exit(1);
}
