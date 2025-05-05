#!/usr/bin/env node

/**
 * SSR verification script to check if the Vercel build output is correct
 * This helps catch build issues before deploying to production
 *
 * Usage: node scripts/verify-ssr.js
 */

import fs from 'fs';
import path from 'path';

const VERCEL_OUTPUT_DIR = '.vercel/output';
const FUNCTIONS_DIR = path.join(VERCEL_OUTPUT_DIR, 'functions');
const STATIC_DIR = path.join(VERCEL_OUTPUT_DIR, 'static');
const CONFIG_FILE = path.join(VERCEL_OUTPUT_DIR, 'config.json');

// Required files and directories for a valid SSR build
const REQUIRED_PATHS = [
  {
    path: VERCEL_OUTPUT_DIR,
    type: 'directory',
    name: 'Vercel output directory',
  },
  {
    path: FUNCTIONS_DIR,
    type: 'directory',
    name: 'Serverless functions directory',
  },
  {
    path: STATIC_DIR,
    type: 'directory',
    name: 'Static assets directory',
  },
  {
    path: CONFIG_FILE,
    type: 'file',
    name: 'Vercel config file',
  },
  {
    path: path.join(FUNCTIONS_DIR, '_render.func'),
    type: 'directory',
    name: 'Main SSR function',
  },
  {
    path: path.join(FUNCTIONS_DIR, '_middleware.func'),
    type: 'directory',
    name: 'Edge middleware',
  },
  {
    path: path.join(FUNCTIONS_DIR, '_isr.func'),
    type: 'directory',
    name: 'ISR function',
  },
];

console.log('🔍 Verifying SSR build output...');

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

// Verify config.json if it exists
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    // Check for required configuration
    const hasVersion = config.version === 3;
    const hasRoutes = Array.isArray(config.routes);

    if (hasVersion && hasRoutes) {
      console.log('✅ Valid Vercel configuration found');
    } else {
      console.error('❌ Invalid Vercel configuration:');
      if (!hasVersion)
        console.error('   - Missing or invalid version (should be 3)');
      if (!hasRoutes)
        console.error('   - Missing or invalid routes configuration');
    }
  } catch (error) {
    console.error('❌ Error parsing Vercel configuration:', error.message);
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
    '1. Check if astro.config.mjs is correctly configured for Vercel SSR'
  );
  console.log('2. Verify @astrojs/vercel adapter is properly installed');
  console.log('3. Make sure all environment variables are set');
  console.log('4. Try running build with --verbose flag for more details');
  console.log('5. Check for any build errors in the console output');

  process.exit(1);
}
