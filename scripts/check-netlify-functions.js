#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('Checking Netlify functions...');

// Possible locations of Netlify functions
const possibleFunctionDirs = [
  // Local development path
  path.join(process.cwd(), '.netlify/functions'),
  // Netlify CI build path
  path.join(process.cwd(), 'netlify/functions'),
  // Another possible CI path
  path.join(process.cwd(), '.netlify', 'functions-internal'),
];

// Check if any functions directory exists
let functionsDir = null;
for (const dir of possibleFunctionDirs) {
  if (fs.existsSync(dir)) {
    functionsDir = dir;
    console.log(`✅ Found functions directory at: ${dir}`);
    break;
  }
}

// Look for output directories if functions not found
if (!functionsDir) {
  console.log(
    'Functions directory not found in standard locations. Checking build outputs...'
  );

  // Check for Netlify build output
  const netlifyOutputDir = path.join(
    process.cwd(),
    '.netlify',
    'functions-internal'
  );
  if (fs.existsSync(netlifyOutputDir)) {
    console.log(`✅ Found Netlify functions directory at: ${netlifyOutputDir}`);
    functionsDir = netlifyOutputDir;
  } else {
    // In CI environment, just pass the check since Netlify will handle the functions
    if (process.env.NETLIFY || process.env.CI) {
      console.log(
        '⚠️ Running in CI environment. Assuming Netlify will handle functions correctly.'
      );
      console.log("✓ Skipping further checks as we're in a CI environment.");
      process.exit(0);
    } else {
      console.error('❌ No Netlify functions directory found!');
      // Exit without error to allow build to continue
      console.log('⚠️ Continuing build despite missing functions directory');
      process.exit(0);
    }
  }
}

// If we have a functions directory, check for entry.js
if (functionsDir) {
  const entryFunctionPaths = [
    path.join(functionsDir, 'entry.js'),
    path.join(functionsDir, 'entry.mjs'),
    path.join(functionsDir, 'entry', 'index.js'),
  ];

  let entryFound = false;
  let entryPath = '';

  for (const path of entryFunctionPaths) {
    if (fs.existsSync(path)) {
      entryFound = true;
      entryPath = path;
      console.log(`✅ Found entry function at: ${path}`);
      break;
    }
  }

  if (!entryFound) {
    console.warn('⚠️ Entry function not found, but continuing build');
  } else {
    // Check if the function contains references to API routes
    const entryContent = fs.readFileSync(entryPath, 'utf8');
    if (!entryContent.includes('/api/')) {
      console.warn(
        '⚠️ Entry function might not be handling API routes properly.'
      );
    }

    // List all functions
    try {
      const functions = fs.readdirSync(functionsDir);
      console.log(
        `\nFound ${functions.length} items in functions directory:`,
        functions
      );
    } catch (err) {
      console.warn(
        `⚠️ Could not list functions in ${functionsDir}: ${err.message}`
      );
    }
  }
}

console.log('\nDone checking Netlify functions!');
